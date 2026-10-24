import randomName from "@scaleway/random-name";
import { Clock4, Loader2, MailOpen, Trash2 } from "lucide-react";
import { customAlphabet } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
	ActionFunctionArgs,
	LinksFunction,
	LoaderFunctionArgs,
} from "react-router";
import {
	data,
	Form,
	type MetaFunction,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { d1Wrapper } from "~/.server/db";
import { listEmails } from "~/.server/emails";
import {
	claimMailbox,
	destroyMailbox,
	findActiveMailbox,
	normalizeDomain,
	touchMailbox,
} from "~/.server/mailbox";
import { checkClaimRateLimit, getClientIp } from "~/.server/ratelimit";
import { sessionWrapper } from "~/.server/session";
import { verifyTurnstile } from "~/.server/turnstile";
import { AuthForm } from "~/components/auth-form";
import { CopyButton } from "~/components/copy-button";
import { type Email, EmailList } from "~/components/email-list";
import { EmailReader } from "~/components/email-reader";
import { HeroSection } from "~/components/marketing/hero-section";
import { Button } from "~/components/ui/button";
import type { Mailbox } from "~/drizzle/schema";
import { isSupportedLang, SUPPORTED_LANGS } from "~/lib/lang";
import { cn } from "~/lib/utils";
import { getLocaleData, type Locale } from "~/locales/locale";

const OG_LOCALES: Record<string, string> = {
	en: "en_US",
	"zh-CN": "zh_CN",
	es: "es_ES",
	fr: "fr_FR",
	ja: "ja_JP",
	ko: "ko_KR",
};

function languagePath(lang: string) {
	return lang === "en" ? "/" : `/${lang}`;
}

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
	return normalizeDomain(env.DOMAIN);
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

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://challenges.cloudflare.com" },
	{ rel: "dns-prefetch", href: "https://challenges.cloudflare.com" },
];

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "TempEmail" }];

	const { locale, lang, origin } = data;
	const canonical = `${origin}${languagePath(lang)}`;
	const alternates = SUPPORTED_LANGS.map((code) => ({
		tagName: "link" as const,
		rel: "alternate",
		hrefLang: code,
		href: `${origin}${languagePath(code)}`,
	}));

	return [
		{ title: locale.title },
		{ name: "description", content: locale.description },
		{ tagName: "link", rel: "canonical", href: canonical },
		...alternates,
		{
			tagName: "link",
			rel: "alternate",
			hrefLang: "x-default",
			href: `${origin}/`,
		},
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "TempEmail" },
		{ property: "og:title", content: locale.title },
		{ property: "og:description", content: locale.description },
		{ property: "og:url", content: canonical },
		{ property: "og:image", content: `${origin}/og.png` },
		{ property: "og:image:width", content: "1200" },
		{ property: "og:image:height", content: "630" },
		{ property: "og:image:alt", content: locale.title },
		{ property: "og:locale", content: OG_LOCALES[lang] ?? "en_US" },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: locale.title },
		{ name: "twitter:description", content: locale.description },
		{ name: "twitter:image", content: `${origin}/og.png` },
		{
			"script:ld+json": {
				"@context": "https://schema.org",
				"@type": "WebApplication",
				name: "TempEmail",
				url: canonical,
				description: locale.description,
				applicationCategory: "UtilitiesApplication",
				operatingSystem: "Any",
				offers: {
					"@type": "Offer",
					price: "0",
					priceCurrency: "USD",
				},
				inLanguage: lang,
			},
		},
	];
};

export async function loader({ request, params, context }: LoaderFunctionArgs) {
	const { getSession, destroySession } = sessionWrapper(context.cloudflare.env);
	const lang = params.lang && isSupportedLang(params.lang) ? params.lang : "en";
	const origin = new URL(request.url).origin;
	const [session, locale] = await Promise.all([
		getSession(request.headers.get("Cookie")),
		getLocaleData(lang),
	]);
	const domain = getDomain(context.cloudflare.env);

	const db = d1Wrapper(context.cloudflare.env.DB);
	const mailbox = await findActiveMailbox(
		db,
		session.data.mailboxId,
		session.data.mailboxToken,
	);
	if (mailbox) {
		await touchMailbox(db, mailbox);
	}

	const email = mailbox?.address ?? null;
	const emails = mailbox ? await listEmails(db, mailbox.id, lang) : [];

	const headers: Record<string, string> = {
		"Cache-Control": "private, no-store",
		Vary: "Cookie",
	};
	// Drop a stale credential so the browser does not keep sending it.
	if (!mailbox && (session.data.mailboxId || session.data.mailboxToken)) {
		headers["Set-Cookie"] = await destroySession(session);
	}

	return data(
		{
			lang,
			locale,
			origin,
			domain,
			email,
			emails,
			turnstileSiteKey: context.cloudflare.env.TURNSTILE_SITE_KEY,
		},
		{ headers },
	);
}

export async function action({ request, context }: ActionFunctionArgs) {
	const { getSession, commitSession, destroySession } = sessionWrapper(
		context.cloudflare.env,
	);
	const session = await getSession(request.headers.get("Cookie"));
	const { pathname } = new URL(request.url);
	const domain = getDomain(context.cloudflare.env);
	const db = d1Wrapper(context.cloudflare.env.DB);

	switch (request.method) {
		case "POST": {
			// An active mailbox must be deleted before a different one can be
			// created from the same browser.
			const current = await findActiveMailbox(
				db,
				session.data.mailboxId,
				session.data.mailboxToken,
			);
			if (current) {
				return data<ActionData>({ error: "already_assigned" }, { status: 400 });
			}

			const clientIp = getClientIp(request);
			const rate = await checkClaimRateLimit(
				context.cloudflare.env.KV,
				clientIp,
			);
			if (!rate.allowed) {
				return data<ActionData>(
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
					return data<ActionData>(
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
					return data<ActionData>(
						{ error: "verify_failed", localPart: rawLocalPart },
						{ status: 403 },
					);
				}
			}
			const normalizedLocal = normalizeLocalPart(rawLocalPart);
			if (rawLocalPart && !normalizedLocal) {
				return data<ActionData>(
					{ error: "invalid_local", localPart: rawLocalPart },
					{ status: 400 },
				);
			}

			// A random address collision is retried instead of surfacing a
			// confusing "address taken" error. Custom addresses get one try.
			const attempts = normalizedLocal ? 1 : 8;
			let mailbox: Mailbox | null = null;
			for (let i = 0; i < attempts; i++) {
				const localPart = normalizedLocal || createRandomLocalPart();
				mailbox = await claimMailbox(db, `${localPart}@${domain}`);
				if (mailbox) break;
			}
			if (!mailbox) {
				return data<ActionData>(
					{ error: "email_taken", localPart: rawLocalPart },
					{ status: 409 },
				);
			}

			session.set("mailboxId", mailbox.id);
			session.set("mailboxToken", mailbox.token);
			return redirect(pathname, {
				headers: {
					"Set-Cookie": await commitSession(session),
				},
			});
		}
		case "DELETE": {
			await destroyMailbox(
				db,
				session.data.mailboxId,
				session.data.mailboxToken,
			);
			return redirect(pathname, {
				headers: {
					"Set-Cookie": await destroySession(session),
				},
			});
		}
	}
	return null;
}

function MailboxBar({
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
		<div className="panel shrink-0 rounded-2xl px-4 py-3 sm:px-5 sm:py-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
						<span className="text-base font-bold">@</span>
					</div>
					<div className="min-w-0 flex-1">
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							aria-expanded={expanded}
							title={displayEmail}
							translate="no"
							className={cn(
								"block max-w-full rounded-md text-left font-mono text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-base",
								expanded ? "break-all whitespace-normal" : "truncate",
							)}
						>
							{displayEmail}
						</button>
						<p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
							<Clock4 className="mt-0.5 h-3 w-3 shrink-0" />
							{locale.mailbox.expires_hint}
						</p>
					</div>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<CopyButton
						content={displayEmail || ""}
						variant="default"
						size="sm"
						className="flex-1 justify-center sm:flex-none"
					>
						{locale.mailbox.copy}
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
								"transition-shadow duration-200",
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
									"overflow-hidden whitespace-nowrap text-[11px] font-medium transition-[max-width,margin,opacity] duration-200 ease-out motion-reduce:transition-none",
									confirmDelete && !isDeleting
										? "ml-0 max-w-[180px] opacity-100"
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

function MailboxSplitView({
	emails,
	locale,
	lang,
	displayEmail,
}: {
	emails: Email[];
	locale: Locale;
	lang: string;
	displayEmail: string;
}) {
	const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
	const [isDesktop, setIsDesktop] = useState(false);

	useEffect(() => {
		const mql = window.matchMedia("(min-width: 1024px)");
		const update = () => setIsDesktop(mql.matches);
		update();
		mql.addEventListener("change", update);
		return () => mql.removeEventListener("change", update);
	}, []);

	const handleOpenEmail = useCallback((nextEmail: Email) => {
		setSelectedEmail(nextEmail);
	}, []);

	// Language switches revalidate the loader with newly formatted dates.
	// Keep the open message selected while swapping in the translated row.
	useEffect(() => {
		setSelectedEmail((current) => {
			if (!current) return current;
			return emails.find((email) => email.id === current.id) ?? current;
		});
	}, [emails]);

	return (
		<div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
			<EmailList
				key={lang}
				initialEmails={emails}
				locale={locale}
				lang={lang}
				mailbox={displayEmail}
				selectedId={selectedEmail?.id}
				onOpen={isDesktop ? handleOpenEmail : undefined}
			/>

			<div className="hidden min-h-0 min-w-0 flex-col gap-3 lg:flex">
				<div aria-hidden className="h-9 shrink-0" />
				{selectedEmail ? (
					<EmailReader
						id={selectedEmail.id}
						subject={selectedEmail.subject}
						sender={selectedEmail.senderLabel || ""}
						createdAt={selectedEmail.createdAt}
						noSubject={locale.list.no_subject}
						className="min-w-0"
					/>
				) : (
					<div className="panel flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl px-6 text-center">
						<div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
							<MailOpen className="h-8 w-8" />
						</div>
						<p className="text-sm font-semibold text-foreground">
							{locale.list.select_email}
						</p>
						<p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
							{locale.list.select_hint}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

export default function Index() {
	const { lang, locale, turnstileSiteKey, email, emails, domain } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<ActionData>();
	const navigation = useNavigation();
	const displayEmail = email ? email.toLowerCase() : null;

	const [token, setToken] = useState("");

	return (
		<>
			{email && displayEmail ? (
				<section className="flex min-h-0 flex-1 flex-col overflow-hidden py-4 sm:py-6">
					<div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col gap-4 px-4 sm:px-6 lg:px-8">
						<MailboxBar
							key={displayEmail}
							locale={locale}
							displayEmail={displayEmail}
						/>
						<MailboxSplitView
							key={displayEmail}
							emails={emails}
							locale={locale}
							lang={lang}
							displayEmail={displayEmail}
						/>
					</div>
				</section>
			) : (
				<HeroSection locale={locale}>
					<div>
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
						<p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
							{locale.hero.trust}
						</p>
					</div>
				</HeroSection>
			)}
		</>
	);
}
