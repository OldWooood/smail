// Simple KV-backed fixed-window rate limiter for abuse-prone actions
// (mailbox claim). KV has no atomic increment, so this is best-effort:
// good enough to stop casual scripted abuse, not a hard security boundary.
// Turnstile remains the primary bot shield when configured.

export const CLAIM_LIMIT_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000;

type RateLimitState = {
	start: number;
	count: number;
};

function rateLimitKey(ip: string) {
	return `ratelimit:claim:${ip}`;
}

export function getClientIp(request: Request): string {
	const cfIp = request.headers.get("CF-Connecting-IP");
	if (cfIp) return cfIp.trim().split(",")[0].trim();
	const forwarded = request.headers.get("X-Forwarded-For");
	if (forwarded) return forwarded.split(",")[0].trim();
	return "unknown";
}

export async function checkClaimRateLimit(
	kv: KVNamespace,
	ip: string,
	limit = CLAIM_LIMIT_PER_HOUR,
): Promise<{ allowed: boolean; remaining: number }> {
	if (!ip || ip === "unknown") return { allowed: true, remaining: limit };
	const key = rateLimitKey(ip);
	try {
		const now = Date.now();
		const raw = await kv.get<RateLimitState>(key, "json");
		const state =
			raw && Number.isFinite(raw.start) && Number.isFinite(raw.count)
				? raw
				: null;
		let start = now;
		let count = 0;
		if (state && now - state.start < WINDOW_MS) {
			start = state.start;
			count = state.count;
		}

		if (count >= limit) return { allowed: false, remaining: 0 };

		const next = count + 1;
		const remainingTtlSeconds = Math.max(
			60,
			Math.ceil((start + WINDOW_MS - now) / 1000),
		);
		// Always write an expiry. A bare `put` would drop the previous TTL and
		// turn a one-hour window into a permanent IP lockout.
		await kv.put(key, JSON.stringify({ start, count: next }), {
			expirationTtl: remainingTtlSeconds,
		});
		return { allowed: true, remaining: Math.max(0, limit - next) };
	} catch (err) {
		console.error("Rate-limit check failed, allowing request:", err);
		// Fail open: a KV hiccup must not lock out legitimate users.
		return { allowed: true, remaining: limit };
	}
}
