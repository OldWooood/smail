import {
	createCookie,
	createWorkersKVSessionStorage,
} from "@remix-run/cloudflare";

type SessionData = {
	email?: string;
	password?: string;
	mailboxToken?: string;
};

const DEFAULT_COOKIE_SECRET = "defalt_secret";

let storage: ReturnType<typeof createWorkersKVSessionStorage<SessionData>> | null = null;

export function sessionWrapper(env: Env) {
	if (!storage) {
		const sessionCookie = cookieWrapper(env);
		storage = createWorkersKVSessionStorage<SessionData>({
			kv: env.KV,
			cookie: sessionCookie,
		});
	}
	return storage;
}

export function cookieWrapper(env: Env) {
	return createCookie("__session", {
		secrets: [env.COOKIE_SECRET || DEFAULT_COOKIE_SECRET],
		sameSite: true,
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 30,
	});
}
