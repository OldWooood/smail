import { useEffect, useRef, useState } from "react";
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
	const glowRef = useRef<HTMLDivElement>(null);
	const [glowVisible, setGlowVisible] = useState(true);

	// Pause the large blurred glow animations while offscreen / tab hidden.
	useEffect(() => {
		const el = glowRef.current;
		if (!el) return;
		if (typeof IntersectionObserver === "undefined") return;
		const io = new IntersectionObserver(
			([entry]) => setGlowVisible(entry.isIntersecting && !document.hidden),
			{ threshold: 0 },
		);
		io.observe(el);
		const onVis = () => {
			if (document.hidden) setGlowVisible(false);
			else {
				const rect = el.getBoundingClientRect();
				setGlowVisible(rect.bottom > 0 && rect.top < window.innerHeight);
			}
		};
		document.addEventListener("visibilitychange", onVis);
		return () => {
			io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, []);

	return (
		<section className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
			<div className="relative mx-auto flex min-h-full w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
				<div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
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
						<div
							ref={glowRef}
							aria-hidden
							className="pointer-events-none absolute -inset-12"
							style={glowVisible ? undefined : { animationPlayState: "paused" }}
						>
							<div
								className="light-pool light-pool-a absolute right-0 top-0 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
								style={
									glowVisible ? undefined : { animationPlayState: "paused" }
								}
							/>
							<div
								className="light-pool light-pool-b absolute bottom-0 left-10 h-56 w-56 rounded-full bg-chart-3/15 blur-3xl"
								style={
									glowVisible ? undefined : { animationPlayState: "paused" }
								}
							/>
						</div>
						<div className="animate-scale-in relative">{children}</div>
						<ArrivalChip address={sampleAddress} locale={locale} />
					</div>
				</div>
			</div>
		</section>
	);
}
