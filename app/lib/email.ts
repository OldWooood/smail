import { format, formatDistanceToNow } from "date-fns";
import {
	type Locale as DateLocale,
	enUS,
	es,
	fr,
	ja,
	ko,
	zhCN,
} from "date-fns/locale";

const localeMap: Record<string, DateLocale> = {
	en: enUS,
	"zh-CN": zhCN,
	es: es,
	fr: fr,
	ja: ja,
	ko: ko,
};

function getDateLocale(lang: string): DateLocale {
	return localeMap[lang] || enUS;
}

export function formatEmailList<T extends { createdAt: Date }>(
	emailList: T[],
	lang: string,
) {
	const dateLocale = getDateLocale(lang);
	return emailList.map((email) => ({
		...email,
		createdAt: formatDistanceToNow(email.createdAt, {
			addSuffix: true,
			locale: dateLocale,
		}),
	}));
}

export function formatEmailDate(date: Date, lang: string) {
	return format(date, "PPP p", { locale: getDateLocale(lang) });
}
