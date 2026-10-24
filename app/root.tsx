import geistLatinExt from "@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2?url";
import geistLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import jetbrainsMonoLatinExt from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2?url";
import jetbrainsMonoLatin from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "react-router";
import "~/tailwind.css";

export const links: LinksFunction = () => [
	{
		rel: "preload",
		href: geistLatin,
		as: "font",
		type: "font/woff2",
		crossOrigin: "anonymous",
	},
	{
		rel: "preload",
		href: jetbrainsMonoLatin,
		as: "font",
		type: "font/woff2",
		crossOrigin: "anonymous",
	},
	{
		rel: "icon",
		href: "/favicon.svg",
		type: "image/svg+xml",
	},
	{ rel: "manifest", href: "/site.webmanifest?v=11" },
];

export async function loader({ params }: LoaderFunctionArgs) {
	return {
		lang: params.lang || "en",
	};
}

export function Layout({ children }: { children: React.ReactNode }) {
	const { lang } = useLoaderData<typeof loader>();

	return (
		<html lang={lang} className="dark" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="theme-color" content="#f8f6f2" />
				<Meta />
				<Links />
				<style
					dangerouslySetInnerHTML={{
						__html: `
							@font-face {
								font-family: "Geist Variable";
								font-style: normal;
								font-display: optional;
								font-weight: 100 900;
								src: url("${geistLatin}") format("woff2-variations");
								unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
							}
							@font-face {
								font-family: "Geist Variable";
								font-style: normal;
								font-display: optional;
								font-weight: 100 900;
								src: url("${geistLatinExt}") format("woff2-variations");
								unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
							}
							@font-face {
								font-family: "JetBrains Mono Variable";
								font-style: normal;
								font-display: optional;
								font-weight: 100 800;
								src: url("${jetbrainsMonoLatin}") format("woff2-variations");
								unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
							}
							@font-face {
								font-family: "JetBrains Mono Variable";
								font-style: normal;
								font-display: optional;
								font-weight: 100 800;
								src: url("${jetbrainsMonoLatinExt}") format("woff2-variations");
								unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
							}
						`,
					}}
				/>
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								function getTheme() {
									const saved = localStorage.getItem('theme');
									if (saved === 'dark' || saved === 'light') return saved;
									return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
								}
								const theme = getTheme();
								document.documentElement.classList.toggle('dark', theme === 'dark');
								const themeColor = document.querySelector('meta[name="theme-color"]');
								if (themeColor) themeColor.setAttribute('content', theme === 'dark' ? '#121014' : '#f8f6f2');
							})();
						`,
					}}
				/>
			</head>
			<body className="min-h-screen">
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
