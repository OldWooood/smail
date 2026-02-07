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
	{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=2" },
	{ rel: "icon", href: "/favicon.ico?v=2" },
	{ rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=2" },
	{ rel: "manifest", href: "/site.webmanifest?v=2" },
];

export async function loader({ params }: LoaderFunctionArgs) {
	return {
		lang: params.lang || "en",
	};
}

export function Layout({ children }: { children: React.ReactNode }) {
	const { lang } = useLoaderData<typeof loader>();

	return (
		<html lang={lang}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
				<script
					dangerouslySetInnerHTML={{
						__html: `
              if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
              window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (e.matches) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              });
            `,
					}}
				/>
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
				<script
					defer
					src="https://u.pexni.com/script.js"
					data-website-id="09979220-99e5-4973-b1b2-5e46163fe2d2"
				/>
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
