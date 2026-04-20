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

## 任务 4：Journey 数据模型 ✅
- 完成日期：2026-04-20
- Admin 页面：Journey 模板列表 / 阶段列表 / 阶段编辑器 / 客户列表 / 客户进度管理
- 客户页面：/customer/journey 纵向时间线（可展开卡片）
- 阶段数量不固定，支持任意数量的阶段增删
- 备注：模板 seed SQL 待执行；阶段内容由苏晓宇在 admin UI 中录入

## 任务 04c：内部团队角色系统 ✅
- 完成日期：2026-04-20
- Migration：20260421000014_v1_staff_roles.sql
  - profiles 新增 role_staff BOOLEAN + staff_role TEXT CHECK IN (copywriter/project_manager/customer_manager/bdm)
  - 7 张核心表的 staff 读取策略 + 关键表的写策略（PM 可改 HR/进度，Tim/PM 可改 QA/进度，BDM 可改月度数据）
- 工具库：
  - src/lib/roles.js 扩展 ROLES.STAFF + getDefaultRoute/getRequiredRoleFromPath 支持 /staff
  - src/lib/staffPermissions.js 4 角色 8 动作权限矩阵 + hasPermission()
  - src/lib/complianceAlerts.js 合规预警计算（超时阶段/客户 warnings/营业额/银行余额 4 种规则）
- Staff 页面（src/pages/staff/）：
  - StaffLayout：通用导航（Dashboard + 所有客户）+ 各 staff_role 专属项（Kelly: QA；Lisa: 合规预警/里程碑；Tim: QA/会议；Ryan: 线索/财务）
  - StaffDashboard：按 staff_role 分发 4 个子 Dashboard，每个内容不同
    - Kelly: 待回答 QA 列表 + 内容任务占位
    - Lisa: 合规预警列表（超时阶段标红 + 红色客户警告 + 营业额低于目标）+ 阶段超时概览
    - Tim: 24h 未回复 QA（红） + 今日会议 + 长时间无互动客户
    - Ryan: 营业额总览 + 财务里程碑预警（3/6 月 £30K/£100K 目标）
  - StaffCustomers：所有客户表格（读取 customer_profiles）
  - StaffCustomerDetail：5 tab（概览/Journey/QA/HR/报告），每 tab 按权限矩阵切换只读 vs 可编辑
- Admin 团队管理：
  - /admin/team（TeamManagement.jsx）列出所有 role_staff=true 的账号，支持新建 + 改 staff_role + 禁用
  - netlify/functions/create-staff.mjs：admin 鉴权 + 创建 auth 用户 + 设置 role_staff=true/staff_role/password_changed=false，默认临时密码 Readii2025!
- 路由：
  - /staff/* 通过 ProtectedRoute requireRole="staff"
  - /admin/team
  - App.jsx 登录后 homePath 优先匹配 role_staff → /staff，再是 role_customer → /customer/dashboard
- 权限验证（前端 + RLS 双重）：
  - Kelly 看不到"更新进度"按钮（JourneyTab 不显示 select，只 badge）
  - Tim 可更新进度（JourneyTab 显示状态 select）
  - Ryan 没有 answerQA 权限 → QA Tab 显示"你的角色没有回答权限"
  - Lisa 有 signOffHR 权限（StaffCustomerDetail 未建 Sign-Off UI，通过 /admin/customers/:id/hr-compliance 的 admin 入口执行；RLS 已放行）
- 备注：
  - 背景描述中所说"role_staff 和 staff_role 已在任务 01 部署"不准确——这两个字段实际在本任务的 000014 migration 才加；请先执行 migration
  - Staff 侧边栏的独立页面（QA 队列/合规预警/里程碑日历/会议管理/新线索/财务节点）为占位，数据已在 Dashboard 卡片展示；独立视图留给 v2
  - StaffCustomerDetail 只建了 5 tab（概览/Journey/QA/HR/报告）；任务文档提到的 8 tab 中的文档中心/Appendix A/会议/财务链到现有 admin 页面或未做（Appendix A/财务数据录入 UI 本身 04b 就没建）
  - 创建 staff 后临时密码 Readii2025!，用户登录后强制改密（password_changed=false）

## 任务 04b：报告生成引擎（7 种报告） ✅
- 完成日期：2026-04-20
- Migration：20260421000013_v1_report_support_tables.sql
  - customer_appendix_a（A-J 分类文档清单，per-customer）
  - key_personnel_reviews（AO / Key Contact / Level 1 User 审核）
  - ao_interview_scores（3 次模拟，5 维度）
  - applicant_interview_scores（2 次模拟，5 维度）
  - customer_profiles.monthly_operations_data JSONB 列
- 共享工具（netlify/functions/utils/）：
  - pdfReport.mjs（pdfkit 助手：header/sectionTitle/kvLine/bullet/signature/footer）
  - reportStore.mjs（admin 鉴权/客户解析/PDF 存入 reports bucket/generated_reports 插入 + is_latest 翻转）
- 6 个新 PDF netlify 函数（沿用 task 04a 的 pdfkit + Helvetica 方案，英文骨架无 CJK）：
  - generate-journey-report.mjs（报告 1：整体进度 + 当前/已完成/待办 + 时间窗 + 风险）
  - generate-appendix-report.mjs（报告 3：Appendix A 就绪，仅 admin）
  - generate-kp-report.mjs（报告 4：Key Personnel 审核，仅 admin）
  - generate-ao-report.mjs（报告 5：AO 3 次模拟 5 维度评分）
  - generate-applicant-report.mjs（报告 6：申请人 2 次模拟 5 维度评分）
  - generate-monthly-report.mjs（报告 7：月度运营，支持定时+手动，`export const config = { schedule: '0 18 28-31 * *' }`，自动跳过非月末）
- API：src/lib/api/reports.js（REPORT_TYPES 清单 + listReportsForCustomer + generateReport 路由分发 + 签名 URL + AO/申请人评分 + 月度数据读写）
- 客户页面：/customer/reports（ReportsCenter.jsx，仅显示 customerVisible=true 的 3 种：journey/HR/monthly，支持生成/下载/历史版本）
- Admin 页面：
  - /admin/customers/:id/reports（CustomerReports.jsx，7 种全部可见）
  - /admin/customers/:id/ao-interview-score（AOInterviewScore.jsx，3 次 × 5 维度表单 + 保存并生成）
  - /admin/customers/:id/applicant-interview-score（ApplicantInterviewScore.jsx，2 次 × 5 维度表单）
  - /admin/customers/:id/monthly-ops（MonthlyOperations.jsx，月份列表 + 编辑对话 + 生成本月报告）
- 入口：
  - 客户 Layout 侧边栏新增「我的报告」
  - Admin CustomersList 新增「报告」按钮
- 备注：
  - PDF 沿用 task 04a 的方案（pdfkit + Helvetica + 英文骨架），未引入新字体库
  - 报告 2（HR 合规）沿用 task 04a 的 generate-hr-report.mjs（未重构到共享工具；功能正常；后续如需统一可改）
  - 报告 3 和 4 需要数据录入：customer_appendix_a 和 key_personnel_reviews 暂未建 Admin 录入 UI（v1 可用 SQL 直接插入；UI 可在后续迭代补上）
  - Netlify 定时任务通过函数内 `export const config = { schedule: '0 18 28-31 * *' }` 声明；部署后 Netlify 会自动调度
  - 月度报告定时触发时无 auth header，遍历 needs_mentoring=true + status=active 的客户逐个生成
  - Storage 路径：reports bucket 下 `{customerId}/{type}_{ts}.pdf`
  - migration 需执行到 Supabase

## 任务 04a：HR 合规子模块（26 项） ✅
- 完成日期：2026-04-20
- Migrations：
  - 20260421000011_v1_hr_compliance.sql（hr_compliance_items / customer_hr_compliance / generated_reports 表 + hr-compliance-docs / reports Storage buckets + RLS 策略）
  - 20260421000012_v1_hr_items_seed.sql（26 项入库，Phase 1:8 / Phase 2:4 / Phase 3:6 / Phase 4:8；3.1 和 4.1 标记为 is_signoff）
- API：src/lib/api/hrCompliance.js（list/progress/upload/signedUrl/generate/latestReport + groupByPhase/isPhaseUnlocked 辅助函数）
- 客户页面：/customer/hr-compliance（进度条 + 生成/下载报告按钮 + 4 Phase 分组 + Phase 锁定 + 项展开 + 文件上传 + 标记完成；sign-off 项显示"等待 Readii 确认"）
- Admin 页面：/admin/customers/:id/hr-compliance（表格展示全部 26 项 + 查看证据 + 状态下拉改 + Phase 1/2 Sign-Off 按钮）
- 入口：
  - 客户：Journey 阶段 10 卡片内「进入 HR 合规子模块」链接（任务 04 已加）
  - Admin：CustomersList 新增「HR 合规」按钮
- PDF 生成：netlify/functions/generate-hr-report.mjs（pdfkit，校验所有项已完成→生成 A4 多页 PDF→上传到 reports bucket→写入 generated_reports，is_latest 自动翻转）
- 备注：
  - 任务文档声称 22 项，但内容源 batch2.md 实际有 26 项；以源为准
  - PDF 使用 pdfkit 内置 Helvetica 字体，不支持中文——报告以英文为主（phase 标题、基本信息、签字行），显示 item_number + 状态 + 完成日期 + 证据文件名 + 合规依据（英文），中文描述不进入 PDF。后续可替换为含 CJK 字体的方案
  - Storage buckets 权限：admin 全权 + 客户仅能读写自己 customer_id 目录下文件
  - migrations 需执行到 Supabase；添加了 pdfkit 到 package.json 和 netlify.toml 的 external_node_modules

## 任务 04：Journey 变体系统 + 阶段内容入库 ✅
- 完成日期：2026-04-20
- Migrations：
  - 20260421000009_v1_stage_variants.sql（journey_stages 扩展 stage_code/applies_to/has_sku/sku_*/has_sub_module；新建 stage_variants 表；customer_journey_progress 加 selected_variant_id/service_mode*）
  - 20260421000010_v1_sw_journey_seed.sql（seed sw_self_sponsored 模板的 24 阶段 + 13 变体，含 stage_code、applies_to、三段式内容、交付物、SKU 定价）
- Admin 编辑器：JourneyStageEditor 改为 4 Tab（基本信息/三段式/SKU/变体管理），变体支持增删改；JourneyStagesList 新增 code/适用/SKU/内容完整度列
- 客户页面：/customer/journey 增强——按 selected_variant_id 展示变体内容（title / why / you / readii / deliverables 全部替换），has_sku 阶段显示自助/委托按钮（保存 service_mode 到 customer_journey_progress），阶段 10 显示 HR 合规子模块入口
- 规则引擎对接：generate-customer-journey.mjs 现按 stage_code 匹配阶段，并把 variant code 映射为 stage_variants.id 写入 selected_variant_id
- 变体清单：阶段 2（2A-2E）、阶段 4（4A/4B）、阶段 6（6A/6B）、阶段 9（9A/9B）、阶段 23（23A/23B）共 13 个
- 备注：migrations 需执行到 Supabase；HR 合规子模块入口已做跳转，子模块实体内容由任务 04a 实现；内容文案基于 readii_sw_journey_content_v1.md 第二部分精炼而成（保留关键规则与警示），苏晓宇可在 admin 编辑器中逐条细化

## 任务 03：客户画像问卷引擎 ✅
- 完成日期：2026-04-20
- Migration：20260421000008_v1_customer_questionnaire.sql（customer_profiles 扩展 15 列问卷/计算字段 + customer_journey_progress 加 selected_variant）
- 规则引擎：src/lib/journeyRuleEngine.js（runRuleEngine/computeStages/selectVariant/computeWarnings/computeTimeline，含 stage_code↔stage_number 映射）
- 问卷向导：/admin/customers/:id/questionnaire（10 步 wizard + 预览，Q6 条件显示，每步自动存草稿）
- 生成 API：netlify/functions/generate-customer-journey.mjs（admin 鉴权，清空旧进度 → 按规则引擎写 customer_journey_progress + selected_variant → 更新 customer_profiles 计算字段）
- 入口：CustomersList 新增「问卷」列 + 「填写问卷/查看问卷」按钮
- 备注：SOC 列表硬编码 23 项常见 code（含 requires_crc 标记）；参考文档 docs/journey_content/readii_sw_journey_content_v1.md 未入仓，题目文案基于 schema 枚举值推导，苏晓宇可后续细化；migration 需执行到 Supabase；journey_stages 需有对应 stage_number（1-24）的记录，否则生成时该阶段会被 skip（响应里有 skippedCodes 提示）
