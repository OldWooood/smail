import { Check, ChevronDown, Globe, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import {
	Link,
	Outlet,
	redirect,
	useLoaderData,
	useLocation,
	useParams,
} from "react-router";
import { sessionWrapper } from "~/.server/session";
import { GitHubIcon } from "~/icons/github";
import {
	getLangCookie,
	isSupportedLang,
	resolveLang,
	SUPPORTED_LANGS,
	type SupportedLang,
} from "~/lib/lang";
import { cn } from "~/lib/utils";
import { getLocaleData, type Locale } from "~/locales/locale";

const LANG_TITLES: Record<SupportedLang, string> = {
	en: "English",
	"zh-CN": "Chinese",
	es: "Spanish",
	fr: "French",
	ja: "Japanese",
	ko: "Korean",
};

// Derived from SUPPORTED_LANGS so the switcher, the cookie/param validation and
// getLocaleData() can never drift apart into three separate language lists.
const localeOptions = SUPPORTED_LANGS.map((code) => ({
	code,
	label: code === "zh-CN" ? "ZH" : code.slice(0, 2).toUpperCase(),
	title: LANG_TITLES[code],
}));
function rememberLang(code: string) {
	try {
		document.cookie = `lang=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// cookies unavailable (private mode); server falls back to Accept-Language
	}
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
	if (context.cloudflare.env.PASSWORD) {
		const { getSession } = sessionWrapper(context.cloudflare.env);
		const session = await getSession(request.headers.get("Cookie"));
		const { pathname } = new URL(request.url);
		const isAuthed =
			session.data.authed === true ||
			session.data.password === context.cloudflare.env.PASSWORD;
		if (!isAuthed && !pathname.includes("auth")) {
			return redirect("/auth");
		}
	}
	const lang = params.lang;
	if (!lang) {
		// Explicit choice wins: if the user previously picked a language
		// (cookie set on click), never bounce `/` back to a prefixed URL.
		// Only first-time visitors (no cookie) get Accept-Language detection.
		if (!getLangCookie(request)) {
			const resolved = resolveLang(request);
			if (resolved !== "en") {
				const url = new URL(request.url);
				// `lang` is now encoded in the path, but keep everything else
				// (utm_*, ref, ...) so the redirect never silently drops params.
				url.searchParams.delete("lang");
				const search = url.searchParams.toString();
				return redirect(
					`/${resolved}${url.pathname}${search ? `?${search}` : ""}`,
				);
			}
		}
	}
	const locale = await getLocaleData(lang || "en");
	return { locale };
}

function ThemeToggle({ locale }: { locale: Locale }) {
	const [theme, setTheme] = useState<"light" | "dark">("dark");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const saved = localStorage.getItem("theme") as "light" | "dark" | null;
		if (saved) {
			setTheme(saved);
		} else {
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			setTheme(prefersDark ? "dark" : "light");
		}
	}, []);

	useEffect(() => {
		if (mounted) {
			document.documentElement.classList.toggle("dark", theme === "dark");
			localStorage.setItem("theme", theme);
			document
				.querySelector('meta[name="theme-color"]')
				?.setAttribute("content", theme === "dark" ? "#121014" : "#f8f6f2");
		}
	}, [theme, mounted]);

	if (!mounted) {
		return (
			<button
				type="button"
				aria-hidden="true"
				tabIndex={-1}
				className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60"
			>
				<Sun className="h-4 w-4" />
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-foreground/75 transition-colors duration-200 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			aria-label={
				theme === "dark" ? locale.nav.light_mode : locale.nav.dark_mode
			}
		>
			{theme === "dark" ? (
				<Sun className="h-4 w-4" />
			) : (
				<Moon className="h-4 w-4" />
			)}
		</button>
	);
}

function LanguageMenu({
	currentLang,
	buildLangHref,
}: {
	currentLang: string;
	buildLangHref: (code: string) => string;
}) {
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<div ref={menuRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-controls="language-menu"
				className="flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2.5 text-xs font-medium text-foreground/75 transition-colors duration-200 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				<Globe className="h-4 w-4" />
				<span className="text-xs font-medium">
					{localeOptions.find((l) => l.code === currentLang)?.label}
				</span>
				<ChevronDown
					className={cn(
						"h-3 w-3 transition-transform duration-200",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && (
				<div
					id="language-menu"
					className="panel absolute right-0 top-full z-50 mt-2 min-w-[160px] animate-scale-in rounded-xl p-1.5"
				>
					{localeOptions.map((option) => {
						const isActive = option.code === currentLang;
						return (
							<Link
								key={option.code}
								to={buildLangHref(option.code)}
								prefetch="intent"
								aria-current={isActive ? "page" : undefined}
								title={option.title}
								onClick={() => {
									rememberLang(option.code);
									setOpen(false);
								}}
								className={cn(
									"flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									isActive
										? "bg-primary/10 font-medium text-primary"
										: "text-foreground/80 hover:bg-muted/60",
								)}
							>
								{option.title}
								{isActive && <Check className="h-3.5 w-3.5" />}
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}

export default function HomeLayout() {
	const location = useLocation();
	const params = useParams();
	const { locale } = useLoaderData<typeof loader>();
	const currentLang =
		params.lang && isSupportedLang(params.lang) ? params.lang : "en";

	const buildLangHref = (code: string) => {
		const segments = location.pathname.split("/").filter(Boolean);
		const hasLangPrefix = segments.length > 0 && isSupportedLang(segments[0]);
		const rest = hasLangPrefix ? segments.slice(1) : segments;
		const basePath = rest.length ? `/${rest.join("/")}` : "";
		const prefix = code === "en" ? "" : `/${code}`;
		const path = `${prefix}${basePath}` || "/";
		return `${path}${location.search}${location.hash}`;
	};

	return (
		<div className="relative isolate flex h-dvh flex-col overflow-hidden overscroll-none bg-background">
			<div
				aria-hidden
				className="pointer-events-none fixed inset-0 z-0 app-gradient"
			/>

			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
			>
				{locale.nav.skip}
			</a>

			<header className="z-50 w-full shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
				<div className="header-bar mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl border border-border/70 px-3 shadow-sm sm:px-4">
					<Link
						to="/"
						className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						<img
							src="/apple-touch-icon.png"
							alt=""
							width={36}
							height={36}
							className="h-9 w-9 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
						/>
						<span
							translate="no"
							className="text-lg font-bold tracking-tight text-foreground"
						>
							TempEmail
						</span>
					</Link>

					<div className="flex items-center gap-1.5">
						<LanguageMenu
							currentLang={currentLang}
							buildLangHref={buildLangHref}
						/>
						<ThemeToggle locale={locale} />
						<Link
							to="https://github.com/OldWooood/smail"
							target="_blank"
							rel="noreferrer"
							aria-label="GitHub repository"
							className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-foreground/75 transition-colors duration-200 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						>
							<GitHubIcon className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</header>

			<main
				id="main-content"
				tabIndex={-1}
				className="relative z-10 flex min-h-0 flex-1 flex-col focus:outline-none"
			>
				<Outlet />
			</main>
		</div>
	);
}
