import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { DBDatabase } from "~/.server/db";
import { schema } from "~/.server/db";
import type { Mailbox } from "~/drizzle/schema";

/** Sliding inactivity window. Any authenticated mailbox read refreshes it. */
export const MAILBOX_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Do not write on every 10s inbox poll. With a 10 minute touch interval the
 * effective expiry is at most 10 minutes later than the last real activity,
 * while active tabs cost at most 144 D1 writes per day.
 */
export const MAILBOX_TOUCH_INTERVAL_MS = 10 * 60 * 1000;

const PURGE_BATCH_SIZE = 50;
const PURGE_MAX_BATCHES = 40;

export function normalizeAddress(address: string) {
	return address.trim().toLowerCase();
}

export function normalizeDomain(domain: string | undefined) {
	return (domain || "smail.pw").trim().toLowerCase().replace(/\.+$/, "");
}

export function mailboxEtag(mailbox: Pick<Mailbox, "id" | "revision">) {
	return `"box-${mailbox.id}-${mailbox.revision}"`;
}

function isUniqueViolation(error: unknown) {
	const seen = new Set<unknown>();
	let current: unknown = error;
	while (current && typeof current === "object" && !seen.has(current)) {
		seen.add(current);
		if (
			current instanceof Error &&
			/unique constraint/i.test(current.message)
		) {
			return true;
		}
		current = (current as { cause?: unknown }).cause;
	}
	return false;
}

/**
 * Finds a mailbox only when the session proves ownership AND it has not
 * expired. Mailbox ids are never reused, so a stale cookie cannot read a
 * mailbox that was later claimed again under the same address.
 */
export async function findActiveMailbox(
	db: DBDatabase,
	mailboxId: string | undefined,
	token: string | undefined,
	now = new Date(),
): Promise<Mailbox | null> {
	if (!mailboxId || !token) return null;
	const mailbox = await db.query.mailboxes.findFirst({
		where: (mailboxes, { and, eq, gt }) =>
			and(
				eq(mailboxes.id, mailboxId),
				eq(mailboxes.token, token),
				gt(mailboxes.expiresAt, now),
			),
	});
	return mailbox ?? null;
}

/**
 * Records owner activity and pushes the inactivity deadline forward.
 * Conditional update keeps concurrent polls from writing on every request.
 */
export async function touchMailbox(
	db: DBDatabase,
	mailbox: Mailbox,
	now = new Date(),
): Promise<Mailbox> {
	if (
		now.getTime() - mailbox.lastUsedAt.getTime() <
		MAILBOX_TOUCH_INTERVAL_MS
	) {
		return mailbox;
	}

	const expiresAt = new Date(now.getTime() + MAILBOX_TTL_MS);
	await db
		.update(schema.mailboxes)
		.set({ lastUsedAt: now, expiresAt })
		.where(
			and(
				eq(schema.mailboxes.id, mailbox.id),
				eq(schema.mailboxes.token, mailbox.token),
				gt(schema.mailboxes.expiresAt, now),
			),
		);

	return { ...mailbox, lastUsedAt: now, expiresAt };
}

/**
 * Atomically claims an address.
 *
 * The D1 unique index on `mailboxes.address` is the arbiter: concurrent claims
 * cannot both succeed. An expired mailbox is purged together with its messages
 * in one batch before the address is handed to the next owner.
 */
export async function claimMailbox(
	db: DBDatabase,
	address: string,
	now = new Date(),
): Promise<Mailbox | null> {
	const normalized = normalizeAddress(address);

	for (let attempt = 0; attempt < 4; attempt++) {
		const existing = await db.query.mailboxes.findFirst({
			columns: { id: true, expiresAt: true },
			where: (mailboxes, { eq }) => eq(mailboxes.address, normalized),
		});

		if (existing) {
			if (existing.expiresAt.getTime() > now.getTime()) {
				return null;
			}

			// The old owner is gone. Remove their messages and the expired row
			// before trying to insert a fresh mailbox with a brand new id.
			await db.batch([
				db
					.delete(schema.emails)
					.where(eq(schema.emails.mailboxId, existing.id)),
				db
					.delete(schema.mailboxes)
					.where(
						and(
							eq(schema.mailboxes.id, existing.id),
							lte(schema.mailboxes.expiresAt, now),
						),
					),
			]);
			continue;
		}

		const mailbox: Mailbox = {
			id: nanoid(),
			address: normalized,
			token: nanoid(32),
			createdAt: now,
			lastUsedAt: now,
			expiresAt: new Date(now.getTime() + MAILBOX_TTL_MS),
			revision: 0,
		};

		try {
			await db.insert(schema.mailboxes).values(mailbox);
			return mailbox;
		} catch (error) {
			if (isUniqueViolation(error)) continue;
			throw error;
		}
	}

	return null;
}

/** Explicit delete from the UI. Expired rows are also handled by the purge. */
export async function destroyMailbox(
	db: DBDatabase,
	mailboxId: string | undefined,
	token: string | undefined,
) {
	if (!mailboxId || !token) return false;

	const existing = await db.query.mailboxes.findFirst({
		columns: { id: true },
		where: (mailboxes, { and, eq }) =>
			and(eq(mailboxes.id, mailboxId), eq(mailboxes.token, token)),
	});
	if (!existing) return false;

	await db.batch([
		db.delete(schema.emails).where(eq(schema.emails.mailboxId, existing.id)),
		db.delete(schema.mailboxes).where(eq(schema.mailboxes.id, existing.id)),
	]);
	return true;
}

/**
 * Removes expired mailboxes and every message that belongs to them.
 *
 * Reads already reject expired mailboxes, so this routine is about actually
 * reclaiming storage, not about access control. D1 enforces foreign keys, so
 * an inbound insert that raced a purge fails instead of creating an orphan.
 */
export async function purgeExpiredData(db: DBDatabase, now = new Date()) {
	let removedMailboxes = 0;

	for (let i = 0; i < PURGE_MAX_BATCHES; i++) {
		const expired = await db
			.select({ id: schema.mailboxes.id })
			.from(schema.mailboxes)
			.where(lte(schema.mailboxes.expiresAt, now))
			.orderBy(schema.mailboxes.expiresAt)
			.limit(PURGE_BATCH_SIZE);
		if (expired.length === 0) break;

		const ids = expired.map((mailbox) => mailbox.id);
		await db.batch([
			db.delete(schema.emails).where(inArray(schema.emails.mailboxId, ids)),
			db.delete(schema.mailboxes).where(inArray(schema.mailboxes.id, ids)),
		]);
		removedMailboxes += expired.length;

		if (expired.length < PURGE_BATCH_SIZE) break;
	}

	return { removedMailboxes };
}
