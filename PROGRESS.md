# Readii v1 开发进度

## 任务 1：数据库 Schema 部署 ✅
- 完成日期：2026-04-20
- 新增表数量：19
- 迁移文件：6
- 备注：profiles 扩展 7 列 + 回填现有角色；现有 partners 表保留，新建 partner_profiles 作为 v1 扩展表

## 任务 2：角色扩展和登录路由 ✅
- 完成日期：2026-04-20
- 新增组件：RoleProvider, ProtectedRoute, RoleSwitcher
- 新增路由：/customer/*, /consultant/*, /dashboard, /unauthorized
- 备注：现有 admin/partner 路由全部保留不动；新增 v1 路由并行存在；roles.js 支持旧 role 字段回退

## 任务 3：客户工作台骨架 ✅
- 完成日期：2026-04-20
- 页面：/customer/dashboard（+ journey/documents/qa/meetings/settings 占位）
- 组件：CustomerLayout, JourneyProgressBar, CurrentStageCard, QuickActionPanel, UpcomingMeetings
- API：src/lib/api/customer.js
- 备注：无 customer_profiles 数据时显示友好提示；使用现有 CSS vars 体系
