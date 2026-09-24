import type { LoaderFunctionArgs } from "react-router";
import { d1Wrapper } from "~/.server/db";
import { sessionWrapper } from "~/.server/session";

function escapeHtml(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// Serves the email body as a standalone document so the detail page shell
// stays small. Emails are immutable, so the response is privately cacheable.
export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const id = params.id as string;
	const { getSession } = sessionWrapper(context.cloudflare.env);
	const session = await getSession(request.headers.get("Cookie"));
	const messageTo = session.data.email;
	if (!messageTo) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const etag = `"email-${id}"`;
	if (request.headers.get("If-None-Match") === etag) {
		return new Response(null, {
			status: 304,
			headers: { ETag: etag },
		});
	}

	const db = d1Wrapper(context.cloudflare.env.DB);
	const email = await db.query.emails.findFirst({
		columns: { id: true, html: true, text: true },
		where: (emails, { and, eq }) =>
			and(eq(emails.id, id), eq(emails.messageTo, messageTo.toLowerCase())),
	});
	if (!email) {
		throw new Response("Email not found", { status: 404 });
	}

	const url = new URL(request.url);
	const isDark = url.searchParams.get("theme") === "dark";

	const rawContent = email.html
		? email.html
		: email.text
			? `<pre style="margin:0;padding:20px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6">${escapeHtml(email.text)}</pre>`
			: `<pre style="margin:0;padding:20px;font-family:ui-monospace,monospace">(empty)</pre>`;

	const body = isDark
		? `${rawContent}<style>html{background:transparent;color-scheme:dark}body{background:transparent}</style>`
		: rawContent;

	return new Response(body, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "private, max-age=300",
			ETag: etag,
			"X-Content-Type-Options": "nosniff",
			// Defense in depth alongside the iframe `sandbox` attribute.
			"Content-Security-Policy": "sandbox allow-popups",
		},
	});
}
