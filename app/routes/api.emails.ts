import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { d1Wrapper } from "~/.server/db";
import { sessionWrapper } from "~/.server/session";

const EMAIL_LIST_LIMIT = 50;

function formatEmailList<T extends { createdAt: Date }>(
	emailList: T[],
	lang: string
) {
	return emailList.map((email) => ({
		...email,
		createdAt: formatDistanceToNow(email.createdAt, {
			addSuffix: true,
			locale: lang === "en" ? enUS : zhCN,
		}),
	}));
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const { getSession } = sessionWrapper(context.cloudflare.env);
	const lang = params.lang || "en";
	const session = await getSession(request.headers.get("Cookie"));
	const email = session.data.email;

	if (!email) {
		return json({ emails: [] });
	}

	const db = d1Wrapper(context.cloudflare.env.DB);
	const emails = await db.query.emails.findMany({
		columns: {
			id: true,
			subject: true,
			createdAt: true,
		},
		where: (emails, { eq }) => eq(emails.messageTo, email),
		limit: EMAIL_LIST_LIMIT,
		orderBy(fields, operators) {
			return [operators.desc(fields.createdAt)];
		},
	});

	const formattedEmails = formatEmailList(emails, lang);
	return json({ emails: formattedEmails });
}
