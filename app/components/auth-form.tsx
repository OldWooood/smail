import { Turnstile } from "@marsidev/react-turnstile";
import { Form, type useNavigation } from "@remix-run/react";
import { LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
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

	useEffect(() => {
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		setIsDark(mql.matches);

		function onChange(e: MediaQueryListEvent) {
			setIsDark(e.matches);
		}

		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return (
		<Form method="POST" className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<Label htmlFor="localPart">{locale.custom_email.label}</Label>
				<div className="flex items-center gap-3">
					<Input
						id="localPart"
						name="localPart"
						placeholder={locale.custom_email.placeholder}
						defaultValue={defaultLocalPart}
						autoComplete="off"
					/>
					<span className="text-xs tracking-[0.08em] text-muted-foreground">
						@{domain}
					</span>
				</div>
				<div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
					{locale.custom_email.hint}
				</div>
				{emailError && (
					<div className="text-[10px] uppercase tracking-[0.2em] text-destructive">
						{emailError}
					</div>
				)}
			</div>
			<Turnstile
				siteKey={turnstileSiteKey || DEFAULT_TEST_TURNSTILE_SITE_KEY}
				options={{
					theme: isDark ? "dark" : "light",
					refreshExpired: "auto",
					language: lang,
				}}
				onSuccess={setToken}
				className="flex h-[65px] w-[320px] items-center justify-center border-2 border-foreground/10 bg-background shadow-[6px_6px_0_0_hsl(var(--foreground)/0.08)]"
			/>
			<Button
				disabled={navigation.state === "submitting" || token === ""}
				className="w-full"
			>
				{navigation.state === "submitting" ? (
					<LoaderIcon className="animate-spin" />
				) : (
					locale?.button
				)}
			</Button>
		</Form>
	);
}
