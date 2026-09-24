import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { AtSign, Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Form, type useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
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
	verifyError?: string;
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
	verifyError: serverVerifyError,
	defaultLocalPart,
}: AuthFormProps) {
	const [isDark, setIsDark] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [verifyError, setVerifyError] = useState(false);

	const turnstileRef = useRef<TurnstileInstance>(null);
	const hasExecutedRef = useRef(false);
	const pendingExecuteRef = useRef(false);
	const [widgetReady, setWidgetReady] = useState(false);

	useEffect(() => {
		setMounted(true);
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		setIsDark(mql.matches);

		const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	const isVerified = token !== "";

	const handleTurnstileSuccess = useCallback(
		(token: string) => {
			setIsVerifying(false);
			setVerifyError(false);
			setToken(token);
		},
		[setToken],
	);

	useEffect(() => {
		if (widgetReady && pendingExecuteRef.current) {
			pendingExecuteRef.current = false;
			turnstileRef.current?.execute();
		}
	}, [widgetReady]);

	// Turnstile tokens are single-use and expire quickly: after a server-side
	// rejection the old token must be discarded and the widget reset,
	// otherwise the next submit would reuse a consumed token.
	useEffect(() => {
		if (serverVerifyError) {
			setToken("");
			setIsVerifying(false);
			setVerifyError(true);
			hasExecutedRef.current = false;
			pendingExecuteRef.current = false;
			turnstileRef.current?.reset();
		}
	}, [serverVerifyError, setToken]);

	const handleVerify = useCallback(() => {
		if (isVerifying || isVerified || navigation.state === "submitting") {
			return;
		}
		setVerifyError(false);
		setIsVerifying(true);
		if (hasExecutedRef.current) {
			turnstileRef.current?.reset();
		}
		hasExecutedRef.current = true;
		if (widgetReady) {
			turnstileRef.current?.execute();
		} else {
			pendingExecuteRef.current = true;
		}
	}, [isVerifying, isVerified, navigation.state, widgetReady]);

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Sparkles className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-lg font-semibold text-foreground">
							{locale.form.get_started}
						</h3>
						<p className="text-sm text-muted-foreground">
							{locale.form.create_address}
						</p>
					</div>
				</div>
			</div>

			<Form method="POST" viewTransition className="space-y-5">
				<input type="hidden" name="cf-turnstile-response" value={token} />
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
						<p role="alert" className="text-xs text-destructive font-medium">
							{emailError}
						</p>
					)}
					{serverVerifyError && (
						<p role="alert" className="text-xs text-destructive font-medium">
							{serverVerifyError}
						</p>
					)}
				</div>

				{mounted && (
					<div className="relative">
						<button
							type="button"
							aria-pressed={isVerified}
							onClick={handleVerify}
							disabled={isVerifying || navigation.state === "submitting"}
							className={cn(
								"flex w-full items-center gap-3 rounded-xl border bg-background px-4 py-3 text-left text-sm transition-all duration-200",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								isVerified
									? "border-primary/40 bg-primary/5"
									: verifyError
										? "border-destructive/60 hover:border-destructive/80"
										: "border-border/50 hover:border-ring/50",
								(isVerifying || navigation.state === "submitting") &&
									"cursor-not-allowed opacity-70",
							)}
						>
							<span
								className={cn(
									"flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200",
									isVerified
										? "border-primary bg-primary text-primary-foreground"
										: "border-input",
								)}
							>
								{isVerifying && (
									<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
								)}
								{isVerified && <Check className="h-3.5 w-3.5" />}
							</span>
							<span
								className={cn(
									"text-sm",
									isVerified
										? "text-foreground"
										: verifyError
											? "text-destructive"
											: "text-muted-foreground",
								)}
							>
								{isVerifying
									? locale.form.verifying
									: isVerified
										? locale.form.verified
										: verifyError
											? locale.form.verify_retry
											: locale.form.verify}
							</span>
						</button>
						<div
							className={cn(
								"absolute inset-x-0 top-full z-20 flex justify-center pt-2",
								isVerified
									? // 验证通过后彻底隐藏，避免遮挡下方的获取邮箱按钮
										"hidden"
									: // 未验证时让容器本身透传点击，仅小组件可交互，避免隐形 iframe 阻挡按钮
										"pointer-events-none [&>div]:pointer-events-auto",
							)}
						>
							<Turnstile
								ref={turnstileRef}
								siteKey={turnstileSiteKey || DEFAULT_TEST_TURNSTILE_SITE_KEY}
								options={{
									theme: isDark ? "dark" : "light",
									refreshExpired: "auto",
									language: lang,
									execution: "execute",
									appearance: "interaction-only",
								}}
								onWidgetLoad={() => setWidgetReady(true)}
								onSuccess={handleTurnstileSuccess}
								onExpire={() => {
									setToken("");
									setIsVerifying(false);
									// Token expired before submit: force explicit re-verify.
									if (hasExecutedRef.current) setVerifyError(true);
								}}
								onError={() => {
									setIsVerifying(false);
									setVerifyError(true);
									setToken("");
								}}
							/>
						</div>
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
							<span>{locale.form.creating}</span>
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
