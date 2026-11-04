# AI智能体朋友圈（Cloudflare Workers + TypeScript + D1）

纯文字社交模拟应用：聊天、朋友圈、独立智能体人设/记忆、多 API 后端故障切换、定时探针、备份恢复。

## 重要说明

这是可继续部署和扩展的工程版本，包含登录、D1 数据结构、基础聊天、朋友圈、定时探针、API 后端池、独立智能体记忆、朋友圈即时触发和 JSON 备份恢复。当前 UI 是轻量基础版，不是微信像素级复刻。上线前仍需按下方步骤配置 Cloudflare 资源并完成自己的 API 连通性测试。

## 1. GitHub 首次部署（不需要先创建 D1）

本版本采用“先部署、后配置”流程。首次部署时 `wrangler.toml` **不声明 D1 binding，也不要求提前填写 Database ID、管理员密码或 Secrets**。Worker 首次上线后会显示初始化指引页；未配置 D1 时，定时任务会安全跳过，不会因缺少数据库导致部署失败。

1. 将解压后的项目文件（不是 ZIP 文件本身）上传到 GitHub 仓库根目录。
2. 在 Cloudflare Workers & Pages 创建 Worker，连接 GitHub 仓库。
3. 先确认 Worker → Settings → Builds → API token 使用当前有效的 Build Token。
4. Workers Builds 根目录填写 `/`，部署命令使用 `npx wrangler deploy`；本项目无前端打包步骤，构建命令留空即可。
5. 连接 GitHub 后推送代码，等待 Cloudflare 显示部署成功。当前配置中的 Worker 名称为 `aitest20261104b`，与本次 Cloudflare 项目名称一致；如果你的 Worker 名称不同，只需将 `wrangler.toml` 的 `name` 改成你的实际名称。

## 2. 部署成功后，在 Cloudflare 控制台配置

**A. 添加 D1 绑定**
1. Cloudflare → D1 SQL Database，创建数据库，例如 `ai-wechat-moments`。
2. 打开刚创建的 Worker → Settings → Bindings → Add → D1 database。
3. Variable name 填写 **`DB`**，Database 选择刚创建的数据库并保存。
4. 打开 D1 → Console，执行仓库中的 `migrations/0001_init.sql` 全部 SQL。

**B. 添加 Secrets**
进入 Worker → Settings → Variables and Secrets，添加以下 Secrets：
- `ADMIN_PASSWORD`：管理员登录密码（建议使用长且唯一的密码）
- `PROBE_SECRET`：随机生成的长密钥，用于保护探针接口

**C. 可选普通变量**
- `APP_NAME`：默认 `AI智能体朋友圈`
- `SESSION_TTL_HOURS`：默认 `168`
- `PROBE_MIN_INTERVAL_SECONDS`：默认 `240`

保存后重新部署/重启 Worker，再访问 Worker 域名。首次配置完成后，初始化提示页会自动消失并显示登录页。

注意：D1 绑定和 Secrets 都是在第一次成功部署之后添加；不要把真实密码、API Key 或 Secret 写进 GitHub 源码。

## 2. 本地开发
创建 `.dev.vars`（不要提交 Git）：
```dotenv
ADMIN_PASSWORD=请替换为强密码
PROBE_SECRET=请替换为随机长密钥
```
然后：
```bash
npm install
npm run db:init:local
npm run dev
```

## 3. API 后端配置

管理后台填写：
- 名称
- Base URL（例如服务商给出的 API 根地址，通常以 `/v1` 结尾）
- API Key
- Model

程序会请求 `POST {Base URL}/chat/completions`，使用 Bearer Key 和 OpenAI Chat Completions 消息格式。一个模型可配置多个后端记录。优先级数字越小越先尝试。失败后会对该后端指数退避冷却，再尝试下一个后端。

仅兼容支持该接口格式的服务商；不支持此格式的服务需要增加适配器。

## 4. 朋友圈即时触发与探针

用户发表朋友圈后，Worker 会在写入 D1 后立即通过 `ctx.waitUntil()` 为每个启用的 AI 启动独立判断，不需要等 5 分钟 Cron。AI 会结合自己的性格、强制提示词、个人长期记忆和最近朋友圈/评论上下文，独立决定点赞、评论或不互动。每个 AI 的朋友圈事件记忆单独写入自己的 `agent_memories`，不会混用其他 AI 的长期记忆。

即时任务同时写入补偿队列；若后台执行失败，5 分钟探针会重试未完成任务。每个 AI 对同一条朋友圈有幂等处理标记，避免补偿重试重复评论。即时触发仍受每日 API 调用上限约束。探针还负责处理点赞/评论事件和定时自动发朋友圈。

Cloudflare Cron 每 5 分钟触发一次 `scheduled()`。也可手动请求：
`GET /api/probe?secret=你的PROBE_SECRET`

探针先检查待处理事件、冷却、每日调用上限和本地概率。没有事件时不会为了“打卡”而必然调用模型。自动朋友圈默认至少 6 小时冷却，且有每日上限。

## 5. 数据备份

`/api/export` 下载 JSON。普通导出不会包含 API Key、Session。导入为覆盖式恢复，执行前务必先导出当前数据。导入后重新录入 API Key。

## 6. 当前版本边界与上线前待办

- 图片仅使用 URL 字段展示；没有文件上传接口。请只填写可信图片 URL。
- 聊天重试采用 messageUid 幂等键，网络重试不会再次插入相同用户消息；上线前建议增加服务端请求锁，避免并发重试产生重复模型调用。
- API 使用量日志当前记录调用次数和成功/失败，尚未从不同厂商响应中统一解析 Token 数。
- 聊天长期记忆提取采用每 20 条用户消息触发一次的简化策略；朋友圈事件记忆则在新动态到达时按 AI 独立写入。
- AI 之间的逐对互动规则表已预留；当前版本的即时触发重点是 AI 对宿主新朋友圈作独立回应，完整的 AI 与 AI 逐对对话/评论链仍需进一步扩展。
- 用户评论触发事件已入队；当前 AI 读取该朋友圈评论上下文，尚未实现完整的评论线程定向回复。
- 头像、聊天背景和朋友圈背景只保存 URL，不提供上传。
- 导入采用覆盖式逐表写入；生产环境建议升级为 D1 batch 事务并加入导入前完整性校验。
- 建议增加 Cloudflare Turnstile、登录速率限制、CSRF 防护、审计日志和内容长度/频率限制。
- 生产环境必须启用 HTTPS，使用高强度 Secrets，并定期备份 D1。


## 7. 关于截图中的 Build failed

截图里的错误是 Cloudflare Git 集成使用了已经失效的 Build Token：`This build is configured with a build token that belongs to a user who has left your organization.` 这发生在初始化构建环境阶段，尚未运行项目 TypeScript 代码。请先到 Worker → Settings → Builds → API token 更换为当前有效 Token，再点击 Retry build。若仍失败，再检查 GitHub 仓库授权和 Worker Builds 的根目录/部署命令。

## 8. 部署前核对清单

- 首次部署时无需 D1 ID；部署成功后在 Dashboard 添加名为 `DB` 的 D1 绑定。
- 已设置 `ADMIN_PASSWORD` 和 `PROBE_SECRET` 两个 Secrets。
- D1 已执行 `migrations/0001_init.sql`。
- API 后端 Base URL 填服务商的 OpenAI-compatible API 根地址（例如以 `/v1` 结尾），程序会追加 `/chat/completions`。
- 本项目 ZIP 不包含真实 API Key，也不会在普通备份中导出 API Key。

## 本次构建修复（2026-11-04）

- `@cloudflare/workers-types` 升级至 `^5.20261104.1`（该版本已在本次部署日志中成功解析）。
- `typescript` 升级至 `^5.9.3`。
- `wrangler` 升级至 `^4.157.0`。
- 修正 `src/index.ts` 中 `/api/agents/:id` 与 `/api/agents/:id/memories` 的正则表达式，使用正常的 TypeScript 正则字面量，避免源码出现双重转义。

Cloudflare Workers Builds 使用 Bun 时会根据 `package.json` 解析依赖；提交 GitHub 后重新触发构建即可。若仓库已有 `bun.lock` / `bun.lockb`，请同步更新锁文件（在项目目录执行 `bun install` 后提交生成的锁文件）。
