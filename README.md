<p align="center">
  <a href="https://email.deatrg.top/" target="_blank" rel="noopener">
    <img width="120" src="./public/favicon.svg" alt="TempEmail logo">
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
- Mailbox and all its mail are deleted after 24 hours of inactivity
- Live inbox that auto-refreshes every 10 seconds
- Email detail view with sender and time
- 6 languages: English, 简体中文, Español, Français, 日本語, 한국어
- Light and dark themes
- Cloudflare Turnstile protection
- Optional password protection
- Fully self-hostable, no vendor lock-in

## Tech Stack

- [React Router v7](https://react.dev/) (Framework Mode) + Vite 7, Tailwind CSS v4
- [Cloudflare Workers](https://workers.cloudflare.com/) + Email Workers + Static Assets
- [D1](https://developers.cloudflare.com/d1/) (SQLite) as the source of truth for mailboxes and messages, via [drizzle-orm](https://orm.drizzle.team/)
- [KV](https://developers.cloudflare.com/kv/) only for mailbox-creation rate limiting
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)

## Architecture

D1 is the primary datastore. KV does not hold mailbox ownership or inbox state.

- `mailboxes`: one row per active address. `address` has a unique index, so concurrent claims are atomic. `token` proves ownership from the signed session cookie, `expires_at` is the sliding 24-hour inactivity deadline, and `revision` drives the inbox ETag.
- `emails`: every message is keyed by `mailbox_id`, never by recipient address. Reusing an address always creates a new mailbox id, so a new owner can never read the previous owner's mail. A foreign key cascades deletes.
- Every mailbox read validates `mailbox_id + token + expires_at` against D1. Expired mailboxes are rejected immediately even if the physical purge has not run yet.
- Owner activity refreshes `expires_at`, throttled to at most one write every 10 minutes. A scheduled Worker removes expired mailboxes and all their messages every 15 minutes.
- Incoming mail checks the active mailbox row before parsing, then stores the message and increments `revision` in one D1 batch. Raw MIME bytes are passed to `postal-mime`, so non-UTF-8 bodies are decoded correctly.
- The inbox poll sends an `If-None-Match` ETag. A no-change poll costs one D1 row read and does not query the `emails` table.

### D1 free tier

The Workers Free plan includes 5 million rows read and 100,000 rows written per day. This design keeps a no-change poll at about one row read; the email list is only read when `revision` changes. Keep the indexes created by the migrations and avoid full-table scans. Raising the inbox refresh interval from 10 seconds reduces Worker requests and D1 reads proportionally.

## Quick Start

1. Open [email.deatrg.top](https://email.deatrg.top/)
2. Type a custom username, or leave it blank for a random address
3. Click **Create inbox** and start using it right away
4. The inbox refreshes automatically; the mailbox expires after 24 hours without activity and its messages are deleted with it

## Self-host

### Prerequisites

- A Cloudflare account
- A domain on Cloudflare with [Email Routing](https://developers.cloudflare.com/email-routing/) enabled
- A D1 database, plus a KV namespace for mailbox-creation rate limiting

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

   Upgrading from the old KV-claim implementation? Run the one-off cleanup
   script instead. It deletes legacy KV keys and applies the same migrations.
   Migration `0004` drops the old `emails` table, so old mail is intentionally
   discarded:

```bash
bash scripts/cleanup-legacy.sh
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
| `COOKIE_SECRET`     | yes      | Secret used to sign session cookies          |
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
| `pnpm dev`       | Start the React Router dev server (workerd) |
| `pnpm build`     | Build client, server and worker      |
| `pnpm deploy`    | Build and deploy to Cloudflare       |
| `pnpm lint`      | Run Biome check                      |
| `pnpm typecheck` | Run React Router typegen + TypeScript checks |
| `pnpm format`    | Format with Biome                    |
| `pnpm db:generate` | Generate a Drizzle migration from the schema |

## Credits

- This project is a fork of [Smail](https://github.com/akazwz/smail). Huge
  thanks to the original author.
- [Email.ML](https://email.ml)
