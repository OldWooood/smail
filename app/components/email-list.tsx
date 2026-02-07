import { NavLink, useRevalidator } from "@remix-run/react";
import { InboxIcon, RefreshCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import type { Locale } from "~/locales/locale";

interface EmailListProps {
	emails: {
		id: string;
		subject: string | null;
		createdAt: string;
	}[];
	locale: Locale;
	revalidator: ReturnType<typeof useRevalidator>;
}

export function EmailList({ emails, locale, revalidator }: EmailListProps) {
	return (
		<div className="flex flex-col w-full min-h-0 gap-4">
			<div className="flex items-end justify-between border-b-2 border-foreground/10 pb-4">
				<div className="flex flex-col gap-2">
					<span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
						{locale.email_list}
					</span>
					<span className="font-display text-2xl uppercase tracking-[0.14em]">
						{locale.email_list}
					</span>
				</div>
				<Button size="sm" variant="outline" onClick={revalidator.revalidate}>
					<RefreshCcw
						strokeWidth="1.5px"
						className={cn({
							"animate-spin": revalidator.state === "loading",
						})}
					/>
				</Button>
			</div>
			<div className="flex-1 min-h-0 border-2 border-foreground/10 bg-transparent shadow-[8px_8px_0_0_hsl(var(--foreground)/0.08)]">
				<ScrollArea className="h-full">
					{emails.length === 0 && (
						<div className="flex flex-col w-full items-center py-16">
							<InboxIcon
								strokeWidth="1px"
								className="size-20 text-muted-foreground"
							/>
							<div className="text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
								{locale.email_empty}
							</div>
						</div>
					)}
					{emails.map((email) => (
						<NavLink
							prefetch="viewport"
							viewTransition
							to={`/emails/${email.id}`}
							key={email.id}
							className={({ isActive }) =>
								cn(
									"flex w-full items-center gap-3 px-5 py-4 text-xs uppercase tracking-[0.12em] transition-colors",
									"border-b-2 border-foreground/10 last:border-b-0",
									"hover:bg-foreground/5",
									isActive && "bg-foreground text-background",
								)
							}
						>
							<span className="truncate max-w-xs md:max-w-md">
								{email.subject}
							</span>
							<div className="flex-1" />
							<span className="shrink-0 text-[10px] text-muted-foreground">
								{email.createdAt}
							</span>
						</NavLink>
					))}
				</ScrollArea>
			</div>
		</div>
	);
}
