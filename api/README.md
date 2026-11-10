# rixu-api (Cloudflare Worker)

独立后端，与根目录 Cloudflare Pages Vue 工程分离。

- Node >=22
- `npm install`
- `npm test`
- `npm run dev` / `npm run deploy` （部署前务必按照 `../docs/日序云端后端接入说明.md` 配置 Secrets）

要求的 Secret：`DATABASE_URL`、`NEON_AUTH_BASE_URL`、`NEON_AUTH_JWKS_URL`、`ALLOWED_USER_IDS`、`ALLOWED_ORIGINS`。

## 现有数据库

`rixu.records` 保存用户记录（乐观锁），`rixu.sync_receipts` 保存客户端变更幂等记录。项目现有数据库已建立这两张表；本包**不会执行任何迁移或删除**。

## 安全原则

拒绝未经 Neon Auth JWT 验证的请求；拒绝用户 ID 不在白名单的请求；只在服务端使用数据库 Secret；所有数据库读写查询强制按用户隔离。首次登录不自动上传本地数据。

**本阶段仍是后端初版，未经过真实线上写入测试。**
