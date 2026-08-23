import { NavLink } from "@remix-run/react";
import { Bell, Inbox, Mail, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import type { Locale } from "~/locales/locale";

interface Email {
	id: string;
	subject: string | null;
	createdAt: string;
	senderLabel?: string;
}

interface EmailListProps {
	initialEmails: Email[];
	locale: Locale;
}

const REFRESH_INTERVAL = 10000;
const SEEN_STORAGE_KEY = "smail_seen_emails";

type NotificationState = "unsupported" | "default" | "granted" | "denied";

const AVATAR_STYLES = [
	"bg-chart-1/15 text-chart-1",
	"bg-chart-2/15 text-chart-2",
	"bg-chart-3/15 text-chart-3",
	"bg-chart-4/15 text-chart-4",
	"bg-chart-5/15 text-chart-5",
];

function avatarStyle(seed: string) {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) | 0;
	}
	return AVATAR_STYLES[Math.abs(hash) % AVATAR_STYLES.length];
}

function avatarLabel(email: Email) {
	const source = email.senderLabel || email.subject || "@";
	return [...source.trim()][0]?.toUpperCase() || "@";
}

function loadSeenIds(): Set<string> {
	try {
		const raw = localStorage.getItem(SEEN_STORAGE_KEY);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
	} catch {
		return new Set();
	}
}

function persistSeenIds(seen: Set<string>) {
	try {
		localStorage.setItem(
			SEEN_STORAGE_KEY,
			JSON.stringify([...seen].slice(-300)),
		);
	} catch {
		// storage unavailable, unread state stays in memory only
	}
}

function emailsChanged(a: Email[], b: Email[]) {
	if (a.length !== b.length) return true;
	return a.some((email, i) => email.id !== b[i].id);
}

export function EmailList({ initialEmails, locale }: EmailListProps) {
	const [emails, setEmails] = useState<Email[]>(initialEmails);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
	const [mounted, setMounted] = useState(false);
	const [notificationState, setNotificationState] =
		useState<NotificationState>("unsupported");

	const previousEmailsLength = useRef(initialEmails.length);
	const abortControllerRef = useRef<AbortController | null>(null);
	const etagRef = useRef<string | null>(null);
	const isVisibleRef = useRef(true);

	const fetchEmails = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		abortControllerRef.current = new AbortController();
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/emails", {
				signal: abortControllerRef.current.signal,
				headers: etagRef.current
					? { "If-None-Match": etagRef.current }
					: undefined,
			});

			if (response.status === 304) {
				return;
			}

			if (!response.ok) {
				throw new Error("Failed to fetch emails");
			}

			const newEtag = response.headers.get("ETag");
			if (newEtag) {
				etagRef.current = newEtag;
			}

			const data = (await response.json()) as { emails: Email[] };
			setEmails((prev) =>
				emailsChanged(prev, data.emails) ? data.emails : prev,
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
		setMounted(true);

		const seen = loadSeenIds();
		for (const email of initialEmails) {
			seen.add(email.id);
		}
		persistSeenIds(seen);
		setSeenIds(seen);

		if (typeof Notification !== "undefined") {
			setNotificationState(Notification.permission as NotificationState);
		}
	}, [initialEmails]);

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
			if (
				typeof Notification !== "undefined" &&
				Notification.permission === "granted"
			) {
				new Notification(locale.list.notification_title, {
					body: locale.list.notification_body,
				});
			}
		}
		previousEmailsLength.current = emails.length;
	}, [
		emails.length,
		locale.list.notification_title,
		locale.list.notification_body,
	]);

	useEffect(() => {
		setEmails(initialEmails);
		previousEmailsLength.current = initialEmails.length;
	}, [initialEmails]);

	const enableNotifications = useCallback(async () => {
		if (typeof Notification === "undefined") return;
		try {
			const result = await Notification.requestPermission();
			setNotificationState(result as NotificationState);
		} catch {
			setNotificationState("denied");
		}
	}, []);

	const markSeen = useCallback((id: string) => {
		setSeenIds((prev) => {
			if (prev.has(id)) return prev;
			const next = new Set(prev);
			next.add(id);
			persistSeenIds(next);
			return next;
		});
	}, []);

	return (
		<div className="flex flex-col w-full min-h-0 gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
						<Mail className="h-5 w-5" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-semibold text-foreground">
							{locale.email_list}
						</span>
						<span className="font-mono text-xs text-muted-foreground">
							{emails.length}{" "}
							{emails.length === 1
								? locale.list.count_one
								: locale.list.count_other}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{error && (
						<span className="text-xs text-destructive hidden sm:inline">
							{locale.list.refresh_failed}
						</span>
					)}
					{mounted && notificationState === "default" && (
						<Button
							size="icon"
							variant="outline"
							onClick={enableNotifications}
							title={locale.list.notify_enable}
							aria-label={locale.list.notify_enable}
							className="relative h-9 w-9 shrink-0"
						>
							<Bell className="h-4 w-4" />
							<span className="absolute right-1.5 top-1.5 flex h-1.5 w-1.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
								<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
							</span>
						</Button>
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
						<span className="hidden sm:inline">{locale.list.refresh}</span>
					</Button>
				</div>
			</div>

			<div className="glass flex-1 min-h-0 overflow-hidden rounded-2xl">
				<ScrollArea className="h-full max-h-[420px] sm:max-h-[520px] lg:max-h-[calc(100dvh-13rem)] custom-scrollbar">
					{emails.length === 0 ? (
						<div className="flex flex-col items-center justify-center px-4 py-16">
							<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
								<Inbox className="h-8 w-8" />
							</div>
							<p className="text-sm font-medium text-muted-foreground">
								{locale.email_empty}
							</p>
							<p className="mt-1 text-xs text-muted-foreground/60">
								{locale.list.waiting}
							</p>
						</div>
					) : (
						<div className="divide-y divide-border/50">
							{emails.map((email) => {
								const isUnread = mounted && !seenIds.has(email.id);
								return (
									<NavLink
										prefetch="render"
										viewTransition
										to={`/emails/${email.id}`}
										key={email.id}
										onClick={() => markSeen(email.id)}
										className={({ isActive }) =>
											cn(
												"group relative flex items-center gap-3 px-4 py-3.5 transition-all duration-200",
												"hover:bg-muted/40",
												isActive && "bg-primary/[0.07]",
												isUnread && "animate-slide-up",
											)
										}
									>
										{({ isActive }) => (
											<>
												<span
													aria-hidden
													className={cn(
														"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase",
														avatarStyle(
															email.senderLabel || email.subject || email.id,
														),
													)}
												>
													{avatarLabel(email)}
												</span>
												<div className="min-w-0 flex-1">
													<p
														className={cn(
															"truncate text-sm text-foreground",
															isUnread || isActive
																? "font-semibold"
																: "font-medium",
														)}
													>
														{email.subject || locale.list.no_subject}
													</p>
													{email.senderLabel && (
														<p className="mt-0.5 truncate text-xs text-muted-foreground">
															{email.senderLabel}
														</p>
													)}
												</div>
												<span className="ml-2 flex shrink-0 flex-col items-end gap-1.5">
													<span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
														{email.createdAt}
													</span>
													<span
														className={cn(
															"h-1.5 w-1.5 rounded-full transition-opacity",
															isUnread ? "bg-primary opacity-100" : "opacity-0",
														)}
													/>
												</span>
											</>
										)}
									</NavLink>
								);
							})}
						</div>
					)}
				</ScrollArea>
			</div>
		</div>
	);
}
