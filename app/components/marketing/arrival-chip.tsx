import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "~/locales/locale";

interface ArrivalChipProps {
	address: string;
	locale: Locale;
}

function usePageVisible() {
	const [visible, setVisible] = useState(true);
	useEffect(() => {
		if (typeof document === "undefined") return;
		setVisible(!document.hidden);
		const onChange = () => setVisible(!document.hidden);
		document.addEventListener("visibilitychange", onChange);
		return () => document.removeEventListener("visibilitychange", onChange);
	}, []);
	return visible;
}

// Mirrors what motion's useReducedMotion did: start false so the SSR markup and
// the first client render agree, then sync (and keep syncing) on the client.
function usePrefersReducedMotion() {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(query.matches);
		const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);
	return reduced;
}

export function ArrivalChip({ address, locale }: ArrivalChipProps) {
	const pageVisible = usePageVisible();
	const reduceMotion = usePrefersReducedMotion();

	// Respect prefers-reduced-motion and pause when tab is hidden
	if (reduceMotion) return null;
	if (!pageVisible) return null;

	return (
		<div className="glass animate-arrival-chip pointer-events-none absolute inset-x-0 top-full mx-auto mt-4 w-[min(340px,100%)] rounded-2xl p-3">
			<div className="flex items-center gap-3">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<MailCheck className="h-4 w-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate text-xs font-semibold text-foreground">
						{locale.chip.welcome}
					</p>
					<p className="truncate font-mono text-[11px] text-muted-foreground">
						{address}
					</p>
				</div>
				<span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground/70">
					{locale.chip.just_now}
				</span>
			</div>
		</div>
	);
}
