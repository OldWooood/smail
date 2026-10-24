import type { Locale } from "~/locales/locale";

interface HeroSectionProps {
	children: React.ReactNode;
	locale: Locale;
}

export function HeroSection({ children, locale }: HeroSectionProps) {
	return (
		<section className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
			<div className="relative mx-auto flex min-h-full w-full max-w-5xl items-center px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
				<div className="mx-auto w-full max-w-3xl text-center">
					<div className="animate-reveal">
						<h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
							{locale.hero.title_a} <br className="hidden sm:block" />
							<span className="text-primary">{locale.hero.title_b}</span>
						</h1>
						<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
							{locale.hero.subtitle}
						</p>
					</div>

					<div className="mx-auto mt-8 max-w-2xl text-left sm:mt-10">
						{children}
					</div>
				</div>
			</div>
		</section>
	);
}
