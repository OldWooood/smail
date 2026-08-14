import type {
	ActionFunctionArgs,
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
import { Trash2 } from "lucide-react";
import { customAlphabet } from "nanoid";
import { useState } from "react";
import { d1Wrapper, schema } from "~/.server/db";
import { sessionWrapper } from "~/.server/session";
import { AuthForm } from "~/components/auth-form";
import { CopyButton } from "~/components/copy-button";
import { EmailList } from "~/components/email-list";
import { Button } from "~/components/ui/button";
import { HeroSection } from "~/components/marketing/hero-section";
import { formatEmailList } from "~/lib/email";
import { getLocaleData } from "~/locales/locale";

const EMAIL_LIST_LIMIT = 50;
const MAILBOX_PREFIX = "mailbox:";
const MAILBOX_TTL_SECONDS = 60 * 60 * 24;

const tokenAlphabet = customAlphabet(
	"abcdefghijklmnopqrstuvwxyz0123456789",
	12
);
const numericSuffix = customAlphabet("0123456789", 4);

type ActionData = {
	error: "invalid_local" | "email_taken" | "already_assigned";
	localPart?: string;
};

function getDomain(env: Env) {
	return env.DOMAIN || "smail.pw";
}

function mailboxKey(email: string) {
	return `${MAILBOX_PREFIX}${email}`;
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

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ rel: "preconnect", href: "https://challenges.cloudflare.com" },
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
		const emailData = await db.query.emails.findMany({
			columns: {
				id: true,
				subject: true,
				createdAt: true,
				messageFrom: true,
				from: true,
			},
			where: (emails, { eq }) => eq(emails.messageTo, email),
			limit: EMAIL_LIST_LIMIT,
			orderBy(fields, operators) {
				return [operators.desc(fields.createdAt)];
			},
		});
		emails = formatEmailList(emailData, lang).map((email) => ({
			...email,
			senderLabel:
				email.from?.name || email.from?.address || email.messageFrom || "",
		}));
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
			const formData = await request.formData();
			const rawLocalPart = String(formData.get("localPart") || "");
			const normalizedLocal = normalizeLocalPart(rawLocalPart);
			if (rawLocalPart && !normalizedLocal) {
				return json<ActionData>(
					{ error: "invalid_local", localPart: rawLocalPart },
					{ status: 400 }
				);
			}

			const localPart = normalizedLocal || createRandomLocalPart();
			const email = `${localPart}@${domain}`;
			const token = await claimMailbox(context.cloudflare.env.KV, email);
			if (!token) {
				return json<ActionData>(
					{ error: "email_taken", localPart: rawLocalPart },
					{ status: 409 }
				);
			}

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
			await db.delete(schema.emails).where(eq(schema.emails.messageTo, email));
			if (session.data.mailboxToken) {
				await releaseMailbox(
					context.cloudflare.env.KV,
					email,
					session.data.mailboxToken
				);
			}
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

export default function Index() {
	const { lang, locale, turnstileSiteKey, email, emails, domain, sampleAddress } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<ActionData>();
	const navigation = useNavigation();
	const displayEmail = email ? email.toLowerCase() : null;

	const [token, setToken] = useState("");

	return (
		<>
			{email ? (
				<section className="py-8 sm:py-12">
					<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
						<div className="grid gap-8 lg:grid-cols-[1fr_400px]">
							<EmailList initialEmails={emails} locale={locale} />
						<div className="lg:sticky lg:top-24 lg:self-start">
							<div className="glass space-y-5 rounded-2xl p-5">
								<div className="flex items-center gap-3">
									<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
										<span className="text-lg font-bold">@</span>
									</div>
									<div className="flex-1 min-w-0">
										<p className="truncate font-mono text-base font-semibold text-foreground">
											{displayEmail}
										</p>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{locale.card_description}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<CopyButton content={displayEmail || ""}>
										Copy Email
									</CopyButton>
									<Form method="DELETE" className="ml-auto">
										<Button
											variant="destructive"
											size="sm"
											type="submit"
											disabled={navigation.formMethod === "DELETE"}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</Form>
								</div>
							</div>
						</div>
						</div>
					</div>
				</section>
			) : (
				<>
					<HeroSection sampleAddress={sampleAddress}>
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
							/>
						</div>
					</HeroSection>
				</>
			)}
		</>
	);
}
