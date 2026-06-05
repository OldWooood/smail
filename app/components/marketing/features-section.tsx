import {
  Code2,
  Wallet,
  Palette,
  Shield,
} from "lucide-react";
import type { Locale } from "~/locales/locale";

interface FeaturesSectionProps {
  locale: Locale;
}

const iconConfig = [
  { icon: Code2, accent: "border-t-blue-500/40", gradient: "from-blue-500/20 to-cyan-500/20", color: "text-blue-500" },
  { icon: Wallet, accent: "border-t-emerald-500/40", gradient: "from-emerald-500/20 to-teal-500/20", color: "text-emerald-500" },
  { icon: Palette, accent: "border-t-amber-500/40", gradient: "from-amber-500/20 to-orange-500/20", color: "text-amber-500" },
  { icon: Shield, accent: "border-t-rose-500/40", gradient: "from-rose-500/20 to-pink-500/20", color: "text-rose-500" },
];

export function FeaturesSection({ locale }: FeaturesSectionProps) {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {locale.features.map((feature, idx) => {
            const config = iconConfig[idx] || iconConfig[0];
            const Icon = config.icon;
            return (
              <div
                key={feature.title}
                className={`group relative overflow-hidden rounded-xl border border-border/50 bg-card p-6 sm:p-8 card-shadow transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${config.accent} border-t-[3px]`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />
                <div className="relative">
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} ring-1 ring-border/50`}
                  >
                    <Icon className={`h-6 w-6 ${config.color}`} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
