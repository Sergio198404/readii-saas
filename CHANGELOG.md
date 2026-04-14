# Changelog

本文件记录 Readii Sales CRM 的所有功能变更。版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 修复
- 渠道佣金改为从 distributable 池里先切，而非额外计提：
  - `platform = contract × 0.30`
  - `distributable = contract × 0.70`
  - `channelAmount = distributable × partner.commission_rate × partner.multiplier`
  - `remainingPool = distributable − channelAmount`
  - 转化/方案/执行按 commission_model 的 532 比例分 `remainingPool`
- `deal_roles.lead_recorder.share_rate` 改为 `channelAmount / contractAmount`（相对合同额的实际比例）
- `MarkDealModal` 预览新增 5 行：合同 → 平台 → 渠道 → 剩余池 → 你实得

## [0.4.0] - 2026-04-14

### 安全
- `create-partner` 函数新增 admin JWT 校验：调用方必须携带 `Authorization: Bearer <token>`，且 `profiles.role = 'admin'`，否则 401/403
- 首次登录强制改密：
  - `profiles` 新增 `password_changed boolean not null default true`
  - `create-partner` 创建新伙伴时显式写入 `password_changed = false`
  - 新增 `/change-password` 页面，密码 < 8 位或两次不一致阻塞提交
  - `RequireAuth` 守卫：任意受保护路由若检测到 `password_changed = false` 则重定向到 `/change-password`

### 新增：成交录入
- `lib/commission.js`：`buildDealRoles` / `summarizeDeal` 纯函数
  - `converter` 独占；`planner` 平分给 3 个 plan_* 角色；`executor` 平分给 3 个 exec_* 角色
  - `fixed_commission` 模型（PlanB）直接按固定金额计入 converter
  - 若 lead 有 `partner_id`，按 `partners.commission_rate × contract_amount` 给 `lead_recorder`（额外成本，不占 distributable）
- `MarkDealModal`：产品下拉（从 `products` 拉取） / 合同金额 / 首付 / 签约日期；提交后一并写入 deals + deal_roles，并将 lead 更新为 S4 + `product_id`
- `LeadCard`：S3 阶段显示 "🎉 标记成交"；S4 阶段显示成交摘要（平台/渠道/你实得）
- `SalesBoard`：拉取 deals + 嵌套 deal_roles，按 lead_id 汇总给卡片

### SQL 迁移
- `supabase/add_password_changed_column.sql`

## [0.3.0] - 2026-04-14

### 新增
- `/admin/partners` 伙伴管理页（仅 admin 可见）
  - 左侧伙伴列表（姓名、推广码、等级、状态、线索数）
  - 右侧详情编辑（level / commission_rate 实时保存）
  - 推广码+推广链接展示 + 一键复制
- `NewPartnerModal` 新增伙伴弹窗（姓名 / 邮箱 / 英文名）
- Netlify Function `create-partner`：用 service_role key 创建 Auth user → profile → partners 行
  - 推广码格式：`READII-${英文名大写}-2025`
  - 推广链接：`https://readii.co.uk/?ref=${推广码}`
  - 默认临时密码：`Readii2025!`
- Sidebar 增加 "管理 → 伙伴管理" 入口（仅 admin 可见）

### 修复
- CLAUDE.md Supabase project ID 纠正为 `pgjqfcirfpoitybgmuka`

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
