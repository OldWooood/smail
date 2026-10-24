import { ArrowLeft, Clock, User } from "lucide-react";
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
		{ headers: { "Cache-Control": "private, max-age=60" } },
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
	const senderLabel =
		email.from?.name || email.senderAddress || email.subject || "?";
	const senderInitial = [...senderLabel.trim()][0]?.toUpperCase() || "@";
	// The email canvas is always light so arbitrary HTML stays readable.
	const bodySrc = `/api/emails/${email.id}/body`;

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
						<Link prefetch="viewport" viewTransition to="/">
							<ArrowLeft className="h-4 w-4" />
							<span>{locale.detail.back}</span>
						</Link>
					</Button>
					<span className="text-xs text-muted-foreground/60">/</span>
					<span className="truncate text-xs font-medium text-muted-foreground">
						{locale.email_detail}
					</span>
				</div>

				<div className="panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
					<div className="shrink-0 border-b border-border px-5 py-5 sm:px-6">
						<div className="flex items-start gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold uppercase text-primary ring-1 ring-primary/20">
								{senderInitial}
							</div>
							<div className="min-w-0 flex-1">
								<h1 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
									{email.subject || locale.list.no_subject}
								</h1>
								<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
									{email.senderAddress && (
										<span className="flex min-w-0 items-center gap-1.5">
											<User className="h-3.5 w-3.5 shrink-0" />
											<span
												translate="no"
												className="truncate font-mono text-foreground/80"
											>
												{email.senderAddress.toLowerCase()}
											</span>
										</span>
									)}
									<span className="flex items-center gap-1.5">
										<Clock className="h-3.5 w-3.5" />
										<span className="font-mono">{email.createdAt}</span>
									</span>
								</div>
							</div>
						</div>
					</div>

					<div className="min-h-0 flex-1 bg-[#fdfdfc]">
						<iframe
							key={bodySrc}
							title={email.subject || "Email Content"}
							src={bodySrc}
							className="h-full w-full bg-[#fdfdfc]"
							loading="eager"
							referrerPolicy="no-referrer"
							sandbox="allow-popups allow-popups-to-escape-sandbox"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
