import type { LoaderFunctionArgs } from "react-router";
import { d1Wrapper } from "~/.server/db";
import { findEmailBody } from "~/.server/emails";
import { findActiveMailbox, touchMailbox } from "~/.server/mailbox";
import { sessionWrapper } from "~/.server/session";

function escapeHtml(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// Serves the email body as a standalone document so the detail page shell
// stays small. Access is scoped to the active mailbox, not merely to an
// address string in the cookie.
export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const id = params.id as string;
	const { getSession, destroySession } = sessionWrapper(context.cloudflare.env);
	const session = await getSession(request.headers.get("Cookie"));
	const db = d1Wrapper(context.cloudflare.env.DB);
	const mailbox = await findActiveMailbox(
		db,
		session.data.mailboxId,
		session.data.mailboxToken,
	);
	if (!mailbox) {
		throw new Response("Unauthorized", {
			status: 401,
			headers: { "Set-Cookie": await destroySession(session) },
		});
	}

	const email = await findEmailBody(db, mailbox.id, id);
	if (!email) {
		throw new Response("Email not found", { status: 404 });
	}

	// Opening a message is owner activity too.
	await touchMailbox(db, mailbox);

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
			"Cache-Control": "private, no-store",
			Vary: "Cookie",
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy": "no-referrer",
			// `sandbox` (no allow-scripts/allow-same-origin) neuters scripts and
			// DOM access; `frame-ancestors 'self'` ensures only our own
			// detail page can embed this. External stylesheets are blocked
			// (inline <style> still works); remote images stay allowed so
			// normal emails render.
			"Content-Security-Policy":
				"sandbox allow-popups; default-src 'none'; style-src 'unsafe-inline' http: https:; img-src http: https: data: cid: blob:; font-src data: http: https:; frame-ancestors 'self'; form-action 'none'; base-uri 'none'",
		},
	});
}
