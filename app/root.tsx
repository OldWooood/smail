import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "@remix-run/react";
import "~/tailwind.css";

export const links: LinksFunction = () => [
	{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=5" },
	{ rel: "icon", href: "/favicon.ico?v=5" },
	{ rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=5" },
	{ rel: "manifest", href: "/site.webmanifest?v=5" },
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
				<Meta />
				<Links />
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
