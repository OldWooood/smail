import { createCookie, createCookieSessionStorage } from "react-router";

type SessionData = {
	authed?: boolean;
	mailboxId?: string;
	mailboxToken?: string;
};

// Fail closed: silently falling back to a public constant would let anyone
// forge session cookies (and bypass PASSWORD protection) on a misconfigured
// deploy. Set COOKIE_SECRET via dashboard secrets / .dev.vars instead.
function requireSecret(env: Env): string {
	const secret = env.COOKIE_SECRET;
	if (!secret) {
		throw new Error(
			"Missing COOKIE_SECRET. Set it via Cloudflare secrets (production) or .dev.vars (local dev).",
		);
	}
	return secret;
}

// Cache storage per secret instead of a global singleton so secret rotation
// (or preview vs production bindings sharing an isolate) can't pin the first
// secret forever.
const storageCache = new Map<
	string,
	ReturnType<typeof createCookieSessionStorage<SessionData>>
>();

export function sessionWrapper(env: Env) {
	const secret = requireSecret(env);
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
		secrets: [requireSecret(env)],
		sameSite: "lax",
		httpOnly: true,
		secure: true,
		path: "/",
		// The cookie is only a bearer credential for the mailbox row. Actual
		// expiry is enforced by mailboxes.expires_at.
		maxAge: 60 * 60 * 24 * 30,
	});
}
