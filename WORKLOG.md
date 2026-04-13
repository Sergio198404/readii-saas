# Worklog

每日开发日志，按倒序记录。

## 2026-04-14

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
