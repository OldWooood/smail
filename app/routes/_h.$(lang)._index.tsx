import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import {
	Form,
	type MetaFunction,
	redirect,
	useLoaderData,
	useNavigation,
	useRevalidator,
} from "@remix-run/react";
import randomName from "@scaleway/random-name";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Trash2Icon } from "lucide-react";
import { customAlphabet } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { d1Wrapper } from "~/.server/db";
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

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ rel: "preconnect", href: "https://challenges.cloudflare.com" },
	{ title: data?.locale.title },
	{
		name: "description",
		content: data?.locale.description,
	},
];

const REFRESH_INTERVAL = 10_000;

export async function loader({ request, params, context }: LoaderFunctionArgs) {
	const { getSession } = sessionWrapper(context.cloudflare.env);
	const session = await getSession(request.headers.get("Cookie"));
	const db = d1Wrapper(context.cloudflare.env.DB);
	const lang = params.lang || "en";
	const locale = await getLocaleData(lang);
	const email = session.data.email;
	if (!email) {
		return {
			lang,
			locale,
			email: null,
			emails: [],
			turnstileSiteKey: context.cloudflare.env.TURNSTILE_SITE_KEY,
		};
	}
	const emails = await db.query.emails.findMany({
		columns: {
			id: true,
			subject: true,
			createdAt: true,
		},
		where: (emails, { eq }) => eq(emails.messageTo, email),
		orderBy(fields, operators) {
			return [operators.desc(fields.createdAt)];
		},
	});
	const newEails = emails.map((email) => ({
		...email,
		// do this in server, to avoid server and client difference(ssr hydration)
		createdAt: formatDistanceToNow(email.createdAt, {
			addSuffix: true,
			locale: lang === "en" ? enUS : zhCN,
		}),
	}));
	return {
		lang,
		locale: locale,
		email,
		emails: newEails,
		turnstileSiteKey: context.cloudflare.env.TURNSTILE_SITE_KEY,
	};
}

export async function action({ request, context }: ActionFunctionArgs) {
	const { getSession, commitSession } = sessionWrapper(context.cloudflare.env);
	const session = await getSession(request.headers.get("Cookie"));
	const { pathname } = new URL(request.url);
	const name = `${randomName("", "-")}-${customAlphabet("0123456789", 4)()}`;
	const email = `${name}@${context.cloudflare.env.DOMAIN || "smail.pw"}`;
	switch (request.method) {
		case "POST": {
			if (session.data.email) {
				return null;
			}
			session.set("email", email);
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
			session.unset("email");
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
	const { lang, locale, turnstileSiteKey, email, emails } =
		useLoaderData<typeof loader>();
	const navigation = useNavigation();

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
		<div className="max-w-2xl mx-auto flex flex-col items-center flex-1 w-full min-h-0 px-2 gap-4">
			<div className="max-w-xl w-full mx-auto px-2">
				{email ? (
					<Card>
						<CardHeader className="py-4">
							<CardTitle>{email}</CardTitle>
							<CardDescription>{locale.card_description}</CardDescription>
						</CardHeader>
						<CardFooter className="gap-4 px-4 pb-4">
							<CopyButton content={email} />
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
						navigation={navigation}
						setToken={setToken}
						token={token}
					/>
				)}
			</div>
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
	);
}
