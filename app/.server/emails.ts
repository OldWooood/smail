import type { DBDatabase } from "~/.server/db";
import { formatEmailList } from "~/lib/email";

export const EMAIL_LIST_LIMIT = 50;

export type EmailListItem = {
	id: string;
	subject: string | null;
	createdAt: string;
	messageFrom: string | null;
	from: { name?: string | null; address?: string | null } | null;
	senderLabel: string;
};

export async function listEmails(db: DBDatabase, email: string, lang: string) {
	const emailData = await db.query.emails.findMany({
		columns: {
			id: true,
			subject: true,
			createdAt: true,
			messageFrom: true,
			from: true,
		},
		where: (emails, { eq }) => eq(emails.messageTo, email),
		limit: EMAIL_LIST_LIMIT,
		orderBy(fields, operators) {
			return [operators.desc(fields.createdAt)];
		},
	});
	return formatEmailList(emailData, lang).map((email) => ({
		...email,
		senderLabel:
			email.from?.name || email.from?.address || email.messageFrom || "",
	}));
}
