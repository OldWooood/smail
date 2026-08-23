import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { d1Wrapper } from "~/.server/db";
import { listEmails } from "~/.server/emails";
import { mailboxStateKey, quoteEtag } from "~/.server/mailbox";
import { sessionWrapper } from "~/.server/session";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const { getSession } = sessionWrapper(context.cloudflare.env);
	const lang = params.lang || "en";
	const session = await getSession(request.headers.get("Cookie"));
	const email = session.data.email;

	if (!email) {
		return json({ emails: [] });
	}

	const kv = context.cloudflare.env.KV;
	const stateToken = await kv.get(mailboxStateKey(email));
	const etag = stateToken ? quoteEtag(stateToken) : null;

	if (etag && request.headers.get("If-None-Match") === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}

	const db = d1Wrapper(context.cloudflare.env.DB);
	const emails = await listEmails(db, email, lang);

	return json({ emails }, { headers: etag ? { ETag: etag } : undefined });
}
