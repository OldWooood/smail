import type {
	ActionFunctionArgs,
	LinksFunction,
	LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import {
	Form,
	type MetaFunction,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import randomName from "@scaleway/random-name";
import { eq } from "drizzle-orm";
import { Clock4, Loader2, Trash2 } from "lucide-react";
import { customAlphabet } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { d1Wrapper, schema } from "~/.server/db";
import { listEmails } from "~/.server/emails";
import {
	MAILBOX_STATE_TTL_SECONDS,
	mailboxClaimKey,
	mailboxStateKey,
	nextMailboxStateToken,
} from "~/.server/mailbox";
import { checkClaimRateLimit, getClientIp } from "~/.server/ratelimit";
import { sessionWrapper } from "~/.server/session";
import { verifyTurnstile } from "~/.server/turnstile";
import { AuthForm } from "~/components/auth-form";
import { CopyButton } from "~/components/copy-button";
import { EmailList } from "~/components/email-list";
import { HeroSection } from "~/components/marketing/hero-section";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { getLocaleData, type Locale } from "~/locales/locale";

const MAILBOX_TTL_SECONDS = 60 * 60 * 24;

const tokenAlphabet = customAlphabet(
	"abcdefghijklmnopqrstuvwxyz0123456789",
	12,
);
const numericSuffix = customAlphabet("0123456789", 4);

type ActionData = {
	error:
		| "invalid_local"
		| "email_taken"
		| "already_assigned"
		| "verify_required"
		| "verify_failed"
		| "rate_limited";
	localPart?: string;
};

function getDomain(env: Env) {
	return env.DOMAIN || "smail.pw";
}

function mailboxKey(email: string) {
	return mailboxClaimKey(email);
}

function normalizeLocalPart(input: string) {
	const value = input.trim().toLowerCase();
	if (!value) return "";
	if (value.length < 3 || value.length > 32) return null;
	if (!/^[a-z0-9._-]+$/.test(value)) return null;
	if (/^[._-]/.test(value) || /[._-]$/.test(value)) return null;
	return value;
}

function createRandomLocalPart() {
	return `${randomName("", "-")}-${numericSuffix()}`;
}

async function claimMailbox(kv: KVNamespace, email: string) {
	const key = mailboxKey(email);
	const existing = await kv.get(key);
	if (existing) return null;
	const token = tokenAlphabet();
	await kv.put(key, token, { expirationTtl: MAILBOX_TTL_SECONDS });
	return token;
}

async function releaseMailbox(kv: KVNamespace, email: string, token: string) {
	const key = mailboxKey(email);
	const existing = await kv.get(key);
	if (existing === token) {
		await kv.delete(key);
	}
}

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://challenges.cloudflare.com" },
	{ rel: "dns-prefetch", href: "https://challenges.cloudflare.com" },
];

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: "TempEmail - Temporary Email Service" },
	{
		name: "description",
		content: data?.locale.description,
	},
];

export async function loader({ request, params, context }: LoaderFunctionArgs) {
	const { getSession } = sessionWrapper(context.cloudflare.env);
	const lang = params.lang || "en";
	const [session, locale] = await Promise.all([
		getSession(request.headers.get("Cookie")),
		getLocaleData(lang),
	]);
	const domain = getDomain(context.cloudflare.env);
	const email = session.data.email;

	// 只加载初始邮件列表
	let emails: {
		id: string;
		subject: string | null;
		createdAt: string;
		senderLabel: string;
	}[] = [];
	if (email) {
		const db = d1Wrapper(context.cloudflare.env.DB);
		emails = await listEmails(db, email, lang);
	}

	const sampleAddress = `${createRandomLocalPart()}@${domain}`;

	return {
		lang,
		locale,
		domain,
		email,
		emails,
		sampleAddress,
		turnstileSiteKey: context.cloudflare.env.TURNSTILE_SITE_KEY,
	};
}

export async function action({ request, context }: ActionFunctionArgs) {
	const { getSession, commitSession } = sessionWrapper(context.cloudflare.env);
	const session = await getSession(request.headers.get("Cookie"));
	const { pathname } = new URL(request.url);
	const domain = getDomain(context.cloudflare.env);
	switch (request.method) {
		case "POST": {
			if (session.data.email) {
				return json<ActionData>({ error: "already_assigned" }, { status: 400 });
			}
			const clientIp = getClientIp(request);
			const rate = await checkClaimRateLimit(
				context.cloudflare.env.KV,
				clientIp,
			);
			if (!rate.allowed) {
				return json<ActionData>(
					{ error: "rate_limited" },
					{ status: 429, headers: { "Retry-After": "3600" } },
				);
			}
			const formData = await request.formData();
			const rawLocalPart = String(formData.get("localPart") || "");
			const turnstileToken = String(
				formData.get("cf-turnstile-response") || "",
			);
			const turnstileSecret = context.cloudflare.env.TURNSTILE_SECRET_KEY;
			if (turnstileSecret) {
				if (!turnstileToken) {
					return json<ActionData>(
						{ error: "verify_required", localPart: rawLocalPart },
						{ status: 400 },
					);
				}
				const remoteIp =
					request.headers.get("CF-Connecting-IP") ||
					request.headers.get("X-Forwarded-For");
				const ok = await verifyTurnstile(
					turnstileToken,
					turnstileSecret,
					remoteIp,
				);
				if (!ok) {
					return json<ActionData>(
						{ error: "verify_failed", localPart: rawLocalPart },
						{ status: 403 },
					);
				}
			}
			const normalizedLocal = normalizeLocalPart(rawLocalPart);
			if (rawLocalPart && !normalizedLocal) {
				return json<ActionData>(
					{ error: "invalid_local", localPart: rawLocalPart },
					{ status: 400 },
				);
			}

			const localPart = normalizedLocal || createRandomLocalPart();
			const email = `${localPart}@${domain}`;
			const token = await claimMailbox(context.cloudflare.env.KV, email);
			if (!token) {
				return json<ActionData>(
					{ error: "email_taken", localPart: rawLocalPart },
					{ status: 409 },
				);
			}

			await context.cloudflare.env.KV.put(
				mailboxStateKey(email),
				nextMailboxStateToken(),
				{ expirationTtl: MAILBOX_STATE_TTL_SECONDS },
			);

			session.set("email", email);
			session.set("mailboxToken", token);
			return redirect(pathname, {
				headers: {
					"Set-Cookie": await commitSession(session),
				},
			});
		}
		case "DELETE": {
			if (!session.data.email) {
				return null;
			}
			const email = session.data.email;
			const db = d1Wrapper(context.cloudflare.env.DB);
			context.cloudflare.ctx.waitUntil(
				(async () => {
					await db
						.delete(schema.emails)
						.where(eq(schema.emails.messageTo, email.toLowerCase()));
					if (session.data.mailboxToken) {
						await releaseMailbox(
							context.cloudflare.env.KV,
							email,
							session.data.mailboxToken,
						);
					}
					await context.cloudflare.env.KV.put(
						mailboxStateKey(email),
						nextMailboxStateToken(),
						{ expirationTtl: MAILBOX_STATE_TTL_SECONDS },
					);
				})().catch((err) => {
					console.error("Failed to purge mailbox:", err);
				}),
			);
			session.unset("email");
			session.unset("mailboxToken");
			return redirect(pathname, {
				headers: {
					"Set-Cookie": await commitSession(session),
				},
			});
		}
	}
	return null;
}

function MailboxCard({
	locale,
	displayEmail,
}: {
	locale: Locale;
	displayEmail: string;
}) {
	const navigation = useNavigation();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const deleteFormRef = useRef<HTMLFormElement>(null);
	const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const isDeleting =
		navigation.state !== "idle" && navigation.formMethod === "DELETE";

	useEffect(
		() => () => {
			if (confirmTimerRef.current) {
				clearTimeout(confirmTimerRef.current);
			}
		},
		[],
	);

	const handleDeleteClick = () => {
		if (navigation.state !== "idle") return;
		if (!confirmDelete) {
			setConfirmDelete(true);
			if (confirmTimerRef.current) {
				clearTimeout(confirmTimerRef.current);
			}
			confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
			return;
		}
		if (confirmTimerRef.current) {
			clearTimeout(confirmTimerRef.current);
			confirmTimerRef.current = null;
		}
		setConfirmDelete(false);
		deleteFormRef.current?.requestSubmit();
	};

	return (
		<div className="order-first min-h-0 shrink-0 lg:order-none lg:self-start">
			<div className="glass flex flex-row items-center gap-2 rounded-2xl p-3 sm:p-4 lg:flex-col lg:items-stretch lg:gap-0 lg:space-y-5 lg:p-5">
				<div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 sm:h-12 sm:w-12">
						<span className="text-base font-bold sm:text-lg">@</span>
					</div>
					<div className="flex-1 min-w-0">
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							aria-expanded={expanded}
							title={displayEmail}
							className={cn(
								"block w-full text-left font-mono text-xs font-semibold text-foreground sm:text-base",
								expanded ? "break-all whitespace-normal" : "truncate",
							)}
						>
							{displayEmail}
						</button>
						<p className="mt-1 hidden items-start gap-1.5 text-xs text-muted-foreground lg:flex">
							<Clock4 className="mt-0.5 h-3 w-3 shrink-0" />
							{locale.mailbox.expires_hint}
						</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
					<CopyButton
						content={displayEmail || ""}
						variant="default"
						className="px-2.5 sm:px-4"
					>
						<span className="hidden md:inline">{locale.mailbox.copy}</span>
					</CopyButton>
					<Form method="DELETE" viewTransition ref={deleteFormRef}>
						<Button
							variant="destructive"
							size="sm"
							type="button"
							aria-label={
								confirmDelete
									? locale.mailbox.delete_confirm
									: locale.mailbox.delete
							}
							aria-live="polite"
							aria-expanded={confirmDelete}
							onClick={handleDeleteClick}
							disabled={isDeleting}
							className={cn(
								"transition-all duration-200",
								confirmDelete &&
									!isDeleting &&
									"ring-2 ring-destructive/30 ring-offset-2 ring-offset-background",
							)}
						>
							{isDeleting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Trash2
									className={cn(
										"h-4 w-4 transition-transform duration-200 motion-reduce:transition-none",
										confirmDelete && "scale-110",
									)}
								/>
							)}
							<span
								className={cn(
									"overflow-hidden whitespace-nowrap text-[11px] font-medium transition-all duration-200 ease-out motion-reduce:transition-none",
									confirmDelete && !isDeleting
										? "ml-0 max-w-[140px] opacity-100"
										: "-ml-2 max-w-0 opacity-0",
								)}
							>
								{locale.mailbox.delete_confirm}
							</span>
						</Button>
					</Form>
				</div>
			</div>
		</div>
	);
}

export default function Index() {
	const {
		lang,
		locale,
		turnstileSiteKey,
		email,
		emails,
		domain,
		sampleAddress,
	} = useLoaderData<typeof loader>();
	const actionData = useActionData<ActionData>();
	const navigation = useNavigation();
	const displayEmail = email ? email.toLowerCase() : null;

	const [token, setToken] = useState("");

	return (
		<>
			{email && displayEmail ? (
				<section className="flex min-h-0 flex-1 flex-col overflow-hidden py-4 sm:py-6">
					<div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-4 sm:px-6 lg:px-8">
						<div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-none lg:gap-8">
							<EmailList
								initialEmails={emails}
								locale={locale}
								lang={lang}
								mailbox={displayEmail}
							/>
							<MailboxCard
								key={displayEmail}
								locale={locale}
								displayEmail={displayEmail}
							/>
						</div>
					</div>
				</section>
			) : (
				<>
					<HeroSection sampleAddress={sampleAddress} locale={locale}>
						<div className="glass rounded-2xl p-6">
							<AuthForm
								turnstileSiteKey={turnstileSiteKey}
								lang={lang}
								locale={locale}
								domain={domain}
								navigation={navigation}
								setToken={setToken}
								token={token}
								defaultLocalPart={actionData?.localPart}
								emailError={
									actionData?.error === "email_taken"
										? locale.custom_email.error_taken
										: actionData?.error === "invalid_local"
											? locale.custom_email.error_invalid
											: undefined
								}
								verifyError={
									actionData?.error === "verify_required" ||
									actionData?.error === "verify_failed" ||
									actionData?.error === "rate_limited"
										? locale.form.verify_retry
										: undefined
								}
							/>
						</div>
					</HeroSection>
				</>
			)}
		</>
	);
}
