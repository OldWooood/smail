import { lt } from "drizzle-orm";
import PagesFunction from "build/worker";
import PostalMime from "postal-mime";
import { d1Wrapper, schema } from "./.server/db";
import {
	MAILBOX_STATE_TTL_SECONDS,
	mailboxClaimKey,
	mailboxStateKey,
	nextMailboxStateToken,
} from "./.server/mailbox";

const postalMime = new PostalMime();

const MAX_EMAIL_RAW_SIZE = 2 * 1024 * 1024;
// Keep D1 rows small: D1 has strict per-row limits and emails can carry
// megabytes of HTML. Truncation happens before insert.
const MAX_HTML_CHARS = 400_000;
const MAX_TEXT_CHARS = 100_000;
// Old rows are removed by the scheduled cleanup (wrangler `triggers.crons`).
const RETENTION_DAYS = 7;
// Purge runs in bounded batches so a single cron invocation can't blow past
// D1/CPU limits no matter how many rows expired.
const PURGE_BATCH_SIZE = 1000;
const PURGE_MAX_BATCHES = 100;

function truncate(value: string | undefined, max: number) {
	if (!value) return value;
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

// Only columns ever read by the app are stored (list/detail/body select
// id, from, sender, messageFrom, subject, html, text, createdAt).
// headers/to/cc/bcc/metadata are never selected, so they are not written.

async function isClaimed(kv: KVNamespace, to: string) {
	try {
		return (await kv.get(mailboxClaimKey(to))) != null;
	} catch (err) {
		console.error("Failed to check mailbox claim, accepting mail:", err);
		// Fail open: a KV hiccup must never silently drop legitimate mail.
		return true;
	}
}

async function bumpMailbox(kv: KVNamespace, to: string) {
	try {
		await kv.put(mailboxStateKey(to), nextMailboxStateToken(), {
			expirationTtl: MAILBOX_STATE_TTL_SECONDS,
		});
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
	await db.insert(schema.emails).values({
		messageFrom: message.from,
		messageTo: to,
		headers: [],
		from: mail.from ?? { address: "", name: "" },
		sender: mail.sender,
		subject: mail.subject?.slice(0, 500),
		html: truncate(mail.html, MAX_HTML_CHARS),
		text: truncate(mail.text, MAX_TEXT_CHARS),
		attachments: [],
	});
	await bumpMailbox(env.KV, message.to);
}

async function handleEmail(message: ForwardableEmailMessage, env: Env) {
	// P0: drop mail for addresses nobody claimed before paying for
	// parse + D1. This is the main spam/abuse shield: without it anyone can
	// burn D1 writes and storage by mailing random addresses.
	if (!(await isClaimed(env.KV, message.to))) {
		console.log(`Dropping email to unclaimed address ${message.to}`);
		return;
	}
	if (message.rawSize > MAX_EMAIL_RAW_SIZE) {
		console.error(
			`Oversized email to ${message.to}: ${message.rawSize} bytes`,
		);
		await storeOversizedNotice(message.to, message.rawSize, env);
		return;
	}
	await storeEmail(message, env);
}

export default {
	fetch: PagesFunction.fetch,
	async email(
		message: ForwardableEmailMessage,
		env: Env,
		ctx: ExecutionContext,
	) {
		ctx.waitUntil(
			handleEmail(message, env).catch((err) => {
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
				for (let i = 0; i < PURGE_MAX_BATCHES; i++) {
					await db
						.delete(schema.emails)
						.where(lt(schema.emails.createdAt, cutoff))
						.limit(PURGE_BATCH_SIZE);
					const remaining = await db.query.emails.findFirst({
						columns: { id: true },
						where: (emails, { lt: ltOp }) => ltOp(emails.createdAt, cutoff),
					});
					if (!remaining) break;
				}
			})().catch((err) => {
				console.error("Failed to purge old emails:", err);
			}),
		);
	},
} satisfies ExportedHandler<Env>;
