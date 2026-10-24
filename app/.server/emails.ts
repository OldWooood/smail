import type { DBDatabase } from "~/.server/db";
import { formatEmailList } from "~/lib/email";

export const EMAIL_LIST_LIMIT = 100;

export type EmailListItem = {
	id: string;
	subject: string | null;
	createdAt: string;
	messageFrom: string | null;
	from: { name?: string | null; address?: string | null } | null;
	senderLabel: string;
};

export async function listEmails(
	db: DBDatabase,
	mailboxId: string,
	lang: string,
) {
	const emailData = await db.query.emails.findMany({
		columns: {
			id: true,
			subject: true,
			createdAt: true,
			messageFrom: true,
			from: true,
		},
		where: (emails, { eq }) => eq(emails.mailboxId, mailboxId),
		limit: EMAIL_LIST_LIMIT,
		orderBy(fields, operators) {
			return [operators.desc(fields.createdAt)];
		},
	});
	return (await formatEmailList(emailData, lang)).map((email) => ({
		...email,
		senderLabel:
			email.from?.name || email.from?.address || email.messageFrom || "",
	}));
}

export async function findEmailMeta(
	db: DBDatabase,
	mailboxId: string,
	id: string,
) {
	return db.query.emails.findFirst({
		columns: {
			id: true,
			from: true,
			sender: true,
			messageFrom: true,
			subject: true,
			createdAt: true,
		},
		where: (emails, { and, eq }) =>
			and(eq(emails.id, id), eq(emails.mailboxId, mailboxId)),
	});
}

export async function findEmailBody(
	db: DBDatabase,
	mailboxId: string,
	id: string,
) {
	return db.query.emails.findFirst({
		columns: { id: true, html: true, text: true },
		where: (emails, { and, eq }) =>
			and(eq(emails.id, id), eq(emails.mailboxId, mailboxId)),
	});
}
