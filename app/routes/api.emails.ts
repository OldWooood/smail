import { match } from "@formatjs/intl-localematcher";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import Negotiator from "negotiator";
import { d1Wrapper } from "~/.server/db";
import { listEmails } from "~/.server/emails";
import { mailboxStateKey, quoteEtag } from "~/.server/mailbox";
import { sessionWrapper } from "~/.server/session";

const SUPPORTED_LANGS = ["en", "zh-CN", "es", "fr", "ja", "ko"] as const;

function resolveLang(request: Request): string {
	const url = new URL(request.url);
	const queryLang = url.searchParams.get("lang");
	if (queryLang && (SUPPORTED_LANGS as readonly string[]).includes(queryLang)) {
		return queryLang;
	}
	const cookie = request.headers.get("Cookie") || "";
	const cookieMatch = cookie.match(/(?:^|;\s*)lang=([^;]+)/);
	const cookieLang = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
	if (
		cookieLang &&
		(SUPPORTED_LANGS as readonly string[]).includes(cookieLang)
	) {
		return cookieLang;
	}
	try {
		const languages = new Negotiator({
			headers: {
				"accept-language": request.headers.get("accept-language") || "",
			},
		}).languages();
		return match(languages, [...SUPPORTED_LANGS], "en");
	} catch {
		return "en";
	}
}

export async function loader({ request, context }: LoaderFunctionArgs) {
	const { getSession } = sessionWrapper(context.cloudflare.env);
	const lang = resolveLang(request);
	const session = await getSession(request.headers.get("Cookie"));
	const email = session.data.email;

	if (!email) {
		return json(
			{ emails: [] },
			{ headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
		);
	}

	const kv = context.cloudflare.env.KV;
	const stateToken = await kv.get(mailboxStateKey(email));
	const etag = stateToken ? quoteEtag(stateToken) : null;

	if (etag && request.headers.get("If-None-Match") === etag) {
		return new Response(null, {
			status: 304,
			headers: {
				ETag: etag,
				"Cache-Control": "private, no-store",
				Vary: "Cookie",
			},
		});
	}

	const db = d1Wrapper(context.cloudflare.env.DB);
	const emails = await listEmails(db, email, lang);

	return json(
		{ emails },
		{
			headers: {
				"Cache-Control": "private, no-store",
				Vary: "Cookie",
				...(etag ? { ETag: etag } : undefined),
			},
		},
	);
}
