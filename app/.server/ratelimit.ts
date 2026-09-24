// Simple KV-backed fixed-window rate limiter for abuse-prone actions
// (mailbox claim). KV has no atomic increment, so this is best-effort:
// good enough to stop casual scripted abuse, not a hard security boundary.
// Turnstile remains the primary bot shield when configured.

export const CLAIM_LIMIT_PER_HOUR = 10;
const WINDOW_SECONDS = 60 * 60;

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
		const raw = await kv.get(key);
		const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
		if (count >= limit) return { allowed: false, remaining: 0 };
		const next = count + 1;
		// Refresh the window on first hit; subsequent hits keep original TTL
		// by only setting expiration when creating the key.
		if (count === 0) {
			await kv.put(key, String(next), { expirationTtl: WINDOW_SECONDS });
		} else {
			await kv.put(key, String(next));
		}
		return { allowed: true, remaining: Math.max(0, limit - next) };
	} catch (err) {
		console.error("Rate-limit check failed, allowing request:", err);
		// Fail open: a KV hiccup must not lock out legitimate users.
		return { allowed: true, remaining: limit };
	}
}
