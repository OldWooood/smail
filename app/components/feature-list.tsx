import {
	CircleDollarSignIcon,
	CodeIcon,
	ShieldIcon,
	SwatchBookIcon,
} from "lucide-react";
import type { Locale } from "~/locales/locale";

interface FeatureListProps {
	locale: Locale;
}

const featureIcons = [
	<CodeIcon key="code" className="size-5 text-foreground" />,
	<CircleDollarSignIcon key="dollar" className="size-5 text-foreground" />,
	<SwatchBookIcon key="swatch" className="size-5 text-foreground" />,
	<ShieldIcon key="shield" className="size-5 text-foreground" />,
];

export function FeatureList({ locale }: FeatureListProps) {
	return (
		<div className="flex flex-col flex-1 w-full min-h-0">
			{locale?.features.map((feature, idx) => (
				<div
					key={`feature-${idx}`}
					className="flex flex-col gap-3 py-6"
				>
					<div className="flex items-center gap-4">
						<span className="font-display text-2xl tracking-[0.12em] text-foreground/80">
							{String(idx + 1).padStart(2, "0")}
						</span>
						<div className="flex size-10 items-center justify-center border-2 border-foreground/10 bg-background shadow-[4px_4px_0_0_hsl(var(--foreground)/0.08)]">
							{featureIcons[idx]}
						</div>
					</div>
					<div className="flex flex-col gap-2">
						<span className="text-lg font-semibold uppercase tracking-[0.14em]">
							{feature.title}
						</span>
						<span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
							{feature.description}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}
