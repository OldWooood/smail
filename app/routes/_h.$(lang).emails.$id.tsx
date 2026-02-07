import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { format } from "date-fns";
import { ArrowLeftIcon, MailOpenIcon } from "lucide-react";
import { d1Wrapper } from "~/.server/db";
import { sessionWrapper } from "~/.server/session";
import { Button } from "~/components/ui/button";
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
		<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-10 pt-4 gap-6">
			<div className="flex items-end justify-between border-b-2 border-foreground/10 pb-4">
				<div className="flex items-center gap-4">
					<div className="flex size-12 items-center justify-center border-2 border-foreground/10 bg-background shadow-[6px_6px_0_0_hsl(var(--foreground)/0.08)]">
						<MailOpenIcon
							strokeWidth="1.5px"
							className="size-5 text-foreground"
						/>
					</div>
					<div className="flex flex-col gap-2">
						<span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
							{locale.email_detail}
						</span>
						<span className="font-display text-2xl uppercase tracking-[0.14em]">
							Message
						</span>
					</div>
				</div>
				<Button asChild variant="outline" size="sm">
					<Link prefetch="viewport" viewTransition to="/">
						<ArrowLeftIcon strokeWidth="1.5px" />
					</Link>
				</Button>
			</div>
			<div className="flex flex-1 min-h-0 flex-col border-2 border-foreground/10 bg-background/60 backdrop-blur-md p-6 shadow-[10px_10px_0_0_hsl(var(--foreground)/0.08)]">
				<div className="flex flex-col gap-2">
					<div className="line-clamp-2 font-display text-xl uppercase tracking-[0.12em]">
						{email.subject}
					</div>
					{email.senderAddress ? (
						<div className="text-xs tracking-[0.12em] text-foreground/70">
							{email.senderAddress.toLowerCase()}
						</div>
					) : null}
					<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
						{email.createdAt}
					</div>
				</div>
				<iframe
					title={email.subject || ""}
					srcDoc={email.html || email.text || ""}
					className="mt-6 min-h-0 flex-1 w-full border-2 border-foreground/10 bg-background"
					sandbox="allow-scripts"
				/>
			</div>
		</div>
	);
}
