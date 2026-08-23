import { MailCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "~/locales/locale";

interface ArrivalChipProps {
	address: string;
	locale: Locale;
}

export function ArrivalChip({ address, locale }: ArrivalChipProps) {
	const reduce = useReducedMotion();

	if (reduce) return null;

	return (
		<motion.div
			className="glass pointer-events-none absolute inset-x-0 top-full mx-auto mt-4 w-[min(340px,100%)] rounded-2xl p-3"
			initial={false}
			animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -6] }}
			transition={{
				duration: 6,
				times: [0, 0.12, 0.85, 1],
				repeat: Number.POSITIVE_INFINITY,
				repeatDelay: 2.5,
				ease: "easeOut",
			}}
		>
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
		</motion.div>
	);
}
