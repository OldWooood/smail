<p align="center">
  <a href="https://email.deatrg.top/" target="_blank" rel="noopener">
    <img width="120" src="./public/favicon.png" alt="TempEmail logo">
  </a>
</p>
<p align="center">
  English | <a href="./README.zh_CN.md">简体中文</a>
</p>

# TempEmail

A fast, private, and open-source temporary email service. Get a disposable
address in one click, no sign-up, no tracking. Deploy your own instance on
Cloudflare Workers in minutes.

**Live demo: [email.deatrg.top](https://email.deatrg.top/)**

## Features

- One-click disposable inbox, no account required
- Custom username or random generated address
- Mailbox expires after 24 hours
- Live inbox that auto-refreshes every 10 seconds
- Email detail view with sender and time
- 6 languages: English, 简体中文, Español, Français, 日本語, 한국어
- Light and dark themes
- Cloudflare Turnstile protection
- Optional password protection
- Fully self-hostable, no vendor lock-in

## Tech Stack

- [Remix](https://remix.run/) + Vite, Tailwind CSS
- [Cloudflare Workers](https://workers.cloudflare.com/) + Email Workers
- [D1](https://developers.cloudflare.com/d1/) (SQLite) + [KV](https://developers.cloudflare.com/kv/) via [drizzle-orm](https://orm.drizzle.team/)
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)

## Quick Start

1. Open [email.deatrg.top](https://email.deatrg.top/)
2. Type a custom username, or leave it blank for a random address
3. Click **Get Email** and start using it right away
4. The inbox refreshes automatically; the mailbox expires after 24 hours

## Self-host

### Prerequisites

- A Cloudflare account
- A domain on Cloudflare with [Email Routing](https://developers.cloudflare.com/email-routing/) enabled
- KV and D1 databases created in Workers / Pages

### Deploy

```bash
git clone https://github.com/OldWooood/smail.git
cd smail
pnpm install
```

1. Edit `wrangler.toml`: replace the KV namespace id and D1 database id with
   your own, and set `DOMAIN` to your domain
2. Migrate the database:

```bash
pnpm wrangler d1 migrations apply smail --remote
```

3. Deploy:

```bash
pnpm run deploy
```

4. Set the required environment variables (Worker settings, Variables and
   Secrets):

| Variable            | Required | Description                                  |
| ------------------- | -------- | -------------------------------------------- |
| `DOMAIN`            | yes      | Your mail domain, e.g. `temp.example.com`    |
| `COOKIE_SECRET`     | yes      | Secret used to encrypt session cookies       |
| `TURNSTILE_SITE_KEY`| no       | Cloudflare Turnstile site key                |
| `PASSWORD`          | no       | If set, access requires this password        |

5. Configure email routing: Domain dashboard, Email, Routing Rules, Catch-all
   address. Send the catch-all to the deployed Worker.

### Development

```bash
pnpm install
pnpm dev
```

### Scripts

| Script           | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Start the Remix dev server           |
| `pnpm build`     | Build client, server and worker      |
| `pnpm deploy`    | Build and deploy to Cloudflare       |
| `pnpm lint`      | Run ESLint                           |
| `pnpm typecheck` | Run TypeScript checks                |
| `pnpm format`    | Format with Biome                    |

## Credits

- This project is a fork of [Smail](https://github.com/akazwz/smail). Huge
  thanks to the original author.
- [Email.ML](https://email.ml)
