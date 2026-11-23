# 日序实现、验收与发布状态

截至 2026-11-23（Asia/Shanghai）。这是可更新快照；新会话必须重新读取分支和 PR，不能将此处提交号视为永久最新状态。

## 当前范围

用户选择个人自用，暂缓自有发信服务/域名和公开注册准备。最新交接顺序为：认证可靠性与上线验收 → 可靠同步 → 安卓完善与后台提醒。已生成的安卓首包不删除，也不将其当成已完成真机或长期可用验收。

## 仓库与部署

- 仓库：https://github.com/ryderzika2015-tech/rixu
- main：7b94432，当前生产代码基线；旧 README 中 V0.3.2 内容是历史说明，main 提交也已包含后端同步接口基础。
- 认证分支 codex/neon-auth-v033：d641efc，[Draft PR #1](https://github.com/ryderzika2015-tech/rixu/pull/1)，未合并到 main。
- 安卓分支 codex/android-personal-v034：2aba105，[Draft PR #2](https://github.com/ryderzika2015-tech/rixu/pull/2)，基于认证分支，PR 目标也是认证分支，未合并。
- 正式网页：https://rixu-web.pages.dev
- 固定认证预览：https://codex-neon-auth-v033.rixu-web.pages.dev
- Worker API：https://rixu-api.ryderzika2015.workers.dev
- Neon：rixu-prod，新加坡，neondb，Better Auth。用户交接记录已建立 rixu.records、rixu.sync_receipts；本次文档核对未查询真实业务记录或重新审计数据库。

## 已实现与证据

| 范围 | 代码/界面状态 | 验证证据 | 发布边界 |
| --- | --- | --- | --- |
| 计划、记账、专注、复盘、备份 | 有现有 domain、storage、services、pages、components 实现 | 多轮领域和存储测试；不等于完整产品规格逐项验收 | 现有网页基线，后续修改须保留数据 |
| 邮箱注册、登录、会话恢复、退出、密码重置、手动 API 身份验证 | 认证分支已实现 | 用户实测刷新/重开保持会话、数据保留、无自动同步、退出、重置邮件和登录、API 验证通过 | 预览部署成功，PR #1 未合并 |
| 邮箱验证码 | 输入、发送/重发、未验证登录入口已实现 | 用户已完成真实收码验证；曾需 F5 隐藏验证区域，d641efc 已修复即时状态更新，103 项测试与预览构建通过 | 修复后的即时反馈尚待用户重新确认；不能再把全部验证码流程记成从未验收 |
| 同步基础 | 本地 outbox、HTTP pull/push、后端用户过滤、版本与幂等基础存在 | 有协议/JWT 等测试；历史后端 8 项通过，本次文档任务未重跑 | 客户端完整同步调度、首次合并确认、冲突恢复、端到端多端验收未完成，未开启自动同步 |
| Android 首包 | Capacitor 工程生成脚本、离线入口、原生备份分享已实现；仍使用 IndexedDB | 106 项测试、正式构建、[APK 构建 45148331359](https://github.com/ryderzika2015-tech/rixu/actions/runs/45148331359) 成功；安装包已交付 | 个人离线调试包，无云登录/同步；华为真机、进程重开数据、导入导出待用户反馈，长期私有签名未配置 |
| 原生提醒/SQLite/AI | notifications 为未连接适配器，SQLite 仅契约；AI 为未配置占位 | 不得将前台提醒或类型契约算成已接入 | 尚未上线 |

## 已核对的云端配置

- Pages 生产分支 main；Production、Preview 分别有 VITE_NEON_AUTH_URL 和 VITE_SYNC_API_URL（Text、公开地址）。已见成功部署截图。
- Worker 生产截图显示五个 Secret 名称：DATABASE_URL、NEON_AUTH_BASE_URL、NEON_AUTH_JWKS_URL、ALLOWED_USER_IDS、ALLOWED_ORIGINS。仅确认存在，不展示或读取其敏感值。
- 用户明确确认 ALLOWED_ORIGINS 含生产和固定预览 origin；两个测试账号已在预览站通过 API 身份验证。
- 网页 Preview 目前调用同一生产 Worker；Worker Previews Base 为空，未设置独立 Worker Preview，不能认为后端资源已隔离。
- Neon 生产 Auth 的可信域名含两个网页 origin；此前只读查到 Shared 邮件、未要求注册邮箱验证、允许 localhost。生产与预览共用该 Auth 分支。后续变更需重新核对，并取得具体配置授权。
- 公开注册所需的自有邮件服务、强制邮箱验证、Google 自有凭据等准备已暂缓；不能将这些当成完成个人离线 APK 的必要条件。对外开放前仍需重新评估。

## 下一步与未解决风险

1. 按个人使用范围完成认证回归与可审查的发布/回滚方案，确认后才合并或发布；用户可先反馈已交付 APK 的真机结果。
2. 多端同步前解决本地账号归属、跨账号隐私、首次同步明确确认、持久队列、幂等重试、冲突与删除同步。不能简单移除 ALLOWED_USER_IDS 或复用 local-only outbox 即宣称同步完成。
3. 安卓后续固定签名、版本升级保留数据，验收华为 WebView、系统中断、后台/锁屏提醒和权限，SQLite 另行迁移设计。
4. 当前同浏览器换账号仍可见同一批本地数据；只增加提示未实现隔离。个人离线 APK 不提供账号切换，不能把这个限制说成网页隔离已完成。
5. GET /health 不检查数据库，GET /v1/me 不访问同步业务表；成功不能证明数据库或云同步可用。cloud.ts 的旧 not-connected 标记也不能覆盖 neon-auth.ts 中实际已有的认证能力。

本次交接整理不修改业务代码、不合并上述 PR、不改变生产配置、不上传个人数据。纯文档验证只检查事实、路径和差异，不伪称重新运行全部测试。
