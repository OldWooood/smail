export interface Locale {
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
	auth: {
		title: string;
		msg: string;
		submit: string;
	};
	hero: {
		badge: string;
		title_a: string;
		title_b: string;
		subtitle: string;
	};
	form: {
		get_started: string;
		create_address: string;
		creating: string;
	};
	list: {
		refresh: string;
		refresh_failed: string;
		no_subject: string;
		waiting: string;
		count_one: string;
		count_other: string;
		notification_title: string;
		notification_body: string;
	};
	detail: {
		back: string;
		view_details: string;
	};
	mailbox: {
		copy: string;
		delete: string;
	};
	nav: {
		tagline: string;
		light_mode: string;
		dark_mode: string;
	};
	chip: {
		welcome: string;
		just_now: string;
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
