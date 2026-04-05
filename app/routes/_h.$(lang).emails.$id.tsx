import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { format } from "date-fns";
import { ArrowLeft, Mail, Clock, User } from "lucide-react";
import { d1Wrapper } from "~/.server/db";
import { sessionWrapper } from "~/.server/session";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { getLocaleData } from "~/locales/locale";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const id = params.id as string;
	const { getSession } = sessionWrapper(context.cloudflare.env);
	const session = await getSession(request.headers.get("Cookie"));
	const messageTo = session.data.email;
	if (!messageTo) {
		throw new Error("Unauthorized");
	}
	const db = d1Wrapper(context.cloudflare.env.DB);
	const email = await db.query.emails.findFirst({
		where: (emails, { and, eq }) =>
			and(eq(emails.id, id), eq(emails.messageTo, messageTo)),
	});
	if (!email) {
		throw new Error("Email not found");
	}
	const senderAddress =
		email.from?.address || email.sender?.address || email.messageFrom || "";
	const newEmail = {
		...email,
		createdAt: format(email.createdAt, "yyyy/MM/dd HH:mm:ss"),
		senderAddress,
	};
	const locale = await getLocaleData(params.lang || "en");
	return { locale, email: newEmail };
}

export default function EmailDetail() {
	const { locale, email } = useLoaderData<typeof loader>();
	
	return (
		<div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Button asChild variant="outline" size="icon" className="shrink-0">
							<Link prefetch="viewport" viewTransition to="/">
								<ArrowLeft className="h-4 w-4" />
							</Link>
						</Button>
						<div>
							<h1 className="text-xl font-semibold tracking-tight text-foreground">
								{locale.email_detail}
							</h1>
							<p className="text-sm text-muted-foreground">
								View email details
							</p>
						</div>
					</div>
				</div>

				<Card className="overflow-hidden">
					<CardHeader className="border-b border-border/50 bg-muted/30">
						<div className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<Mail className="h-5 w-5" />
								</div>
								<div className="flex-1 min-w-0">
									<h2 className="text-base font-semibold text-foreground leading-tight">
										{email.subject || "(No Subject)"}
									</h2>
								</div>
							</div>

							<div className="flex flex-wrap items-center gap-4 text-sm">
								{email.senderAddress && (
									<div className="flex items-center gap-2 text-muted-foreground">
										<User className="h-4 w-4" />
										<span className="font-medium text-foreground">
											{email.senderAddress.toLowerCase()}
										</span>
									</div>
								)}
								<div className="flex items-center gap-2 text-muted-foreground">
									<Clock className="h-4 w-4" />
									<span>{email.createdAt}</span>
								</div>
							</div>
						</div>
					</CardHeader>
					
					<CardContent className="p-0">
						<ScrollArea className="h-[calc(100vh-320px)] min-h-[400px]">
							<iframe
								title={email.subject || "Email Content"}
								srcDoc={email.html || email.text || ""}
								className="w-full h-full min-h-[400px] bg-background"
								sandbox="allow-scripts allow-same-origin"
								loading="lazy"
							/>
						</ScrollArea>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
