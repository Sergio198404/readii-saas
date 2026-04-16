# Changelog

本文件记录 Readii Sales CRM 的所有功能变更。版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [0.13.0] - 2026-04-16

### 新增：客户端可行性评估问卷
- `/assessment` 公开页面（无需登录），支持 `?ref={code}` 渠道归因
- 16题5 Section 滚动式问卷：基本信息 / 身份状态 / 职业背景 / 目标预期 / 补充说明
- 顶部进度条实时显示完成百分比
- 视觉风格与建议书模板一致（Cormorant Garamond 标题 + DM Sans 正文 + 墨金配色）
- 移动端适配（< 600px 响应式布局）
- `submit-assessment.mjs` Netlify Function：
  - 自动判断签证路线（PSW+已注册→SW, 明确商业计划→IFV, 工签→EW）
  - 自动判断优先级（6个月内到期→P1, 6-12个月→P2）
  - 自动判断预算档位
  - `?ref=` 参数自动匹配 partners 表写入 `partner_id`
  - 完整问卷 JSON 存入 `assessment_data` 字段
- `LeadCard` 增加「查看问卷原始答案」折叠区（仅有 assessment_data 时显示），顾问通话前快速浏览
- `LeadCard` 增加联系方式行（仅有 contact_info 时显示）

### SQL 迁移
- `add_assessment_columns.sql`：leads 表新增 `contact_info text` + `assessment_data jsonb`

## [0.11.0] - 2026-04-16

### 新增：建议书分步向导
- `/admin/proposals/new` 和 `/admin/proposals/:id/edit` 7步向导（基本信息 → 现状评估 → 目标 → 衡量标准 → 价值主张 → 时间安排 → 预览&生成）
- 每步保存草稿，支持中途退出后继续编辑
- Step 1：客户信息 + 签证路线 + 封面标签（AI生成）
- Step 2：典型劣势/客户优势 checkbox 预设库 + 背景/原话/排除/引言（AI撰写按钮）
- Step 3：AI生成4-6个目标卡片，顾问勾选 + 自定义添加
- Step 4：AI根据已选目标自动生成衡量标准，可编辑/增删
- Step 5：8项价值库勾选（最多6个），每项可编辑损失描述
- Step 6：时间线节点配置（增删改 + 类型切换） + 风险提示（AI撰写）
- Step 7：摘要预览 + 生成链接 + QR 码
- `proposal-ai-assist.mjs` 新函数：统一处理 goals/metrics/tags/exclusion/advisor_note/risk_note/timeline_desc 的 AI 生成
- ProposalsPage 列表新增"编辑"按钮跳转到向导

### 模板更新
- 封面标签改为动态 `[[COVER_TAGS]]`
- 优劣对比改为动态 `[[TYPICAL_DISADVANTAGES]]` / `[[CLIENT_ADVANTAGES]]`
- 目标/衡量标准/价值主张改为动态 `[[GOALS_SECTION]]` / `[[METRICS_SECTION]]` / `[[VALUES_SECTION]]`
- Section 10 移除双方签名框，改为动态 `[[GOAL_CHECKS]]` + 微信确认提示
- 自助申请 tier-items 更新为社群+答疑+AI 内容
- 删除 "您现在只需要做一件事" action-row

### SQL 迁移
- `proposal_wizard_columns.sql`：proposals 表新增 typical_disadvantages / client_advantages / selected_goals / metrics / selected_values / timeline / risk_note / cover_tags

## [0.9.0] - 2026-04-16

### 新增：Stripe 自助订阅支付
- **`stripe-create-checkout.mjs`**：接收 `{ proposal_token, client_email, client_name }` → 创建 Stripe Checkout Session（subscription 模式，£49/月）→ 返回支付 URL
- **`stripe-webhook.mjs`**：监听 `checkout.session.completed`（写入 stripe_session_id + subscription_id + 状态更新）和 `customer.subscription.deleted`（标记 expired）
- **建议书模板**：
  - "立即订阅，在线签约"按钮绑 `startCheckout()` → POST stripe-create-checkout → 跳转 Stripe 支付页
  - 支付成功/取消后返回建议书页面带 `?payment=success|cancelled` 参数 → 顶部显示绿色/灰色提示条
- **ProposalsPage**：列表新增"订阅"列（`● 已订阅` 绿色 / `● 已取消` 灰色）
- **NewProposalModal**：新增客户邮箱字段（用于 Stripe customer_email）
- **SQL 迁移**：`add_stripe_columns_to_proposals.sql` — proposals 表新增 `client_email` / `stripe_session_id` / `stripe_subscription_id`

## [0.8.0] - 2026-04-16

### 新增：建议书（Proposal）系统
- **数据库**：`proposals` 表（编号、token、客户信息、签证路线、顾问、现状评估、客户原话、排除路线、顾问引言、方案选择、状态追踪、查看次数）+ `proposal_logs` 审计日志 + `proposal_seq` 编号序列 + `generate_proposal_no()` RPC
- **Netlify Functions**：
  - `proposal-view.mjs`：公开访问，token 验证→读模板→变量替换→返回 HTML；更新 view_count 和 status；写入访问日志
  - `proposal-verify-phone.mjs`：占位函数（MVP 直接返回 verified:true，注释标注后续接 Twilio）
  - `proposal-request-contract.mjs`：客户点击"申请正式协议"→更新 selected_tier、status=signed、signed_at；写入日志
- **前端**：
  - `/admin/proposals` 建议书列表页（编号、客户、状态标签、日期、查看次数、复制链接/查看按钮）
  - `NewProposalModal`：从客户卡片或列表页新建；表单含客户搜索、签证路线、称呼、现状评估、客户原话、排除路线、顾问引言、推荐方案；RPC 生成编号；成功后展示访问链接+复制
  - `LeadCard` 新增"📄 建议书"操作按钮
  - `Sidebar` admin 区域新增"建议书"入口
- **模板**：`readii_proposal_v4.html` 转为 `netlify/functions/proposal-template.html`，demo 值替换为 `[[MARKER]]` 占位符；"申请正式协议"按钮绑定 JS 调用 `proposal-request-contract` → 成功后按钮变为"✓ 已收到您的申请"并禁用

## [0.7.0] - 2026-04-14

### 新增
- 选题库新增两款产品：**EW（拓展工签）** 和 **GT（全球人才签）**
  - `add_ew_product.sql` 幂等迁移（GT 初始 seed 已有，EW 新增）
  - `Sidebar` 产品筛选、`AddLeadModal` 产品下拉、`useLeads` 的 badge 计数全部补齐
- 朋友圈新增"用户输入对话框"：
  - 顶部 textarea 让用户自由描述素材
  - 选专家风格下拉
  - "生成三条朋友圈"按钮 → 调 `moments` 函数新增的 `userPrompt` 参数，Claude 围绕用户内容分三个角度展开

### 体验
- `CoachDrawer` 改为显式 `position: fixed`（原先 absolute inside fixed overlay），消除了抽屉位置的潜在抖动
- `scrollIntoView` 加 `block: 'nearest'`，修复长对话时整个页面被带着滚动的 bug
- 客户卡片的"🧠 AI 建议"按钮现在**自动发送第一条消息**：`请针对客户${name}给出今日跟进计划，包括开场白和下一步行动建议`（通过 CoachDrawer 已有的 `initialPrompt` 机制）

### 数据修正
- `swap_content_topics_status.sql`：三步重命名把 `content_topics.status` 的 `待创作` 与 `已发布` 值对调（之前语义反了）
- 选题卡片 `待创作` badge 改为中性灰色（新 `.badge-topic-pending` 样式），`已发布` 保持绿色

## [0.6.1] - 2026-04-14

### 新增：deal_roles 状态流
- `PartnersAdminPage` 右侧详情加 Tabs（基本信息 / 佣金记录）
  - 佣金记录表展示该伙伴作为 lead_recorder 的所有分成记录
  - `pending` → 显示"✓ 确认"按钮，点击 → `confirmed` + `confirmed_at = now()`
  - `confirmed` → 显示"💰 标记已付"按钮，点击 → `paid` + `paid_at = now()`
  - `paid` → 绿色"已结算"文本，无操作
- `PartnersAdminPage` 伙伴列表每个卡片新增一行"待 / 确 / 付"三个金额聚合（基于 deal_roles.status 分组求和）
- `PartnerPage`：
  - "待结算佣金"定义变更：只计算 `confirmed` 金额（pending 尚未被确认，paid 已结清）
  - 佣金表状态颜色：灰（pending）/ 橙（confirmed）/ 绿（paid）
  - `paid` 行下方显示 `paid_at` 日期

## [0.6.0] - 2026-04-14

### 新增：渠道伙伴工作台 `/partner`
- 顶部 4 项统计：我的线索 / 本月新增 / 已成交 / 待结算佣金
- 左列"我的线索"：只显示 `partner_id = self.partner.id` 的 leads，支持更新进展、录入新线索
- 右列"佣金记录"：读 `deal_roles` 自己作为 `lead_recorder` 的行，附带客户名、产品、合同金额、应得佣金、状态
- 底部"我的推广"：推广码 + 推广链接 + 一键复制
- 新建 `PartnerSidebar`：partner 登录后只显示「我的线索 / 佣金记录 / 推广信息」三个锚点，不再出现 admin 功能
- `App.jsx` 已有的 RequireAuth 自动按 role 分流，admin 进不了 partner 页，partner 进不了 admin 页

### 安全
- 新建 `supabase/deal_roles_rls.sql`：给 `deal_roles` 表补策略（原本 enable 了 RLS 但无任何 policy，导致 partner 根本读不到自己的分成记录，间接让 `deals_partner` 的 exists 子查询也永远为 false）
  - `deal_roles_admin`：admin 全权
  - `deal_roles_self`：partner 仅可 select 自己的 row（`user_id = auth.uid()`）

## [0.5.1] - 2026-04-14

### 变更
- `AddLeadModal` 来源类型默认改为「内容引流」(`content`)；选项顺序：内容引流 / 朋友介绍 / 专属链接 / 直接录入
- 智能粘贴解析**不再覆盖归属区块**（partner_id / source_type 保持用户当前选择）
- 移除自动识别 `?ref=` 参数匹配 partner 的逻辑（担心误覆盖用户手动选择）

### 安全
- `leads_partner` RLS 策略补充显式 `with check`：partner 用户 INSERT/UPDATE lead 时 `partner_id` 必须在自己名下的 partners 行里，防止绕过前端硬锁写入他人 partner_id
- SQL: `supabase/leads_partner_rls_with_check.sql`

## [0.5.0] - 2026-04-14

### 新增：线索归属
- `leads` 表新增 `source_type` 字段（ref_link / direct / content / referral，默认 direct）
- `AddLeadModal` 新增"归属"区块：
  - **渠道伙伴**：admin 下拉选择 partners.status='active'；partner 用户锁定为自己的 partner row，只读
  - **录入人**：只读，显示当前登录用户姓名，保存时自动填入 `recorder_id = user.id`
  - **来源类型**：4 个单选项（专属链接 / 直接录入 / 内容引流 / 朋友介绍）
- 智能粘贴新增 URL 识别：文本含 `?ref=READII-XXX-2025` 时自动查 partners 表匹配 `referral_code`，自动选中伙伴并把 source_type 设为 `ref_link`
- 无论智能粘贴还是手工填写，partner 角色的 `partner_id` 永远强制 = 自己的 partner.id（不可绕过）

### SQL 迁移
- `supabase/add_lead_source_type.sql`

## [0.4.1] - 2026-04-14

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
