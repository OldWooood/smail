import {
	Link,
	Outlet,
	redirect,
	useLoaderData,
	useLocation,
	useParams,
} from "@remix-run/react";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { Moon, Sun } from "lucide-react";
import { GitHubIcon } from "~/icons/github";
import { cn } from "~/lib/utils";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { sessionWrapper } from "~/.server/session";
import { getLocaleData, type Locale } from "~/locales/locale";
import { useEffect, useState } from "react";

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
		if (
			session.data.password !== context.cloudflare.env.PASSWORD &&
			!pathname.includes("auth")
		) {
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
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
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
			<button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/50">
				<Sun className="h-4 w-4" />
			</button>
		);
	}

	return (
		<button
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/50 text-foreground/70 transition-all hover:bg-background hover:text-foreground"
			aria-label={
				theme === "dark" ? locale.nav.light_mode : locale.nav.dark_mode
			}
		>
			{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
		</button>
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
		const hasLangPrefix =
			segments.length > 0 && localeCodes.has(segments[0]);
		const rest = hasLangPrefix ? segments.slice(1) : segments;
		const basePath = rest.length ? `/${rest.join("/")}` : "";
		const prefix = code === "en" ? "" : `/${code}`;
		const path = `${prefix}${basePath}` || "/";
		return `${path}${location.search}${location.hash}`;
	};

	return (
		<div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
			<div aria-hidden className="pointer-events-none fixed inset-0 z-0 app-gradient" />
			
			<header className="sticky top-0 z-50 w-full glass header-glass">
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
												: "text-muted-foreground hover:text-foreground hover:bg-background"
										)}
									>
										{locale.label}
									</Link>
								);
							})}
						</nav>

						<div className="flex items-center gap-2">
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

			<main className="relative z-10 flex-1">
				<Outlet />
			</main>
		</div>
	);
}
