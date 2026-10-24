import { ArrowLeft } from "lucide-react";
import type { LoaderFunctionArgs } from "react-router";
import {
	data,
	isRouteErrorResponse,
	Link,
	useLoaderData,
	useRouteError,
} from "react-router";
import { d1Wrapper } from "~/.server/db";
import { sessionWrapper } from "~/.server/session";
import { EmailReader } from "~/components/email-reader";
import { Button } from "~/components/ui/button";
import { formatEmailDate } from "~/lib/email";
import { getLocaleData } from "~/locales/locale";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const id = params.id as string;
	const lang = params.lang || "en";
	const { getSession } = sessionWrapper(context.cloudflare.env);
	const session = await getSession(request.headers.get("Cookie"));
	const messageTo = session.data.email;
	if (!messageTo) {
		throw new Response("Unauthorized", { status: 401 });
	}
	const db = d1Wrapper(context.cloudflare.env.DB);
	// Only metadata here: body is served lazily via /api/emails/:id/body
	// so the parent document stays small even for large emails.
	const email = await db.query.emails.findFirst({
		columns: {
			id: true,
			from: true,
			sender: true,
			messageFrom: true,
			subject: true,
			createdAt: true,
		},
		where: (emails, { and, eq }) =>
			and(eq(emails.id, id), eq(emails.messageTo, messageTo.toLowerCase())),
	});
	if (!email) {
		throw new Response("Email not found", { status: 404 });
	}
	const senderAddress =
		email.from?.address || email.sender?.address || email.messageFrom || "";
	const newEmail = {
		...email,
		createdAt: await formatEmailDate(email.createdAt, lang),
		senderAddress,
	};
	const locale = await getLocaleData(lang);
	return data(
		{ locale, email: newEmail },
		{
			headers: {
				"Cache-Control": "private, no-store",
				Vary: "Cookie",
			},
		},
	);
}

export function ErrorBoundary() {
	const error = useRouteError();
	const status = isRouteErrorResponse(error) ? error.status : 500;
	const title =
		status === 401 ? "Unauthorized" : status === 404 ? "Not found" : "Error";
	const message =
		status === 401
			? "Your session expired. Please create a new address."
			: status === 404
				? "This email no longer exists."
				: "Failed to load this email.";
	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="panel mx-auto max-w-md space-y-4 rounded-2xl p-6 text-center">
				<h1 className="text-lg font-semibold text-foreground">{title}</h1>
				<p className="text-sm text-muted-foreground">{message}</p>
				<Button asChild variant="outline">
					<Link to="/" viewTransition>
						<ArrowLeft className="h-4 w-4" />
						Back
					</Link>
				</Button>
			</div>
		</div>
	);
}

export default function EmailDetail() {
	const { locale, email } = useLoaderData<typeof loader>();

	return (
		<div className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
			<div className="flex min-h-0 flex-1 flex-col gap-4">
				<div className="flex shrink-0 items-center gap-2">
					<Button
						asChild
						variant="ghost"
						size="sm"
						className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
					>
						<Link reloadDocument to="/">
							<ArrowLeft className="h-4 w-4" />
							<span>{locale.detail.back}</span>
						</Link>
					</Button>
					<span className="text-xs text-muted-foreground/60">/</span>
					<h1 className="truncate text-xs font-medium text-muted-foreground">
						{locale.email_detail}
					</h1>
				</div>

				<EmailReader
					id={email.id}
					subject={email.subject}
					sender={email.senderAddress}
					createdAt={email.createdAt}
					noSubject={locale.list.no_subject}
				/>
			</div>
		</div>
	);
}
