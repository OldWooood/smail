import { lt } from "drizzle-orm";
import PagesFunction from "build/worker";
import PostalMime from "postal-mime";
import { d1Wrapper, schema } from "./.server/db";
import { mailboxStateKey, nextMailboxStateToken } from "./.server/mailbox";

const postalMime = new PostalMime();

const MAX_EMAIL_RAW_SIZE = 2 * 1024 * 1024;
// Keep D1 rows small: D1 has strict per-row limits and emails can carry
// megabytes of HTML. Truncation happens before insert.
const MAX_HTML_CHARS = 400_000;
const MAX_TEXT_CHARS = 100_000;
// Old rows are removed by the scheduled cleanup (wrangler `triggers.crons`).
const RETENTION_DAYS = 7;

function truncate(value: string | undefined, max: number) {
	if (!value) return value;
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

type StoredAttachment = {
	filename?: string | null;
	mimeType?: string;
	disposition?: string | null;
	size?: number;
};

function stripAttachments(attachments: unknown): StoredAttachment[] {
	if (!Array.isArray(attachments)) return [];
	return attachments.slice(0, 20).map((item) => {
		const a = item as {
			filename?: string | null;
			mimeType?: string;
			disposition?: string | null;
			size?: number;
			content?: unknown;
		};
		return {
			filename: a.filename ?? null,
			mimeType: a.mimeType,
			disposition: a.disposition ?? null,
			size:
				typeof a.size === "number"
					? a.size
					: a.content instanceof ArrayBuffer
						? a.content.byteLength
						: undefined,
		};
	});
}

async function bumpMailbox(kv: KVNamespace, to: string) {
	try {
		await kv.put(mailboxStateKey(to), nextMailboxStateToken());
	} catch (err) {
		console.error("Failed to bump mailbox state:", err);
	}
}

async function storeOversizedNotice(
	to: string,
	rawSize: number,
	env: Env,
) {
	const db = d1Wrapper(env.DB);
	const normalizedTo = to.toLowerCase();
	await db.insert(schema.emails).values({
		domain: normalizedTo.split("@")[1] || "",
		messageFrom: "",
		messageTo: normalizedTo,
		headers: [],
		from: { address: "", name: "" },
		subject: "(Oversized email blocked)",
		html: undefined,
		text: `An email (${Math.round(rawSize / 1024)} KB) exceeded the ${Math.round(
			MAX_EMAIL_RAW_SIZE / 1024 / 1024,
		)} MB limit and was not stored.`,
		attachments: [],
	});
	await bumpMailbox(env.KV, to);
}

async function storeEmail(message: ForwardableEmailMessage, env: Env) {
	const text = await new Response(message.raw).text();
	const mail = await postalMime.parse(text);
	const db = d1Wrapper(env.DB);
	const to = message.to.toLowerCase();
	const domain = message.from?.split("@")?.[1] || "";
	await db.insert(schema.emails).values({
		domain,
		messageFrom: message.from,
		messageTo: to,
		headers: mail.headers,
		from: mail.from,
		sender: mail.sender,
		replyTo: mail.replyTo,
		deliveredTo: mail.deliveredTo,
		returnPath: mail.returnPath,
		to: mail.to,
		cc: mail.cc,
		bcc: mail.bcc,
		subject: mail.subject?.slice(0, 500),
		messageId: mail.messageId,
		inReplyTo: mail.inReplyTo,
		references: mail.references,
		date: mail.date,
		html: truncate(mail.html, MAX_HTML_CHARS),
		text: truncate(mail.text, MAX_TEXT_CHARS),
		attachments: stripAttachments(mail.attachments) as unknown as never,
	});
	await bumpMailbox(env.KV, message.to);
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
				`Oversized email to ${message.to}: ${message.rawSize} bytes`,
			);
			ctx.waitUntil(
				storeOversizedNotice(message.to, message.rawSize, env).catch((err) => {
					console.error("Failed to store oversized notice:", err);
				}),
			);
			return;
		}
		ctx.waitUntil(
			storeEmail(message, env).catch((err) => {
				console.error("Failed to store email:", err);
			}),
		);
	},
	async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(
			(async () => {
				const cutoff = new Date(
					Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
				);
				const db = d1Wrapper(env.DB);
				await db
					.delete(schema.emails)
					.where(lt(schema.emails.createdAt, cutoff));
			})().catch((err) => {
				console.error("Failed to purge old emails:", err);
			}),
		);
	},
} satisfies ExportedHandler<Env>;
