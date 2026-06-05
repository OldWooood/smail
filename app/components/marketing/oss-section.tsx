import { Github } from "lucide-react";
import { Button } from "~/components/ui/button";

export function OssSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/[0.08] via-primary/[0.02] to-background p-8 sm:p-12">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-primary/[0.04] blur-3xl"
          />
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Open source and self-hosted
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              TempEmail is fully open source. You can deploy your own instance
              on Cloudflare Workers in minutes. No vendor lock-in, no limits.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg">
                <a
                  href="https://github.com/OldWooood/smail"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
