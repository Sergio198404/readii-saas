# Worklog

每日开发日志，按倒序记录。

## 2026-04-14 (v0.7.0)

### 完成
- CoachDrawer 稳定性：position 改显式 fixed；scrollIntoView 加 `block:'nearest'` 防页面跟着滚
- AI 建议按钮自动首发：`SalesBoard` 维护 `coachInitialPrompt` 状态，点击卡片 🧠 按钮时塞入 per-lead prompt
- 新增产品 EW / 补齐 GT 的前端展示：Sidebar 筛选、AddLeadModal 选项、useLeads 计数
- 新建 SQL 迁移：
  - `add_ew_product.sql` — `on conflict do nothing` 幂等
  - `swap_content_topics_status.sql` — 三步重命名对调 `待创作` ↔ `已发布`
- 选题卡片 badge：`待创作` 新样式 `.badge-topic-pending`（灰色）；`已发布` 保留绿色
- 朋友圈自定义输入：textarea + 专家下拉 + 生成按钮；`moments.mjs` 新增 `userPrompt` 参数

### 待跟进
- Supabase SQL Editor 依次执行：
  1. `supabase/add_ew_product.sql`
  2. `supabase/swap_content_topics_status.sql`

## 2026-04-14 (v0.6.1)

### 完成
- deal_roles 状态流闭环
  - admin 在 PartnersAdminPage 伙伴详情 → 佣金记录 tab，逐条 确认 / 标记已付
  - PartnersAdminPage 伙伴列表卡片新增 待/确/付 三项金额聚合
  - PartnerPage 佣金表颜色分三档，paid 行显示 paid_at
  - "待结算佣金"语义改为 confirmed 总额（原来是 pending）

### 没动
- deal_roles_admin 策略已在 v0.6.0 的 `deal_roles_rls.sql` 里加好；状态变更走 update 走 admin 全权策略
- RLS 对 partner 只给 select 自己的行，UPDATE 仍然走 admin 路径，安全
- partner 看不到自己无关的记录 → OK

## 2026-04-14 (v0.6.0)

### 完成
- 渠道伙伴工作台 `/partner` 重构（原先只是占位页）
  - 拉自己的 partner 行 → leads → deal_roles（join deals / products / leads）
  - 顶部 4 项统计、主区域左右 grid、底部推广卡片
- 新建 `PartnerSidebar`，partner 登录后的侧栏只有三个锚点（我的线索 / 佣金记录 / 推广信息）
- 新建 SQL 迁移 `supabase/deal_roles_rls.sql` 补 RLS 策略

### 发现的历史问题
- `deal_roles` 表之前 RLS enable 但零 policy —— 非 service_role 任何人都读不到任何行。导致 `deals_partner` 策略里的 `exists (select 1 from deal_roles ...)` 也永远 false，partner 角色连自己参与的 deal 都看不见。v0.6.0 补齐

### 待跟进
- Supabase SQL Editor 执行 `supabase/deal_roles_rls.sql`

## 2026-04-14 (v0.5.1)

### 完成
- `AddLeadModal` 归属区块微调：
  - `source_type` 默认值 → `content`（内容引流）
  - 选项顺序：内容引流 / 朋友介绍 / 专属链接 / 直接录入
  - 智能粘贴不再覆盖归属（之前的 URL `?ref=` 自动匹配逻辑已移除）
- 新建 `supabase/leads_partner_rls_with_check.sql`：`leads_partner` 策略补显式 `with check`，后端兜底 partner_id 必须等于 `auth.uid()` 对应的 partners.id

### 待跟进
- 在 Supabase SQL Editor 执行 `leads_partner_rls_with_check.sql`

## 2026-04-14 (v0.5.0)

### 完成
- v0.4.1 打标（本地 tag，未 push：仓库无 origin 远端）
- v0.5.0 第四步：leads 录入表单加归属字段
  - 新建 `supabase/add_lead_source_type.sql`（待用户执行）
  - `AddLeadModal` 新增归属区块：渠道伙伴下拉（admin）/ 锁定（partner）、录入人只读、来源类型 4 单选
  - 智能粘贴识别 `?ref=READII-XXX-2025` 自动匹配 partners 并设 source_type=ref_link
  - partner 角色 `partner_id` 硬锁自己，服务端靠 RLS 再兜底一次

### 待跟进
- 在 Supabase SQL Editor 执行 `add_lead_source_type.sql`
- 若后续要把未知 URL 参数也传给后台统计，需要再加 `utm_source` / `referrer_url` 字段

## 2026-04-14 (下半场 v0.4.0)

### 完成
- 安全补丁 1：`create-partner` 加 admin JWT 校验；`NewPartnerModal` 发送 `Authorization: Bearer <session.access_token>`
- 安全补丁 2：首次登录强制改密
  - 新建 `supabase/add_password_changed_column.sql`（待用户执行）
  - `ChangePasswordPage` 页面 + `/change-password` 路由
  - `RequireAuth` 检测 `password_changed === false` 强制重定向
  - `useAuth` 导出 `refetchProfile` 供改密后刷新
- 第三步：成交录入
  - `lib/commission.js` 纯函数库（buildDealRoles / summarizeDeal）
  - `MarkDealModal` + `LeadCard` 标记成交按钮（仅 S3）+ 成交摘要卡片（仅 S4）
  - `SalesBoard` 拉取 deals + deal_roles 并传给 LeadList

### 待跟进
- ⚠️ 用户需在 Supabase SQL Editor 执行 `add_password_changed_column.sql`
- 多角色拆分（目前 converter/plan_*/exec_* 都是当前登录 admin 一人）需要等有了第二个运营同事再改

### 完成
- 步骤 2：admin 后台伙伴管理
  - 新建 `netlify/functions/create-partner.mjs`（service_role key 创建 Auth user + profile + partner）
  - 新建 `src/pages/PartnersAdminPage.jsx`：左列表 / 右详情布局，支持 level、commission_rate 在线编辑
  - 新建 `src/components/modals/NewPartnerModal.jsx`：表单+成功态展示推广码/链接/临时密码
  - `Sidebar` 接入 `useAuth`，为 admin 增加"管理 → 伙伴管理"入口
  - `App.jsx` 挂载 `/admin/partners` 路由（admin-only）

### 待跟进
- Netlify Dashboard → Environment Variables 添加 `SUPABASE_SERVICE_ROLE_KEY`（值来自 Supabase → Settings → API → service_role）
- 本地开发若要测试 create-partner 函数，需要 `netlify dev` 并把 service_role key 写入本地 `.env`
- 伙伴首次登录后应提示修改临时密码（尚未实现）

## 2026-04-12

### 完成
- 在 Supabase 建立长远架构表：`profiles` / `partners` / `products` / `deals` / `deal_roles`，扩展 `leads` 归属字段，配置 RLS
- 实现登录/注册流程（步骤 1）：
  - `signIn` / `signUp` / `signOut` 三个方法
  - `useAuth` hook + 自动 ensure profile（admin 邮箱白名单）
  - `LoginPage` UI
  - `App.jsx` 路由守卫（按 role 分流）
- 全局布局：抽出 `UserMenu` + `AppLayout`，所有受保护页面右上角都有头像/退出
- `supabase.js` 移除 fallback URL 硬编码
- 引入版本管理：`CHANGELOG.md` / `WORKLOG.md`，`package.json` v0.1.0

### 待跟进
- ⚠️ `.env` 中的 `VITE_SUPABASE_URL` 仍指向旧项目 `pgjqfcirfpoitybgmuka`，但 `CLAUDE.md` 标注的项目 ID 是 `qvuewcavzjdzoajujjma`。需要确认本周建表实际是建在哪个项目里
- 在 Supabase Dashboard 关闭 Email Confirm 以便测试

### 下一步
- 步骤 2：伙伴注册页 + 推广码生成
