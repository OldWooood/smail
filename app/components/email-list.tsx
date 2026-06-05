import { NavLink } from "@remix-run/react";
import { Inbox, RefreshCw, Mail } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import type { Locale } from "~/locales/locale";

interface Email {
	id: string;
	subject: string | null;
	createdAt: string;
}

interface EmailListProps {
	initialEmails: Email[];
	locale: Locale;
}

const REFRESH_INTERVAL = 5000;

function emailsChanged(a: Email[], b: Email[]) {
	if (a.length !== b.length) return true;
	return a.some((email, i) => email.id !== b[i].id);
}

export function EmailList({ initialEmails, locale }: EmailListProps) {
	const [emails, setEmails] = useState<Email[]>(initialEmails);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const previousEmailsLength = useRef(initialEmails.length);
	const abortControllerRef = useRef<AbortController | null>(null);
	const isVisibleRef = useRef(true);

	const fetchEmails = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		abortControllerRef.current = new AbortController();
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`/api/emails`, {
				signal: abortControllerRef.current.signal,
			});

			if (!response.ok) {
				throw new Error("Failed to fetch emails");
			}

			const data = await response.json() as { emails: Email[] };
			setEmails((prev) =>
				emailsChanged(prev, data.emails) ? data.emails : prev
			);
		} catch (err) {
			if (err instanceof Error && err.name !== "AbortError") {
				setError(err.message);
				console.error("Failed to fetch emails:", err);
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		const interval = setInterval(() => {
			if (isVisibleRef.current) {
				fetchEmails();
			}
		}, REFRESH_INTERVAL);

		const onVisibility = () => {
			isVisibleRef.current = !document.hidden;
			if (document.hidden) {
				if (abortControllerRef.current) {
					abortControllerRef.current.abort();
				}
			} else {
				fetchEmails();
			}
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisibility);
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, [fetchEmails]);

	useEffect(() => {
		if (emails.length > previousEmailsLength.current) {
			if (Notification.permission === "granted") {
				new Notification("New Email", {
					body: "You have received a new email!",
				});
			}
		}
		previousEmailsLength.current = emails.length;
	}, [emails.length]);

	useEffect(() => {
		setEmails(initialEmails);
		previousEmailsLength.current = initialEmails.length;
	}, [initialEmails]);

	return (
		<div className="flex flex-col w-full min-h-0 gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Mail className="h-5 w-5" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-semibold text-foreground">
							{locale.email_list}
						</span>
						<span className="text-xs text-muted-foreground">
							{emails.length} {emails.length === 1 ? "email" : "emails"}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{error && (
						<span className="text-xs text-destructive hidden sm:inline">
							Failed to refresh
						</span>
					)}
					<Button
						size="sm"
						variant="outline"
						onClick={fetchEmails}
						disabled={isLoading}
						className="gap-2"
					>
						<RefreshCw
							className={cn("h-4 w-4", {
								"animate-spin": isLoading,
							})}
						/>
						<span className="hidden sm:inline">Refresh</span>
					</Button>
				</div>
			</div>

			<div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card card-shadow overflow-hidden">
				<ScrollArea className="h-full max-h-[500px] custom-scrollbar">
					{emails.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-16 px-4">
							<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
								<Inbox className="h-8 w-8 text-muted-foreground/50" />
							</div>
							<p className="text-sm font-medium text-muted-foreground">
								{locale.email_empty}
							</p>
							<p className="text-xs text-muted-foreground/60 mt-1">
								Waiting for incoming emails...
							</p>
						</div>
					) : (
						<div className="divide-y divide-border/50">
							{emails.map((email) => (
								<NavLink
									prefetch="viewport"
									viewTransition
									to={`/emails/${email.id}`}
									key={email.id}
									className={({ isActive }) =>
										cn(
											"flex items-center gap-4 px-4 py-4 transition-all duration-200",
											"hover:bg-muted/50",
											isActive && "bg-primary/5 border-l-4 border-l-primary pl-3"
										)
									}
								>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
										<Mail className="h-4 w-4" />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-foreground truncate">
											{email.subject || "(No Subject)"}
										</p>
									</div>
									<span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
										{email.createdAt}
									</span>
								</NavLink>
							))}
						</div>
					)}
				</ScrollArea>
			</div>
		</div>
	);
}
