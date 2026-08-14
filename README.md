<p align="center">
  <span>
   English | 
   <a href="https://github.com/akazwz/smail/blob/main/README.zh_CN.md">简体中文</a>
  </span>
<p>
<br />
<p align="center">
  <a href="https://email.deatrg.top/" target="_blank" rel="noopener">
    <img width="120" src="./public/favicon.png" alt="TempEmail logo">
  </a>
</p>
<br/>
<div align="center">
  <p>Use cloudflare worker to quickly build a temporary email service<p>
</div>

# TempEmail 📨
- 📁Use Cloudflare Email Workers to receive emails
- 🖼Provide a modern web application
- 💡One worker to get started quickly

## Quick Start
- Click [TempEmail](https://email.deatrg.top/) to start
- Follow the instructions below to build your service

## Prerequisites
- cloudflare account
- Domain name in cloudflare and enable email routing function (enable in domain email settings)
- Create KV and D1 databases in Workers and Pages

## Self-built
- star this repository (not necessary, lmao, but thank you for the star)
- clone the repository, modify the KV id and D1 database id in wrangler.toml to your own
- Migrate the database, run pnpm wrangler d1 migrations apply smail --remote
- Deploy the worker, run pnpm run deploy
- Add environment variables, enter worker settings->variables and secrets: set COOKIE_SECRET: key for encrypting cookies, DOMAIN: your domain name
- Enter domain management->email->routing rules->Catch-all address. Here choose to send to the worker, and then select the created worker

finished: visit your worker, you can customize the domain name for the worker as needed. If the project is updated later, you can synchronize it in your forked repository, and it will be automatically deployed

### Other features
- Password protection: set PASSWORD in cf worker environment variables, access requires password

## Credits
- This project is a fork of [Smail](https://github.com/akazwz/smail). Huge thanks to the original author.
- [Email.ML](https://email.ml)
