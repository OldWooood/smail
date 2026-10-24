import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { d1Wrapper } from "~/.server/db";
import { listEmails } from "~/.server/emails";
import {
	findActiveMailbox,
	mailboxEtag,
	touchMailbox,
} from "~/.server/mailbox";
import { sessionWrapper } from "~/.server/session";
import { resolveLang } from "~/lib/lang";

const NO_STORE = {
	"Cache-Control": "private, no-store",
	Vary: "Cookie",
} as const;

export async function loader({ request, context }: LoaderFunctionArgs) {
	const { getSession, destroySession } = sessionWrapper(context.cloudflare.env);
	const lang = resolveLang(request);
	const session = await getSession(request.headers.get("Cookie"));
	const db = d1Wrapper(context.cloudflare.env.DB);
	const mailbox = await findActiveMailbox(
		db,
		session.data.mailboxId,
		session.data.mailboxToken,
	);

	if (!mailbox) {
		// The address expired, was deleted, or the cookie is stale. Clear it so
		// the client can fall back to the landing page without a redirect loop.
		return data(
			{ error: "mailbox_expired" as const, emails: [] },
			{
				status: 401,
				headers: {
					...NO_STORE,
					"Set-Cookie": await destroySession(session),
				},
			},
		);
	}

	const etag = mailboxEtag(mailbox);
	if (request.headers.get("If-None-Match") === etag) {
		await touchMailbox(db, mailbox);
		return new Response(null, {
			status: 304,
			headers: { ...NO_STORE, ETag: etag },
		});
	}

	const emails = await listEmails(db, mailbox.id, lang);
	await touchMailbox(db, mailbox);

	return data(
		{ emails },
		{
			headers: {
				...NO_STORE,
				ETag: etag,
			},
		},
	);
}
