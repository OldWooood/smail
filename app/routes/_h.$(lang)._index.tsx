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
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { customAlphabet } from "nanoid";
import { useState } from "react";
import { d1Wrapper, schema } from "~/.server/db";
import { sessionWrapper } from "~/.server/session";
import { AuthForm } from "~/components/auth-form";
import { CopyButton } from "~/components/copy-button";
import { EmailList } from "~/components/email-list";
import { FeatureList } from "~/components/feature-list";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
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

function formatEmailList<T extends { createdAt: Date }>(
	emailList: T[],
	lang: string
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
	let emails: { id: string; subject: string | null; createdAt: string }[] = [];
	if (email) {
		const db = d1Wrapper(context.cloudflare.env.DB);
		const emailData = await db.query.emails.findMany({
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
		emails = formatEmailList(emailData, lang);
	}

	return {
		lang,
		locale,
		domain,
		email,
		emails,
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
	const { lang, locale, turnstileSiteKey, email, emails, domain } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<ActionData>();
	const navigation = useNavigation();
	const displayEmail = email ? email.toLowerCase() : null;

	const [token, setToken] = useState("");

	return (
		<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
			<div className="grid gap-8 lg:grid-cols-[1fr_400px]">
				<section className="space-y-6">
					<div className="space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground">
							<span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
							{locale.title}
						</div>
						<h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
							Temporary Email
							<span className="gradient-text"> Service</span>
						</h1>
						<p className="text-base text-muted-foreground max-w-lg">
							{locale.description}
						</p>
					</div>

					<div className="animate-fade-in">
						{email ? (
							<EmailList
								initialEmails={emails}
								locale={locale}
							/>
						) : (
							<FeatureList locale={locale} />
						)}
					</div>
				</section>

				<section className="lg:sticky lg:top-24 lg:self-start space-y-6">
					<div className="animate-slide-up">
						{email ? (
							<Card>
								<CardHeader>
									<div className="flex items-center gap-3">
										<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
											<span className="text-lg font-bold">@</span>
										</div>
										<div className="flex-1 min-w-0">
											<CardTitle className="text-base font-semibold truncate">
												{displayEmail}
											</CardTitle>
											<CardDescription>
												{locale.card_description}
											</CardDescription>
										</div>
									</div>
								</CardHeader>
								<CardFooter>
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
								</CardFooter>
							</Card>
						) : (
							<Card>
								<CardContent className="pt-6">
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
								</CardContent>
							</Card>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
