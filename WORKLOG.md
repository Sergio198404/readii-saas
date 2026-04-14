# Worklog

每日开发日志，按倒序记录。

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
