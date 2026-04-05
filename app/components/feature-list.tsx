import {
	Code2,
	Wallet,
	Palette,
	Shield,
} from "lucide-react";
import type { Locale } from "~/locales/locale";

interface FeatureListProps {
	locale: Locale;
}

const features = [
	{
		icon: Code2,
		color: "from-blue-500/20 to-cyan-500/20",
		iconColor: "text-blue-500",
	},
	{
		icon: Wallet,
		color: "from-emerald-500/20 to-teal-500/20",
		iconColor: "text-emerald-500",
	},
	{
		icon: Palette,
		color: "from-amber-500/20 to-orange-500/20",
		iconColor: "text-amber-500",
	},
	{
		icon: Shield,
		color: "from-rose-500/20 to-pink-500/20",
		iconColor: "text-rose-500",
	},
];

export function FeatureList({ locale }: FeatureListProps) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{locale?.features.map((feature, idx) => {
				const config = features[idx] || features[0];
				const Icon = config.icon;
				
				return (
					<div
						key={`feature-${idx}`}
						className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 card-shadow transition-all duration-300 hover:card-shadow-hover hover:-translate-y-1"
					>
						<div className={`absolute inset-0 bg-gradient-to-br ${config.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
						
						<div className="relative">
							<div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${config.color}`}>
								<Icon className={`h-6 w-6 ${config.iconColor}`} />
							</div>
							
							<h3 className="mb-1 text-sm font-semibold text-foreground">
								{feature.title}
							</h3>
							<p className="text-xs leading-relaxed text-muted-foreground">
								{feature.description}
							</p>
						</div>
					</div>
				);
			})}
		</div>
	);
}
