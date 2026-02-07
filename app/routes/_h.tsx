import { Link, Outlet, redirect, useLocation, useParams } from "@remix-run/react";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { MailIcon } from "lucide-react";
import { buttonVariants } from "~/components/ui/button";
import { GitHubIcon } from "~/icons/github";
import { cn } from "~/lib/utils";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { sessionWrapper } from "~/.server/session";

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
	return null;
}

export default function HomeLayout() {
	const location = useLocation();
	const params = useParams();
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
		<div className="relative isolate h-dvh flex flex-col gap-6 overflow-hidden">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 z-0 app-gradient"
			/>
			<header className="sticky top-0 z-30 border-b-2 border-foreground/10 bg-background/80 backdrop-blur-sm">
				<div className="flex items-center max-w-6xl mx-auto w-full px-6 py-5">
					<Link to="/" className="group flex items-center gap-3">
						<span className="flex size-12 items-center justify-center border-2 border-foreground/10 bg-background shadow-[6px_6px_0_0_hsl(var(--foreground)/0.08)] transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
							<MailIcon className="size-5 text-foreground" />
						</span>
						<div className="flex flex-col leading-none">
							<span className="font-display text-xl font-black tracking-[0.18em] uppercase">
								TempEmail
							</span>
							<span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
								Temporary Inbox
							</span>
						</div>
					</Link>
					<div className="flex-1" />
					<div className="flex items-center gap-3">
						<nav className="flex items-center gap-1 border-2 border-foreground/10 bg-background/80 px-1 py-1 shadow-[6px_6px_0_0_hsl(var(--foreground)/0.08)]">
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
											"px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] transition-colors",
											isActive
												? "bg-foreground text-background"
												: "text-foreground/70 hover:bg-foreground/10",
										)}
									>
										{locale.label}
									</Link>
								);
							})}
						</nav>
						<Link
							to="https://github.com/OldWooood/smail"
							target="_blank"
							rel="noreferrer"
							className={cn(
								buttonVariants({
									size: "icon",
									variant: "outline",
								}),
								"rounded-none border-foreground/20",
							)}
						>
							<GitHubIcon className="size-6" />
						</Link>
					</div>
				</div>
			</header>
			<div className="relative z-20 flex-1 min-h-0">
				<Outlet />
			</div>
		</div>
	);
}
