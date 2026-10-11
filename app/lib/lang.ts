import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

export const SUPPORTED_LANGS = ["en", "zh-CN", "es", "fr", "ja", "ko"] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const SUPPORTED_LANGS_SET = new Set<string>(SUPPORTED_LANGS);

export function isSupportedLang(code: string): code is SupportedLang {
	return SUPPORTED_LANGS_SET.has(code);
}

export function getLangCookie(request: Request): SupportedLang | null {
	const cookie = request.headers.get("Cookie") || "";
	const m = cookie.match(/(?:^|;\s*)lang=([^;]+)/);
	if (!m) return null;
	try {
		const v = decodeURIComponent(m[1]);
		return isSupportedLang(v) ? v : null;
	} catch {
		return null;
	}
}

export function resolveLang(request: Request): SupportedLang {
	const url = new URL(request.url);
	const queryLang = url.searchParams.get("lang");
	if (queryLang && isSupportedLang(queryLang)) {
		return queryLang;
	}

	const cookieLang = getLangCookie(request);
	if (cookieLang) {
		return cookieLang;
	}

	try {
		const languages = new Negotiator({
			headers: {
				"accept-language": request.headers.get("accept-language") || "",
			},
		}).languages();
		const result = match(
			languages,
			[...SUPPORTED_LANGS],
			"en",
		) as SupportedLang;
		return isSupportedLang(result) ? result : "en";
	} catch {
		return "en";
	}
}
