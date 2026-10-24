import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import type { Address } from "postal-mime";

/**
 * A temporary mailbox is the single source of truth for ownership.
 *
 * - `address` is unique. D1's unique index (not read-then-write KV) is what
 *   makes a claim atomic.
 * - `token` is a secret stored in the signed session cookie. A mailbox id is
 *   never reused, so an old session can never read a newly claimed mailbox
 *   that happens to have the same address.
 * - `expires_at` is a sliding inactivity deadline. Any authenticated read
 *   refreshes it; nothing else does. Expired mailboxes are inaccessible
 *   immediately and physically removed by the scheduled purge.
 * - `revision` changes whenever a message is stored, giving the inbox poll a
 *   cheap ETag without querying the emails table on 304 responses.
 */
export const mailboxes = sqliteTable(
	"mailboxes",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		address: text("address").notNull().unique(),
		token: text("token").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		lastUsedAt: integer("last_used_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		revision: integer("revision").notNull().default(0),
	},
	(table) => [index("mailboxes_expires_at_idx").on(table.expiresAt)],
);

/**
 * Messages are owned by a mailbox id, never by the address string.
 *
 * Reusing an address therefore cannot expose messages from its previous
 * owner: the new mailbox always gets a fresh id and all queries are scoped by
 * `mailbox_id`.
 */
export const emails = sqliteTable(
	"emails",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		mailboxId: text("mailbox_id")
			.notNull()
			.references(() => mailboxes.id, { onDelete: "cascade" }),
		messageFrom: text("message_from"),
		from: text("from", { mode: "json" }).$type<Address>().notNull(),
		sender: text("sender", { mode: "json" }).$type<Address>(),
		subject: text("subject"),
		html: text("html"),
		text: text("text"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index("emails_mailbox_created_at_idx").on(table.mailboxId, table.createdAt),
	],
);

export type Mailbox = typeof mailboxes.$inferSelect;
export type MailboxInsert = typeof mailboxes.$inferInsert;
export type Email = typeof emails.$inferSelect;
export type EmailInsert = typeof emails.$inferInsert;
