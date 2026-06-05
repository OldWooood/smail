import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

export function formatEmailList<T extends { createdAt: Date }>(
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
