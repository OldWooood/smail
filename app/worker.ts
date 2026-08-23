import PagesFunction from "build/worker";
import PostalMime from "postal-mime";
import { d1Wrapper, schema } from "./.server/db";
import { mailboxStateKey, nextMailboxStateToken } from "./.server/mailbox";

const postalMime = new PostalMime();

const MAX_EMAIL_RAW_SIZE = 2 * 1024 * 1024;

async function storeEmail(message: ForwardableEmailMessage, env: Env) {
	const text = await new Response(message.raw).text();
	const mail = await postalMime.parse(text);
	const db = d1Wrapper(env.DB);
	const domain = message.from?.split("@")?.[1] || "";
	await db.insert(schema.emails).values({
		domain,
		messageFrom: message.from,
		messageTo: message.to,
		headers: mail.headers,
		from: mail.from,
		sender: mail.sender,
		replyTo: mail.replyTo,
		deliveredTo: mail.deliveredTo,
		returnPath: mail.returnPath,
		to: mail.to,
		cc: mail.cc,
		bcc: mail.bcc,
		subject: mail.subject,
		messageId: mail.messageId,
		inReplyTo: mail.inReplyTo,
		references: mail.references,
		date: mail.date,
		html: mail.html,
		text: mail.text,
		attachments: mail.attachments,
	});
	await env.KV.put(mailboxStateKey(message.to), nextMailboxStateToken());
}

export default {
	fetch: PagesFunction.fetch,
	async email(
		message: ForwardableEmailMessage,
		env: Env,
		ctx: ExecutionContext,
	) {
		if (message.rawSize > MAX_EMAIL_RAW_SIZE) {
			console.error(
				`Skipping oversized email to ${message.to}: ${message.rawSize} bytes`,
			);
			return;
		}
		ctx.waitUntil(
			storeEmail(message, env).catch((err) => {
				console.error("Failed to store email:", err);
			}),
		);
	},
} satisfies ExportedHandler<Env>;
