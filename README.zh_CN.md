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
- 邮箱 24 小时未使用后自动删除，地址独占与全部邮件一并清除
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
- [D1](https://developers.cloudflare.com/d1/)(SQLite) 作为邮箱和邮件的主存储，通过 [drizzle-orm](https://orm.drizzle.team/) 访问
- [KV](https://developers.cloudflare.com/kv/) 仅用于创建邮箱的 IP 限流
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)

## 架构说明

D1 是唯一主存储，KV 不再保存邮箱归属或收件箱状态。

- `mailboxes`：每个活跃地址一行。`address` 有唯一索引，因此并发认领是原子的；`token` 用于签名 Cookie 校验归属；`expires_at` 是 24 小时未活动过期时间；`revision` 用于收件箱 ETag。
- `emails`：所有邮件都按 `mailbox_id` 归属，不按收件地址关联。地址被重新认领时会生成全新的 mailbox id，新使用者不可能读到上一任的邮件；外键删除会级联清理。
- 每次读取都会校验 `mailbox_id + token + expires_at`。邮箱过期后立即拒绝访问，即使定时清理还没执行。
- 用户访问会刷新 `expires_at`，最多每 10 分钟写一次；定时 Worker 每 15 分钟删除过期邮箱及其全部邮件。
- 收信时先查活跃邮箱，再解析原始 MIME；邮件写入和 `revision` 自增在同一个 D1 batch 中，轮询不会读到中间状态。原始字节直接交给 `postal-mime`，非 UTF-8 正文不会乱码。
- 收件箱轮询使用 `If-None-Match` ETag：没有新邮件时只产生 1 行 D1 读取，不会查询 `emails` 表。

### D1 免费额度

Workers Free 每日包含 500 万行读取和 10 万行写入。当前设计下，无变化的轮询约消耗 1 行读取，只有 `revision` 变化时才查询邮件列表。请保留迁移创建的索引，避免全表扫描。把收件箱 10 秒轮询改成更长的间隔，可以按比例降低 Worker 请求和 D1 读取。

## 快速开始

1. 打开 [email.deatrg.top](https://email.deatrg.top/)
2. 输入自定义用户名,或留空获取随机地址
3. 点击**创建收件箱**,立即开始使用
4. 收件箱自动刷新，邮箱连续 24 小时未使用即过期，并删除其中的全部邮件

## 自建部署

### 前置条件

- Cloudflare 账号
- 已在 Cloudflare 托管并开启[电子邮件路由](https://developers.cloudflare.com/email-routing/)的域名
- 一个 D1 数据库，以及一个用于创建邮箱限流的 KV 命名空间

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

   如果是从旧的 KV 独占实现升级，直接运行一次性清理脚本即可（会清除旧
   KV 键并执行同样的迁移）。`0004` 迁移会直接删除旧的 `emails` 表，旧邮件
   会被有意丢弃：

```bash
bash scripts/cleanup-legacy.sh
```

3. 部署:

```bash
pnpm run deploy
```

4. 配置环境变量(Worker 设置,变量和机密):

| 变量                | 必填 | 说明                                 |
| ------------------- | ---- | ------------------------------------ |
| `DOMAIN`            | 是   | 你的邮箱域名,如 `temp.example.com`  |
| `COOKIE_SECRET`     | 是   | 用于签名会话 Cookie 的密钥           |
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
| `pnpm db:generate` | 根据 schema 生成 Drizzle 迁移 |

## 鸣谢

- 本项目 Fork 自 [Smail](https://github.com/akazwz/smail),感谢原作者。
- [Email.ML](https://email.ml)
