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

export async function getLocaleData(lang: string): Promise<Locale> {
	switch (lang) {
		case "en":
			return import("./en.json").then((m) => m.default);
		case "es":
			return import("./es.json").then((m) => m.default);
		case "fr":
			return import("./fr.json").then((m) => m.default);
		case "ja":
			return import("./ja.json").then((m) => m.default);
		case "ko":
			return import("./ko.json").then((m) => m.default);
		case "zh-CN":
			return import("./zh-CN.json").then((m) => m.default);
		default:
			return import("./en.json").then((m) => m.default);
	}
}
