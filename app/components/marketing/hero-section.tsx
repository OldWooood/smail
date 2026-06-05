interface HeroSectionProps {
  children: React.ReactNode;
}

export function HeroSection({ children }: HeroSectionProps) {
  return (
    <section className="relative min-h-[100dvh] flex items-center pt-20 sm:pt-24 pb-12 sm:pb-16 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.07) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 80% 50% at 50% 0%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 50% at 50% 0%, black, transparent 70%)",
        }}
      />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="grid gap-10 lg:grid-cols-[1fr_480px] lg:gap-16 items-center">
          <div className="space-y-6 animate-reveal">
            <div className="inline-flex h-8 items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 text-xs font-medium text-primary">
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse-slow" />
              Open Source
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] text-foreground leading-none">
              Temporary
              <br />
              <span className="gradient-text">Email Service</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
              A fast, private, and open-source temporary email service.
              No sign-up, no tracking. Just disposable addresses that work.
            </p>
          </div>

          <div className="animate-scale-in">{children}</div>
        </div>
      </div>
    </section>
  );
}
