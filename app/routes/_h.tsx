import { match } from "@formatjs/intl-localematcher";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
	Link,
	Outlet,
	redirect,
	useLoaderData,
	useLocation,
	useParams,
} from "@remix-run/react";
import { Check, ChevronDown, Globe, Moon, Sun } from "lucide-react";
import Negotiator from "negotiator";
import { useEffect, useRef, useState } from "react";
import { sessionWrapper } from "~/.server/session";
import { GitHubIcon } from "~/icons/github";
import { cn } from "~/lib/utils";
import { type Locale, getLocaleData } from "~/locales/locale";

const localeOptions = [
	{ code: "en", label: "EN", title: "English" },
	{ code: "zh-CN", label: "ZH", title: "Chinese" },
	{ code: "es", label: "ES", title: "Spanish" },
	{ code: "fr", label: "FR", title: "French" },
	{ code: "ja", label: "JA", title: "Japanese" },
	{ code: "ko", label: "KO", title: "Korean" },
];
const localeCodes = new Set(localeOptions.map((locale) => locale.code));

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
		const headers = {
			"accept-language": request.headers.get("accept-language") || "",
		};
		const languages = new Negotiator({ headers: headers }).languages();
		const locales = ["en", "zh-CN", "es", "fr", "ja", "ko"];
		const defaultLocale = "en";
		const lang = match(languages, locales, defaultLocale);
		if (lang !== defaultLocale) {
			const { pathname } = new URL(request.url);
			return redirect(`/${lang}${pathname}`);
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
		}
	}, [theme, mounted]);

	if (!mounted) {
		return (
			<button
				type="button"
				className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/50"
			>
				<Sun className="h-4 w-4" />
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/50 text-foreground/70 transition-all hover:bg-background hover:text-foreground"
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

function MobileLangMenu({
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
		<div ref={menuRef} className="relative sm:hidden">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-haspopup="menu"
				className="flex h-9 items-center gap-1 rounded-lg border border-border/50 bg-background/50 px-2.5 text-foreground/70 transition-all hover:bg-background hover:text-foreground"
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
					role="menu"
					className="glass absolute right-0 top-full z-50 mt-2 min-w-[160px] rounded-xl p-1.5 animate-scale-in"
				>
					{localeOptions.map((option) => {
						const isActive = option.code === currentLang;
						return (
							<Link
								key={option.code}
								to={buildLangHref(option.code)}
								prefetch="intent"
								role="menuitem"
								title={option.title}
								onClick={() => setOpen(false)}
								className={cn(
									"flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
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
		params.lang && localeCodes.has(params.lang) ? params.lang : "en";

	const buildLangHref = (code: string) => {
		const segments = location.pathname.split("/").filter(Boolean);
		const hasLangPrefix = segments.length > 0 && localeCodes.has(segments[0]);
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

			<header className="z-50 w-full shrink-0 glass header-glass">
				<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
					<Link to="/" className="group flex items-center gap-3">
						<img
							src="/favicon.png?v=9"
							alt="TempEmail logo"
							className="h-10 w-10 transition-transform duration-300 group-hover:scale-105"
						/>
						<div className="flex flex-col">
							<span className="text-lg font-bold tracking-tight text-foreground">
								TempEmail
							</span>
							<span className="text-[10px] font-medium text-muted-foreground">
								{locale.nav.tagline}
							</span>
						</div>
					</Link>

					<div className="flex items-center gap-2">
						<nav className="hidden sm:flex items-center rounded-lg border border-border/50 bg-background/50 p-1">
							{localeOptions.map((locale) => {
								const isActive = locale.code === currentLang;
								return (
									<Link
										key={locale.code}
										to={buildLangHref(locale.code)}
										prefetch="intent"
										aria-current={isActive ? "page" : undefined}
										title={locale.title}
										className={cn(
											"px-2.5 py-1 text-xs font-medium rounded-md transition-all",
											isActive
												? "bg-primary text-primary-foreground shadow-sm"
												: "text-muted-foreground hover:text-foreground hover:bg-background",
										)}
									>
										{locale.label}
									</Link>
								);
							})}
						</nav>

						<div className="flex items-center gap-2">
							<MobileLangMenu
								currentLang={currentLang}
								buildLangHref={buildLangHref}
							/>
							<ThemeToggle locale={locale} />
							<Link
								to="https://github.com/OldWooood/smail"
								target="_blank"
								rel="noreferrer"
								className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/50 text-foreground/70 transition-all hover:bg-background hover:text-foreground"
							>
								<GitHubIcon className="h-4 w-4" />
							</Link>
						</div>
					</div>
				</div>
			</header>

			<main className="relative z-10 flex min-h-0 flex-1 flex-col">
				<Outlet />
			</main>
		</div>
	);
}
