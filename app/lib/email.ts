import { format, formatDistanceToNow } from "date-fns";
import type { Locale as DateLocale } from "date-fns/locale";

// Load date-fns locales on demand instead of statically importing all six.
// Static imports would pull every locale into the worker bundle.
const localePromiseCache = new Map<string, Promise<DateLocale>>();

function loadDateLocale(lang: string): Promise<DateLocale> {
	const cached = localePromiseCache.get(lang);
	if (cached) return cached;
	let task: Promise<DateLocale>;
	switch (lang) {
		case "zh-CN":
			task = import("date-fns/locale/zh-CN").then((m) => m.zhCN);
			break;
		case "es":
			task = import("date-fns/locale/es").then((m) => m.es);
			break;
		case "fr":
			task = import("date-fns/locale/fr").then((m) => m.fr);
			break;
		case "ja":
			task = import("date-fns/locale/ja").then((m) => m.ja);
			break;
		case "ko":
			task = import("date-fns/locale/ko").then((m) => m.ko);
			break;
		default:
			task = import("date-fns/locale/en-US").then((m) => m.enUS);
			break;
	}
	localePromiseCache.set(lang, task);
	return task;
}

export async function formatEmailList<T extends { createdAt: Date }>(
	emailList: T[],
	lang: string,
) {
	const dateLocale = await loadDateLocale(lang);
	return emailList.map((email) => ({
		...email,
		createdAt: formatDistanceToNow(email.createdAt, {
			addSuffix: true,
			locale: dateLocale,
		}),
	}));
}

export async function formatEmailDate(date: Date, lang: string) {
	const dateLocale = await loadDateLocale(lang);
	return format(date, "PPP p", { locale: dateLocale });
}
