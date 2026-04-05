import { Turnstile } from "@marsidev/react-turnstile";
import { Form, type useNavigation } from "@remix-run/react";
import { Loader2, Sparkles, AtSign } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Locale } from "~/locales/locale";

const DEFAULT_TEST_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

interface AuthFormProps {
	turnstileSiteKey: string | undefined;
	lang: string;
	locale: Locale;
	domain: string;
	navigation: ReturnType<typeof useNavigation>;
	setToken: (token: string) => void;
	token: string;
	emailError?: string;
	defaultLocalPart?: string;
}

export function AuthForm({
	turnstileSiteKey,
	lang,
	locale,
	domain,
	navigation,
	setToken,
	token,
	emailError,
	defaultLocalPart,
}: AuthFormProps) {
	const [isDark, setIsDark] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		setIsDark(mql.matches);

		const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	const handleTurnstileSuccess = useCallback(
		(token: string) => {
			setToken(token);
		},
		[setToken]
	);

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Sparkles className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-lg font-semibold text-foreground">
							Get Started
						</h3>
						<p className="text-sm text-muted-foreground">
							Create a temporary email address
						</p>
					</div>
				</div>
			</div>

			<Form method="POST" className="space-y-5">
				<div className="space-y-3">
					<Label htmlFor="localPart" className="text-sm font-medium">
						{locale.custom_email.label}
					</Label>
					<div className="flex items-center gap-3">
						<div className="relative flex-1">
							<Input
								id="localPart"
								name="localPart"
								placeholder={locale.custom_email.placeholder}
								defaultValue={defaultLocalPart}
								autoComplete="off"
								className="pr-24"
							/>
							<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
								<AtSign className="h-3 w-3" />
								<span className="font-medium">{domain}</span>
							</div>
						</div>
					</div>
					<p className="text-xs text-muted-foreground">
						{locale.custom_email.hint}
					</p>
					{emailError && (
						<p className="text-xs text-destructive font-medium">
							{emailError}
						</p>
					)}
				</div>

				{mounted && (
					<div className="rounded-xl overflow-hidden border border-border/50">
						<Turnstile
							siteKey={turnstileSiteKey || DEFAULT_TEST_TURNSTILE_SITE_KEY}
							options={{
								theme: isDark ? "dark" : "light",
								refreshExpired: "auto",
								language: lang,
							}}
							onSuccess={handleTurnstileSuccess}
							className="flex items-center justify-center"
						/>
					</div>
				)}

				<Button
					type="submit"
					disabled={navigation.state === "submitting" || token === ""}
					className="w-full"
					size="lg"
				>
					{navigation.state === "submitting" ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>Creating...</span>
						</>
					) : (
						<>
							<Sparkles className="h-4 w-4" />
							<span>{locale?.button}</span>
						</>
					)}
				</Button>
			</Form>
		</div>
	);
}
