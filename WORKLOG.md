# Worklog

每日开发日志，按倒序记录。

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
