# 日序 V0.3.3 登录接入

此版本只登录、恢复会话、退出及手动 GET /v1/me。首次登录不上传、不拉取、不清空 IndexedDB。账号是应用的 Neon Auth 用户，不是 Neon 控制台账号。

忘记密码：设置页选择“忘记密码”，输入已有用户邮箱，按邮件中的链接返回日序并设置新密码。控制台的 Create user 仅创建用户资料，不会设置可用于邮箱密码登录的密码。原密码不可读取。邮件发送依赖该 Auth 分支的邮件配置；预览环境先验证邮件送达和重置链接，未验证前不要声明流程可用。打开固定分支预览地址，确保它已加入 Neon Auth 可信域名。

控制台创建的无密码用户不能通过邮箱密码登录；重置请求的通用成功提示也不能证明发送了邮件。需要测试邮箱密码登录时，从日序的“创建账号”入口使用尚未在该 Auth 分支创建过用户的邮箱设置密码。不要删除已有用户或直接修改 Auth 数据表。新账号有不同用户 ID，验证 Worker `/v1/me` 前需把新 ID 加入服务端 `ALLOWED_USER_IDS` 白名单。

## 部署
1. 审查 PR；先部署隔离预览，确认后再合并 main。勿直接推送 main。
2. Cloudflare Pages 构建使用 npm ci && npm run build，输出 dist，Node >=22.12。
3. 在 Pages 的 Preview / Production 分别设置 VITE_NEON_AUTH_URL 与 VITE_SYNC_API_URL；参考 .env.example 的公开地址并在控制台确认归属。变量在构建时写入，修改后需重新构建。
4. Worker 配置 NEON_AUTH_BASE_URL、NEON_AUTH_JWKS_URL、ALLOWED_ORIGINS、ALLOWED_USER_IDS。DATABASE_URL 只放 Worker secret，绝不可放 VITE_ 变量。JWKS 使用该分支控制台给出的地址。
5. Neon Auth trusted domains 与 Worker ALLOWED_ORIGINS 都加入实际网页 origin（包含 https，不带末尾斜杠）；预览域名也须明确授权。
6. 用应用测试账号登录，点击“验证 API 身份”，确认 /v1/me 成功；退出、刷新、过期会话也需验收。不要把 JWT、密码或用户数据发到聊天或截图。

## JWT 核验依据
Neon 官方 Functions authentication 示例使用 new URL(NEON_AUTH_BASE_URL).origin 作为 issuer；Managed Better Auth 使用 EdDSA，令牌有效期 15 分钟。原补丁的完整路径 issuer 和额外算法已移除，并要求 sub、exp、iat。不得为通过验证而同时允许多个猜测的 issuer。
来源：https://github.com/neondatabase/website/blob/main/content/docs/compute/functions/authentication.md

尚未用真实账号令牌完成线上验证，因此文档规则核对不等于生产端到端验收。用户需在 Cloudflare/Neon 控制台确认环境值、域名与测试账号白名单；本次不读取数据库密码、不访问个人记录、不部署生产。

## 本次验证（2026-11-11）
- 基线 main：7b94432cd16b26b0771105d091b03d9d09ed4efd。
- SDK：@neon/auth 0.8.2；官方类型检查通过；使用 token().data.token。锁文件已更新，@better-fetch/fetch 固定补丁版本 1.3.3 以满足 peer 依赖。
- TypeScript 检查通过；前端 97/97，后端 8/8；正式 Vite 8.3.6 构建通过。
- 前后端 npm audit：0 漏洞。
- JWT 测试使用临时密钥和虚构用户，包含错误签名、issuer、过期与缺失必要声明；不使用真实 JWT。
- 尚未执行真实浏览器登录、生产 JWKS 联调或 Cloudflare 控制台配置核验；不宣称线上已可登录。
- 修复 Windows 离线测试构建启动方式；离线类型垫片仅服务离线测试，正式构建使用 SDK 自带类型。
