export interface Locale {
	title: string;
	description: string;
	button: string;
	card_description: string;
	email_list: string;
	email_empty: string;
	email_detail: string;
	custom_email: {
		label: string;
		placeholder: string;
		hint: string;
		error_taken: string;
		error_invalid: string;
	};
	features: {
		title: string;
		description: string;
	}[];
	auth: {
		title: string;
		msg: string;
		submit: string;
	};
}

const localeCache = new Map<string, Locale>();

export async function getLocaleData(lang: string): Promise<Locale> {
	const cached = localeCache.get(lang);
	if (cached) return cached;
	let data: Locale;
	switch (lang) {
		case "en":
			data = (await import("./en.json")).default;
			break;
		case "es":
			data = (await import("./es.json")).default;
			break;
		case "fr":
			data = (await import("./fr.json")).default;
			break;
		case "ja":
			data = (await import("./ja.json")).default;
			break;
		case "ko":
			data = (await import("./ko.json")).default;
			break;
		case "zh-CN":
			data = (await import("./zh-CN.json")).default;
			break;
		default:
			data = (await import("./en.json")).default;
			break;
	}
	localeCache.set(lang, data);
	return data;
}
