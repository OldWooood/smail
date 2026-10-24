import { Bell, Inbox, RefreshCw } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import type { Locale } from "~/locales/locale";

export interface Email {
	id: string;
	subject: string | null;
	createdAt: string;
	senderLabel?: string;
}

interface EmailListProps {
	initialEmails: Email[];
	locale: Locale;
	lang: string;
	mailbox: string;
	selectedId?: string;
	onOpen?: (email: Email) => void;
}

const REFRESH_INTERVAL = 10000;
const SEEN_KEY_PREFIX = "smail_seen_emails:";

type NotificationState = "unsupported" | "default" | "granted" | "denied";

const AVATAR_STYLES = [
	"bg-primary/10 text-primary",
	"bg-chart-3/15 text-chart-3",
	"bg-chart-4/15 text-chart-4",
	"bg-chart-2/15 text-chart-2",
	"bg-muted text-muted-foreground",
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

function seenKey(mailbox: string) {
	return `${SEEN_KEY_PREFIX}${mailbox.toLowerCase()}`;
}

function loadSeenIds(key: string): Set<string> {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
	} catch {
		return new Set();
	}
}

function persistSeenIds(key: string, seen: Set<string>) {
	try {
		localStorage.setItem(key, JSON.stringify([...seen].slice(-300)));
	} catch {
		// storage unavailable, unread state stays in memory only
	}
}

function emailsChanged(a: Email[], b: Email[]) {
	if (a.length !== b.length) return true;
	return a.some((email, i) => email.id !== b[i].id);
}

const EmailListItem = memo(function EmailListItem({
	email,
	isUnread,
	isSelected,
	onSelect,
	onOpen,
	detailHref,
	locale,
}: {
	email: Email;
	isUnread: boolean;
	isSelected: boolean;
	/** Stable reference (useCallback) so memo's shallow compare can bail out. */
	onSelect: (id: string) => void;
	onOpen?: (email: Email) => void;
	detailHref: (id: string) => string;
	locale: Locale;
}) {
	return (
		<NavLink
			reloadDocument
			to={detailHref(email.id)}
			aria-current={isSelected ? "true" : undefined}
			onClick={(event) => {
				onSelect(email.id);
				if (onOpen) {
					event.preventDefault();
					onOpen(email);
				}
			}}
			className={cn(
				"group relative flex items-center gap-3 px-4 py-3.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
				isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40",
				isUnread && "animate-slide-up",
			)}
		>
			{isSelected && (
				<span
					aria-hidden
					className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
				/>
			)}
			<span
				aria-hidden
				className={cn(
					"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase",
					avatarStyle(email.senderLabel || email.subject || email.id),
				)}
			>
				{avatarLabel(email)}
			</span>
			<div className="min-w-0 flex-1">
				<p
					className={cn(
						"truncate text-sm text-foreground",
						isUnread ? "font-semibold" : "font-medium",
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
		</NavLink>
	);
});

export function EmailList({
	initialEmails,
	locale,
	lang,
	mailbox,
	selectedId,
	onOpen,
}: EmailListProps) {
	const [emails, setEmails] = useState<Email[]>(initialEmails);
	const [isManualRefreshing, setIsManualRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
	const [mounted, setMounted] = useState(false);
	const [notificationState, setNotificationState] =
		useState<NotificationState>("unsupported");

	const previousIdsRef = useRef<Set<string>>(
		new Set(initialEmails.map((e) => e.id)),
	);
	const abortControllerRef = useRef<AbortController | null>(null);
	const etagRef = useRef<string | null>(null);
	const isVisibleRef = useRef(true);
	const mailboxRef = useRef(mailbox);
	const originalTitleRef = useRef<string>("");

	const storageKey = seenKey(mailbox);

	const fetchEmails = useCallback(
		async (opts?: { silent?: boolean }) => {
			const silent = opts?.silent ?? false;
			if (typeof navigator !== "undefined" && !navigator.onLine) return;
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}

			abortControllerRef.current = new AbortController();
			if (!silent) {
				setIsManualRefreshing(true);
				setError(null);
			}

			try {
				const response = await fetch(
					`/api/emails?lang=${encodeURIComponent(lang)}`,
					{
						signal: abortControllerRef.current.signal,
						headers: etagRef.current
							? { "If-None-Match": etagRef.current }
							: undefined,
					},
				);

				if (response.status === 304) {
					return;
				}

				if (response.status === 401) {
					// Mailbox expired or was deleted from another tab. The response
					// also clears the stale session cookie, so a reload lands on the
					// create-mailbox screen. Guard against a reload loop if cookies
					// are blocked.
					const key = "smail_session_expired_reload";
					let lastReload = 0;
					try {
						lastReload = Number(sessionStorage.getItem(key) || 0);
					} catch {
						// storage unavailable
					}
					if (Date.now() - lastReload > 10_000) {
						try {
							sessionStorage.setItem(key, String(Date.now()));
						} catch {
							// storage unavailable
						}
						window.location.reload();
					} else {
						setError("Mailbox expired");
					}
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
				if (!silent) setError(null);
			} catch (err) {
				if (err instanceof Error && err.name !== "AbortError") {
					if (!silent) setError(err.message);
					console.error("Failed to fetch emails:", err);
				}
			} finally {
				if (!silent) setIsManualRefreshing(false);
			}
		},
		[lang],
	);

	const fetchSilent = useCallback(
		() => fetchEmails({ silent: true }),
		[fetchEmails],
	);
	const fetchManual = useCallback(
		() => fetchEmails({ silent: false }),
		[fetchEmails],
	);

	// (Re)initialize per mailbox so seen-state, ETag and baseline never leak
	// across addresses.
	useEffect(() => {
		setMounted(true);
		if (typeof document !== "undefined" && !originalTitleRef.current) {
			originalTitleRef.current = document.title;
		}
		if (typeof Notification !== "undefined") {
			setNotificationState(Notification.permission as NotificationState);
		}
	}, []);

	useEffect(() => {
		const key = seenKey(mailbox);
		const seen = loadSeenIds(key);
		for (const email of initialEmails) {
			seen.add(email.id);
		}
		persistSeenIds(key, seen);
		setSeenIds(seen);
		if (mailboxRef.current !== mailbox) {
			mailboxRef.current = mailbox;
			etagRef.current = null;
			setEmails(initialEmails);
			previousIdsRef.current = new Set(initialEmails.map((e) => e.id));
			setError(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mailbox, initialEmails]);

	useEffect(() => {
		const interval = setInterval(() => {
			if (isVisibleRef.current) {
				fetchSilent();
			}
		}, REFRESH_INTERVAL);

		const onVisibility = () => {
			isVisibleRef.current = !document.hidden;
			if (document.hidden) {
				if (abortControllerRef.current) {
					abortControllerRef.current.abort();
				}
			} else {
				fetchSilent();
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
	}, [fetchSilent]);

	// Notify on genuinely new IDs (not just length changes), and flash the
	// document title so users without Notification permission still notice.
	useEffect(() => {
		const prev = previousIdsRef.current;
		const fresh = emails.filter((e) => !prev.has(e.id));
		previousIdsRef.current = new Set(emails.map((e) => e.id));
		if (fresh.length > 0 && prev.size > 0) {
			if (
				typeof Notification !== "undefined" &&
				Notification.permission === "granted"
			) {
				try {
					new Notification(locale.list.notification_title, {
						body: locale.list.notification_body,
					});
				} catch {
					// Notification construction can throw in some browsers; title flash below still applies.
				}
			}
		}
	}, [emails, locale.list.notification_title, locale.list.notification_body]);

	const unreadCount = mounted
		? emails.filter((e) => !seenIds.has(e.id)).length
		: 0;

	useEffect(() => {
		if (typeof document === "undefined") return;
		if (unreadCount > 0) {
			document.title = `(${unreadCount}) ${originalTitleRef.current || "TempEmail"}`;
		} else if (originalTitleRef.current) {
			document.title = originalTitleRef.current;
		}
	}, [unreadCount]);

	const enableNotifications = useCallback(async () => {
		if (typeof Notification === "undefined") return;
		try {
			const result = await Notification.requestPermission();
			setNotificationState(result as NotificationState);
		} catch {
			setNotificationState("denied");
		}
	}, []);

	const markSeen = useCallback(
		(id: string) => {
			setSeenIds((prev) => {
				if (prev.has(id)) return prev;
				const next = new Set(prev);
				next.add(id);
				persistSeenIds(storageKey, next);
				return next;
			});
		},
		[storageKey],
	);

	const detailHref = useCallback(
		(id: string) => (lang === "en" ? `/emails/${id}` : `/${lang}/emails/${id}`),
		[lang],
	);

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3">
			<div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
				<div className="flex items-baseline gap-2">
					<h1 className="text-base font-semibold text-foreground">
						{locale.email_list}
					</h1>
					<span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
						{emails.length}{" "}
						{emails.length === 1
							? locale.list.count_one
							: locale.list.count_other}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{error && (
						<span className="text-xs text-destructive-text hidden sm:inline">
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
						onClick={fetchManual}
						disabled={isManualRefreshing}
						aria-label={locale.list.refresh}
						aria-busy={isManualRefreshing}
						className="gap-2"
					>
						<RefreshCw
							className={cn("h-4 w-4", {
								"animate-spin": isManualRefreshing,
							})}
						/>
						<span className="hidden sm:inline">{locale.list.refresh}</span>
					</Button>
				</div>
			</div>

			<div
				aria-live="polite"
				className="panel flex-1 min-h-0 overflow-hidden rounded-2xl"
			>
				<ScrollArea className="h-full custom-scrollbar">
					{emails.length === 0 ? (
						<div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
							<div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
								<Inbox className="h-8 w-8" />
							</div>
							<p className="text-base font-semibold text-foreground">
								{locale.email_empty}
							</p>
							<p className="mt-1 max-w-xs text-sm text-muted-foreground">
								{locale.list.waiting}
							</p>
							<p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground/80">
								{locale.empty_hint}
							</p>
						</div>
					) : (
						<div className="divide-y divide-border/50">
							{emails.map((email) => (
								<EmailListItem
									key={email.id}
									email={email}
									isUnread={mounted && !seenIds.has(email.id)}
									isSelected={selectedId === email.id}
									onSelect={markSeen}
									onOpen={onOpen}
									detailHref={detailHref}
									locale={locale}
								/>
							))}
						</div>
					)}
				</ScrollArea>
			</div>
		</div>
	);
}
