import type { Locale } from "~/locales/locale";
import { ArrivalChip } from "./arrival-chip";

interface HeroSectionProps {
	children: React.ReactNode;
	sampleAddress: string;
	locale: Locale;
}

export function HeroSection({
	children,
	sampleAddress,
	locale,
}: HeroSectionProps) {
	return (
		<section className="relative flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden pt-20 sm:pt-24 pb-20">
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage:
						"radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.06) 1px, transparent 0)",
					backgroundSize: "32px 32px",
					maskImage:
						"radial-gradient(ellipse 80% 50% at 50% 0%, black, transparent 70%)",
					WebkitMaskImage:
						"radial-gradient(ellipse 80% 50% at 50% 0%, black, transparent 70%)",
				}}
			/>
			<div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
					<div className="animate-reveal space-y-6">
						<div className="glass inline-flex h-8 items-center gap-2 rounded-full px-4 text-xs font-medium text-primary">
							<span className="h-1.5 w-1.5 rounded-full bg-primary" />
							{locale.hero.badge}
						</div>
						<h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl font-display">
							{locale.hero.title_a}
							<br className="hidden sm:block" />
							<span className="text-primary">{locale.hero.title_b}</span>
						</h1>
						<p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
							{locale.hero.subtitle}
						</p>
					</div>

					<div className="relative">
						<div aria-hidden className="pointer-events-none absolute -inset-12">
							<div className="light-pool light-pool-a absolute right-0 top-0 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
							<div className="light-pool light-pool-b absolute bottom-0 left-10 h-56 w-56 rounded-full bg-chart-3/15 blur-3xl" />
						</div>
						<div className="animate-scale-in relative">{children}</div>
						<ArrivalChip address={sampleAddress} locale={locale} />
					</div>
				</div>
			</div>
		</section>
	);
}
