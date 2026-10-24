-- Clean-slate mailbox rewrite.
--
-- The previous schema keyed messages by the recipient address and stored
-- mailbox ownership in KV. That allowed an expired address to be re-claimed
-- while its old messages were still readable, and the KV claim was not atomic.
--
-- This migration intentionally discards all existing mail and ownership rows.
-- The new schema is address-unique, mailbox-id-scoped, and has a sliding
-- 24-hour inactivity deadline.

DROP TABLE IF EXISTS `emails`;
--> statement-breakpoint
DROP TABLE IF EXISTS `mailboxes`;
--> statement-breakpoint

CREATE TABLE `mailboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailboxes_address_unique` ON `mailboxes` (`address`);
--> statement-breakpoint
CREATE INDEX `mailboxes_expires_at_idx` ON `mailboxes` (`expires_at`);
--> statement-breakpoint

CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`message_from` text,
	`from` text NOT NULL,
	`sender` text,
	`subject` text,
	`html` text,
	`text` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `emails_mailbox_created_at_idx` ON `emails` (`mailbox_id`,`created_at`);
