// Server-side Cloudflare Turnstile verification.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export async function verifyTurnstile(
	token: string,
	secret: string,
	remoteIp?: string | null,
): Promise<boolean> {
	if (!token || !secret) return false;
	try {
		const body = new URLSearchParams();
		body.set("secret", secret);
		body.set("response", token);
		if (remoteIp) body.set("remoteip", remoteIp);
		const res = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{ method: "POST", body },
		);
		if (!res.ok) return false;
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}
