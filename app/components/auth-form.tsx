import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Loader2, Mail } from "lucide-react";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
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
	const formRef = useRef<HTMLFormElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const hasExecutedRef = useRef(false);
	const pendingExecuteRef = useRef(false);
	const pendingSubmitRef = useRef(false);
	const [widgetReady, setWidgetReady] = useState(false);

	useEffect(() => {
		const root = document.documentElement;
		const syncTheme = () => setIsDark(root.classList.contains("dark"));
		syncTheme();
		setMounted(true);

		const observer = new MutationObserver(syncTheme);
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	const isVerified = token !== "";

	useEffect(() => {
		if (emailError) inputRef.current?.focus();
	}, [emailError]);

	const handleTurnstileSuccess = useCallback(
		(nextToken: string) => {
			setIsVerifying(false);
			setVerifyError(false);
			setToken(nextToken);
		},
		[setToken],
	);

	// A verified token is useless until it is in the form. Submit once the
	// state and the hidden input have both caught up.
	useEffect(() => {
		if (token && pendingSubmitRef.current) {
			pendingSubmitRef.current = false;
			formRef.current?.requestSubmit();
		}
	}, [token]);

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
			pendingSubmitRef.current = false;
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

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		if (navigation.state === "submitting") {
			event.preventDefault();
			return;
		}
		if (isVerified) return;
		event.preventDefault();
		if (isVerifying) return;
		pendingSubmitRef.current = true;
		handleVerify();
	};

	return (
		<Form
			ref={formRef}
			method="POST"
			viewTransition
			aria-label={locale.button}
			aria-busy={isVerifying || navigation.state === "submitting"}
			className="relative space-y-3"
			onSubmit={handleSubmit}
		>
			<input type="hidden" name="cf-turnstile-response" value={token} />

			<div>
				<div className="mb-2 flex items-center justify-between px-1">
					<Label
						htmlFor="localPart"
						className="text-xs font-medium text-foreground/70"
					>
						{locale.custom_email.label}
					</Label>
				</div>

				<div
					className={cn(
						"composer rounded-2xl p-2 transition-colors duration-200",
						emailError && "border-destructive-text",
					)}
				>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<div className="flex min-w-0 flex-1 items-center gap-2 px-2 sm:px-3">
							<Input
								ref={inputRef}
								id="localPart"
								name="localPart"
								placeholder={locale.custom_email.placeholder}
								defaultValue={defaultLocalPart}
								autoComplete="off"
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								aria-invalid={emailError ? true : undefined}
								aria-describedby={
									emailError
										? "local-part-hint local-part-error"
										: "local-part-hint"
								}
								className="h-11 min-w-0 flex-1 border-0 bg-transparent px-0 font-mono text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-12"
							/>
							<span
								translate="no"
								className="shrink-0 font-mono text-sm text-muted-foreground"
							>
								@{domain}
							</span>
						</div>

						<Button
							type="submit"
							disabled={isVerifying || navigation.state === "submitting"}
							className="h-11 w-full shrink-0 rounded-xl px-6 sm:h-12 sm:w-auto"
							size="lg"
						>
							{navigation.state === "submitting" ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									<span>{locale.form.creating}</span>
								</>
							) : isVerifying ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									<span>{locale.form.verifying}</span>
								</>
							) : (
								<>
									<Mail className="h-4 w-4" />
									<span>{locale.button}</span>
								</>
							)}
						</Button>
					</div>
				</div>

				<div className="mt-2 space-y-1 px-1">
					<p id="local-part-hint" className="text-xs text-muted-foreground">
						{locale.custom_email.hint}
					</p>
					{emailError && (
						<p
							id="local-part-error"
							role="alert"
							className="text-xs font-medium text-destructive-text"
						>
							{emailError}
						</p>
					)}
					{!isVerifying &&
						!isVerified &&
						(verifyError || serverVerifyError) && (
							<p
								role="alert"
								className="text-xs font-medium text-destructive-text"
							>
								{locale.form.verify_retry}
							</p>
						)}
				</div>
			</div>

			<p className="sr-only" role="status" aria-live="polite">
				{isVerifying
					? locale.form.verifying
					: navigation.state === "submitting"
						? locale.form.creating
						: ""}
			</p>

			{mounted && !isVerified && (
				<div className="pointer-events-none absolute inset-x-0 top-full z-20 flex justify-center pt-2 [&>div]:pointer-events-auto">
					<Turnstile
						ref={turnstileRef}
						siteKey={turnstileSiteKey || DEFAULT_TEST_TURNSTILE_SITE_KEY}
						options={{
							theme: isDark ? "dark" : "light",
							refreshExpired: "auto",
							language: lang.toLowerCase(),
							execution: "execute",
							appearance: "interaction-only",
						}}
						onWidgetLoad={() => setWidgetReady(true)}
						onSuccess={handleTurnstileSuccess}
						onExpire={() => {
							setToken("");
							setIsVerifying(false);
							pendingSubmitRef.current = false;
							if (hasExecutedRef.current) setVerifyError(true);
						}}
						onError={() => {
							setIsVerifying(false);
							setVerifyError(true);
							pendingSubmitRef.current = false;
							setToken("");
						}}
					/>
				</div>
			)}
		</Form>
	);
}
