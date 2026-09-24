// Secrets set via Cloudflare dashboard (not in wrangler.toml, so `wrangler
// types` cannot infer them). Merged with the generated `Env` in
// worker-configuration.d.ts.
interface Env {
	COOKIE_SECRET: string;
	TURNSTILE_SITE_KEY: string;
	TURNSTILE_SECRET_KEY?: string;
	PASSWORD: string;
}
