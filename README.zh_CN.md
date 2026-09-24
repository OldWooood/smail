<p align="center">
  <a href="https://email.deatrg.top/" target="_blank" rel="noopener">
    <img width="120" src="./public/favicon.png" alt="TempEmail logo">
  </a>
</p>
<p align="center">
  <a href="./README.md">English</a> | 简体中文
</p>

# TempEmail

一个快速、私密、开源的临时邮箱服务。一键获取一次性地址,无需注册,无追踪。基于 Cloudflare Workers,几分钟即可自建部署。

**在线体验: [email.deatrg.top](https://email.deatrg.top/)**

## 功能特性

- 一键获取临时邮箱,无需注册账号
- 支持自定义用户名或随机生成的地址
- 邮箱 24 小时后自动过期
- 收件箱每 10 秒自动刷新
- 邮件详情页,展示发件人与时间
- 支持 6 种语言:English、简体中文、Español、Français、日本語、한국어
- 浅色 / 深色主题
- Cloudflare Turnstile 人机验证
- 可选密码保护
- 完全开源,支持自建,无厂商锁定

## 技术栈

- [React Router v7](https://react.dev/)（Framework Mode）+ Vite 7，Tailwind CSS v4
- [Cloudflare Workers](https://workers.cloudflare.com/) + Email Workers 收信 + Static Assets
- [D1](https://developers.cloudflare.com/d1/)(SQLite)+ [KV](https://developers.cloudflare.com/kv/)，基于 [drizzle-orm](https://orm.drizzle.team/)
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)

## 快速开始

1. 打开 [email.deatrg.top](https://email.deatrg.top/)
2. 输入自定义用户名,或留空获取随机地址
3. 点击**获取邮箱**,立即开始使用
4. 收件箱自动刷新,邮箱 24 小时后过期

## 自建部署

### 前置条件

- Cloudflare 账号
- 已在 Cloudflare 托管并开启[电子邮件路由](https://developers.cloudflare.com/email-routing/)的域名
- 在 Workers 中创建好的 KV 和 D1 数据库

### 部署步骤

```bash
git clone https://github.com/OldWooood/smail.git
cd smail
pnpm install
```

1. 修改 `wrangler.toml`:将 KV 命名空间 id 和 D1 数据库 id 替换为你自己的,并设置 `DOMAIN` 为你的域名
2. 迁移数据库:

```bash
pnpm wrangler d1 migrations apply smail --remote
```

3. 部署:

```bash
pnpm run deploy
```

4. 配置环境变量(Worker 设置,变量和机密):

| 变量                | 必填 | 说明                                 |
| ------------------- | ---- | ------------------------------------ |
| `DOMAIN`            | 是   | 你的邮箱域名,如 `temp.example.com`  |
| `COOKIE_SECRET`     | 是   | 用于加密会话 Cookie 的密钥           |
| `TURNSTILE_SITE_KEY`| 否   | Cloudflare Turnstile 站点密钥        |
| `PASSWORD`          | 否   | 设置后访问需要输入此密码             |

5. 配置邮件路由:域名管理,电子邮件,路由规则,Catch-all 地址,选择发送到已部署的 Worker

### 本地开发

```bash
pnpm install
pnpm dev
```

### 常用脚本

| 命令            | 说明                     |
| --------------- | ------------------------ |
| `pnpm dev`      | 启动 React Router 开发服务器（workerd） |
| `pnpm build`    | 构建客户端、服务端与 Worker |
| `pnpm deploy`   | 构建并部署到 Cloudflare  |
| `pnpm lint`     | 运行 Biome 检查          |
| `pnpm typecheck`| React Router typegen + TypeScript 类型检查 |
| `pnpm format`   | 使用 Biome 格式化代码    |

## 鸣谢

- 本项目 Fork 自 [Smail](https://github.com/akazwz/smail),感谢原作者。
- [Email.ML](https://email.ml)
