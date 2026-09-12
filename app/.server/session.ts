import {
	createCookie,
	createCookieSessionStorage,
} from "@remix-run/cloudflare";

type SessionData = {
	email?: string;
	authed?: boolean;
	// legacy: older cookies stored the raw password; still accepted on read
	password?: string;
	mailboxToken?: string;
};

const DEFAULT_COOKIE_SECRET = "defalt_secret";

// Cache storage per secret instead of a global singleton so secret rotation
// (or preview vs production bindings sharing an isolate) can't pin the first
// secret forever.
const storageCache = new Map<
	string,
	ReturnType<typeof createCookieSessionStorage<SessionData>>
>();

export function sessionWrapper(env: Env) {
	const secret = env.COOKIE_SECRET || DEFAULT_COOKIE_SECRET;
	const cached = storageCache.get(secret);
	if (cached) return cached;
	const sessionCookie = cookieWrapper(env);
	const fresh = createCookieSessionStorage<SessionData>({
		cookie: sessionCookie,
	});
	storageCache.set(secret, fresh);
	return fresh;
}

export function cookieWrapper(env: Env) {
	return createCookie("__session", {
		secrets: [env.COOKIE_SECRET || DEFAULT_COOKIE_SECRET],
		sameSite: true,
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 30,
	});
}
