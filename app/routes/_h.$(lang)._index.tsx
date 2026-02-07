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
	useRevalidator,
} from "@remix-run/react";
import randomName from "@scaleway/random-name";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { eq } from "drizzle-orm";
import { Trash2Icon } from "lucide-react";
import { customAlphabet } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { d1Wrapper, schema } from "~/.server/db";
import { sessionWrapper } from "~/.server/session";
import { AuthForm } from "~/components/auth-form";
import { CopyButton } from "~/components/copy-button";
import { EmailList } from "~/components/email-list";
import { FeatureList } from "~/components/feature-list";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { getLocaleData } from "~/locales/locale";

const REFRESH_INTERVAL = 10_000;
const EMAIL_LIST_LIMIT = 50;
const MAILBOX_PREFIX = "mailbox:";
const MAILBOX_TTL_SECONDS = 60 * 60 * 24;

const tokenAlphabet = customAlphabet(
	"abcdefghijklmnopqrstuvwxyz0123456789",
	12,
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

function formatEmailList<T extends { createdAt: Date }>(
	emailList: T[],
	lang: string,
) {
	return emailList.map((email) => ({
		...email,
		createdAt: formatDistanceToNow(email.createdAt, {
			addSuffix: true,
			locale: lang === "en" ? enUS : zhCN,
		}),
	}));
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ rel: "preconnect", href: "https://challenges.cloudflare.com" },
	{ title: "TempEmail" },
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
	if (!email) {
		return {
			lang,
			locale,
			domain,
			email: null,
			emails: [],
			turnstileSiteKey: context.cloudflare.env.TURNSTILE_SITE_KEY,
		};
	}
	const db = d1Wrapper(context.cloudflare.env.DB);
	const emails = await db.query.emails.findMany({
		columns: {
			id: true,
			subject: true,
			createdAt: true,
		},
		where: (emails, { eq }) => eq(emails.messageTo, email),
		limit: EMAIL_LIST_LIMIT,
		orderBy(fields, operators) {
			return [operators.desc(fields.createdAt)];
		},
	});
	const formattedEmails = formatEmailList(emails, lang);
	return {
		lang,
		locale,
		domain,
		email,
		emails: formattedEmails,
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
					session.data.mailboxToken,
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
	const { lang, locale, turnstileSiteKey, email, emails, domain } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<ActionData>();
	const navigation = useNavigation();
	const displayEmail = email ? email.toLowerCase() : null;

	const [token, setToken] = useState("");

	const revalidator = useRevalidator();
	const previousEmailsLength = useRef(emails.length);

	useEffect(() => {
		if (email && Notification.permission === "default") {
			Notification.requestPermission();
		}
	}, [email]);

	useEffect(() => {
		if (emails.length > previousEmailsLength.current) {
			if (Notification.permission === "granted") {
				new Notification("New Email", {
					body: "You have received a new email!",
				});
			}
		}
		previousEmailsLength.current = emails.length;
	}, [emails]);

	useEffect(() => {
		const interval = setInterval(() => {
			revalidator.revalidate();
		}, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	}, [revalidator]);

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col min-h-0 px-6 pb-10 pt-4">
			<div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
				<section className="space-y-8">
					<div className="border-b-2 border-foreground/10 pb-6">
						<div className="text-[10px] uppercase tracking-[0.45em] text-muted-foreground">
							{locale.title}
						</div>
						<h1 className="mt-3 font-display text-4xl font-black leading-none tracking-[0.12em] uppercase sm:text-5xl">
							{locale.title}
						</h1>
						<p className="mt-4 max-w-xl text-base text-foreground/80">
							{locale.description}
						</p>
					</div>
					<div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
						{email ? (
							<EmailList
								emails={emails}
								locale={locale}
								revalidator={revalidator}
							/>
						) : (
							<FeatureList locale={locale} />
						)}
					</div>
				</section>
				<section className="space-y-6">
					<div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
						{email ? (
							<Card className="bg-transparent">
								<CardHeader className="py-5">
									<CardTitle className="font-display text-2xl font-black tracking-[0.04em]">
										{displayEmail}
									</CardTitle>
									<CardDescription className="text-sm font-medium text-foreground/70">
										{locale.card_description}
									</CardDescription>
								</CardHeader>
								<CardFooter className="gap-4 px-5 pb-5">
									<CopyButton content={displayEmail || ""} />
									<Form method="DELETE">
										<Button
											variant="secondary"
											type="submit"
											disabled={navigation.formMethod === "DELETE"}
										>
											<Trash2Icon
												strokeWidth="1.5px"
												className="text-destructive"
											/>
										</Button>
									</Form>
								</CardFooter>
							</Card>
						) : (
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
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
