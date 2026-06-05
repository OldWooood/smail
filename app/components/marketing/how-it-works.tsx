import { Sparkles, Inbox, LogOut } from "lucide-react";

const steps = [
  {
    icon: Sparkles,
    title: "Create",
    description: "Get a temporary email address in one click. Customize your username or get a random one.",
    color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    icon: Inbox,
    title: "Receive",
    description: "Emails arrive instantly. Your inbox refreshes automatically every 10 seconds.",
    color: "text-emerald-500",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    icon: LogOut,
    title: "Dispose",
    description: "No data stored. No tracking. Your temporary address expires when you're done.",
    color: "text-amber-500",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 sm:py-28 bg-secondary/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-18">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            How it works
          </h2>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Three simple steps to a private, disposable email address.
          </p>
        </div>

        <div className="relative grid gap-10 sm:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative flex flex-col items-center text-center">
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute left-[60%] top-8 w-[80%] h-px bg-gradient-to-r from-primary/30 via-border/50 to-transparent" />
                )}
                <div className="relative z-10 mb-6">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[80px] font-bold text-foreground/[0.04] select-none pointer-events-none leading-none tracking-[-0.04em]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.gradient} ring-1 ring-border/50`}
                  >
                    <Icon className={`h-7 w-7 ${step.color}`} />
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground max-w-xs">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
