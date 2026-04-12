# Changelog

本文件记录 Readii Sales CRM 的所有功能变更。版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-04-12

### 新增
- Supabase Auth 邮箱+密码登录/注册流程
- `LoginPage` 登录注册切换页面
- `useAuth` hook：监听 session、自动 ensure profile、按邮箱判定 admin
- `AppLayout` 全局布局，固定右上角 `UserMenu`（头像 + 退出登录）
- `PartnerPage` 占位页（`/partner`）
- 路由守卫：未登录跳 `/login`；admin → `/today`，partner → `/partner`
- 长远架构 5 张新表：`profiles` / `partners` / `products` / `deals` / `deal_roles`
- `leads` 表新增归属字段：`partner_id` / `product_id` / `recorder_id` / `first_consult_id` / `converter_id`
- 完整 RLS 策略（admin 全权 / partner 按归属）
- 预置 6 个产品：IFV / SW / GT / Student / PlanB / Property

### 变更
- `supabase.js` 移除硬编码 fallback URL，强制读取 `.env`
- `TopBar` 不再承载 UserMenu，改由全局 Layout 提供

### 文档
- 新增 `CHANGELOG.md` / `WORKLOG.md`
