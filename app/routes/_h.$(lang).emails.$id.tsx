import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import {
	isRouteErrorResponse,
	Link,
	useLoaderData,
	useRouteError,
} from "@remix-run/react";
import { ArrowLeft, Clock, Mail, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
	return json(
		{ locale, email: newEmail },
		{ headers: { "Cache-Control": "private, max-age=60" } },
	);
}

function useDarkMode() {
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		const update = () =>
			setIsDark(document.documentElement.classList.contains("dark"));
		update();
		const observer = new MutationObserver(update);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, []);

	return isDark;
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
		<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
			<div className="glass mx-auto max-w-md space-y-4 rounded-2xl p-6 text-center">
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
	const isDark = useDarkMode();

	// Body loads via `src` (separate cached resource) instead of inlining
	// megabytes of HTML into the parent document / hydration payload.
	const bodySrc = useMemo(
		() => `/api/emails/${email.id}/body?theme=${isDark ? "dark" : "light"}`,
		[email.id, isDark],
	);

	return (
		<div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
			<div className="flex min-h-0 flex-1 flex-col space-y-4 sm:space-y-6">
				<div className="flex shrink-0 items-center gap-4">
					<Button
						asChild
						variant="outline"
						size="icon"
						aria-label={locale.detail.back}
						className="shrink-0"
					>
						<Link prefetch="viewport" viewTransition to="/">
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground">
							{locale.email_detail}
						</h1>
						<p className="text-sm text-muted-foreground">
							{locale.detail.view_details}
						</p>
					</div>
				</div>

				<div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
					<div className="shrink-0 space-y-4 border-b border-glass-border px-5 py-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
								<Mail className="h-5 w-5" />
							</div>
							<div className="flex-1 min-w-0">
								<h2 className="text-base font-semibold leading-tight text-foreground">
									{email.subject || locale.list.no_subject}
								</h2>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
							{email.senderAddress && (
								<div className="flex items-center gap-2 text-muted-foreground">
									<User className="h-4 w-4" />
									<span className="font-mono font-medium text-foreground">
										{email.senderAddress.toLowerCase()}
									</span>
								</div>
							)}
							<div className="flex items-center gap-2 text-muted-foreground">
								<Clock className="h-4 w-4" />
								<span className="font-mono">{email.createdAt}</span>
							</div>
						</div>
					</div>

					<div className="min-h-0 flex-1 bg-background">
						<iframe
							key={bodySrc}
							title={email.subject || "Email Content"}
							src={bodySrc}
							className="h-full w-full bg-background"
							loading="lazy"
							referrerPolicy="no-referrer"
							sandbox="allow-popups allow-popups-to-escape-sandbox"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
