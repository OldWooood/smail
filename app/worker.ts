import { eq, sql } from "drizzle-orm";
import PostalMime from "postal-mime";
import { createRequestHandler } from "react-router";
import { d1Wrapper, schema } from "./.server/db";
import { purgeExpiredData } from "./.server/mailbox";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: { env: Env; ctx: ExecutionContext };
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

const MAX_EMAIL_RAW_SIZE = 2 * 1024 * 1024;
// Keep D1 rows small: D1 has strict per-row limits and emails can carry
// megabytes of HTML. Truncation happens before insert.
const MAX_HTML_CHARS = 400_000;
const MAX_TEXT_CHARS = 100_000;

function truncate(value: string | undefined, max: number) {
	if (!value) return value;
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

async function storeMailboxMessage(
	db: ReturnType<typeof d1Wrapper>,
	mailboxId: string,
	values: Omit<typeof schema.emails.$inferInsert, "mailboxId">,
) {
	// One D1 batch = one transaction: the message and the ETag revision can
	// never be observed out of sync by the inbox poll.
	await db.batch([
		db.insert(schema.emails).values({ ...values, mailboxId }),
		db
			.update(schema.mailboxes)
			.set({ revision: sql`${schema.mailboxes.revision} + 1` })
			.where(eq(schema.mailboxes.id, mailboxId)),
	]);
}

async function storeOversizedNotice(
	db: ReturnType<typeof d1Wrapper>,
	mailboxId: string,
	rawSize: number,
) {
	await storeMailboxMessage(db, mailboxId, {
		messageFrom: "",
		from: { address: "", name: "" },
		subject: "(Oversized email blocked)",
		text: `An email (${Math.round(rawSize / 1024)} KB) exceeded the ${Math.round(
			MAX_EMAIL_RAW_SIZE / 1024 / 1024,
		)} MB limit and was not stored.`,
	});
}

async function storeEmail(
	message: ForwardableEmailMessage,
	db: ReturnType<typeof d1Wrapper>,
	mailboxId: string,
) {
	// Pass the raw bytes, not a UTF-8 decoded string. postal-mime needs the
	// original bytes to honour each MIME part's declared charset (ISO-8859-1,
	// Shift_JIS, GBK, ...); decoding to text first corrupts those bodies.
	const raw = await new Response(message.raw).arrayBuffer();

	// Use the static parse entrypoint. A module-level `new PostalMime()`
	// instance is single-use (`Can not reuse parser`) and not safe to share
	// between concurrent invocations in the same isolate.
	const mail = await PostalMime.parse(raw);

	await storeMailboxMessage(db, mailboxId, {
		messageFrom: message.from,
		from: mail.from ?? { address: "", name: "" },
		sender: mail.sender,
		subject: mail.subject?.slice(0, 500),
		html: truncate(mail.html, MAX_HTML_CHARS),
		text: truncate(mail.text, MAX_TEXT_CHARS),
		createdAt: new Date(),
	});
}

async function handleEmail(message: ForwardableEmailMessage, env: Env) {
	const to = message.to.trim().toLowerCase();
	const db = d1Wrapper(env.DB);
	const now = new Date();

	// The mailbox row is the only authority. An expired mailbox can never
	// receive mail, even if the physical purge has not run yet.
	const mailbox = await db.query.mailboxes.findFirst({
		columns: { id: true },
		where: (mailboxes, { and, eq, gt }) =>
			and(eq(mailboxes.address, to), gt(mailboxes.expiresAt, now)),
	});
	if (!mailbox) {
		console.log(`Dropping email for inactive address ${to}`);
		return;
	}

	if (message.rawSize > MAX_EMAIL_RAW_SIZE) {
		console.error(`Oversized email to ${message.to}: ${message.rawSize} bytes`);
		await storeOversizedNotice(db, mailbox.id, message.rawSize);
		return;
	}

	await storeEmail(message, db, mailbox.id);
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return requestHandler(request, { cloudflare: { env, ctx } });
	},
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
	async scheduled(
		_controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	) {
		ctx.waitUntil(
			purgeExpiredData(d1Wrapper(env.DB))
				.then((result) => {
					if (result.removedMailboxes) {
						console.log("Purged expired mail data:", result);
					}
				})
				.catch((err) => {
					console.error("Failed to purge old emails:", err);
				}),
		);
	},
} satisfies ExportedHandler<Env>;
