import { NavLink, useRevalidator } from "@remix-run/react";
import { InboxIcon, MailIcon, RefreshCcw } from "lucide-react";
import { Button, buttonVariants } from "~/components/ui/button";
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
        <div className="flex flex-col flex-1 w-full min-h-0 px-2">
            <div className="mx-auto bg-primary text-primary-foreground w-full max-w-2xl flex gap-2 items-center rounded-t p-2 px-4 border-muted">
                <MailIcon strokeWidth="1.5px" />
                <span className="font-bold">{locale.email_list}</span>
                <div className="flex-1" />
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={revalidator.revalidate}
                >
                    <RefreshCcw
                        strokeWidth="1.5px"
                        className={cn({
                            "animate-spin": revalidator.state === "loading",
                        })}
                    />
                </Button>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 border-x">
                    {emails.length === 0 && (
                        <div className="flex flex-col w-full items-center py-12">
                            <InboxIcon
                                strokeWidth="1px"
                                className="size-20 text-muted-foreground"
                            />
                            <div className="text-center text-muted-foreground text-sm">
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
                            className={cn(
                                buttonVariants({
                                    variant: "ghost",
                                }),
                                "w-full rounded-none border-b",
                            )}
                        >
                            <span className="truncate max-w-xs md:max-w-md text-sm">
                                {email.subject}
                            </span>
                            <div className="flex-1" />
                            <span className="text-xs text-muted-foreground shrink-0">
                                {email.createdAt}
                            </span>
                        </NavLink>
                    ))}
                </ScrollArea>
            </div>
        </div>
    );
}
