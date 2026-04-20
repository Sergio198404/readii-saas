# 任务 04c：内部团队角色系统

## 目标

为 Readii 内部 4 名团队成员（Kelly/Lisa/Tim/Ryan）建立 `role_staff` 角色系统，让他们能够：
- 查看所有客户的完整信息
- 按各自职能执行不同操作
- 在工作台看到针对自己职能的待办事项

## 前置条件

- 任务 01 已完成（`profiles` 表有 `role_staff` 和 `staff_role` 字段）
- 任务 02 已完成（角色路由系统）
- 任务 03/04 至少部分完成（有客户数据可以展示）

## 上下文

参考文件：
- `docs/journey_content/readii_sw_journey_content_batch3.md` → 第五部分（内部团队权限矩阵 + 各角色 Dashboard 待办）
- `docs/v1_product_manual.md` → 第 1.1 节（profiles 表扩展）

## 内部成员配置（Admin 手动开通）

4 位成员的账号由苏晓宇（Admin）在系统中手动创建并分配角色：

| 成员 | staff_role | 主要职能 |
|---|---|---|
| Kelly | `copywriter` | 文案、客户 QA 回复、外部会计沟通（人工）|
| Lisa | `project_manager` | 项目进度、里程碑管理、合规预警 |
| Tim | `customer_manager` | 客户关系、日常沟通、会议安排 |
| Ryan | `bdm` | 新客户预审、财务节点、商务决策 |

所有 4 人都有 `role_staff=true`，差异在于 `staff_role` 字段和 Dashboard 视图。

## 具体任务

### 1. Admin 开通内部团队账号

扩展 `2.4.6`（Admin 开通渠道账号）的同类功能，支持开通内部员工账号。

**路由**：`/admin/team`
**功能**：

- 列出当前所有 `role_staff=true` 的成员
- 表单：姓名、邮箱、staff_role（select）→ 发送邀请邮件
- 被邀请人收到邮件后设置密码，登录后自动获得 Staff Dashboard 视图

```sql
-- 开通后执行
UPDATE profiles
SET role_staff = true, staff_role = 'project_manager', full_name = 'Lisa'
WHERE email = 'lisa@readii.co.uk';
```

### 2. Staff 路由和 Layout

**路由**：`/staff`（所有 `role_staff=true` 的用户登录后跳转此路径）
**文件**：`src/pages/staff/StaffLayout.jsx`

Staff Layout 与 Admin Layout 类似，但导航菜单不同：

```
左侧导航（Staff 通用）：
- 我的待办（按 staff_role 过滤）
- 所有客户（完整客户列表）
- 客户详情 → 进入单个客户全部信息

左侧导航（特定角色才有）：
- Kelly：FAQ 管理 / 素材管理
- Lisa：项目看板 / 合规预警
- Tim：会议管理 / QA 队列
- Ryan：新线索 / 财务节点
```

### 3. 各角色专属 Dashboard

**文件**：`src/pages/staff/StaffDashboard.jsx`

根据 `profile.staff_role` 展示不同的待办卡片：

#### Kelly（文案）的待办

```jsx
function KellyDashboard() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <TodoCard title="待回答客户 QA" count={pendingQAs.length}>
        {pendingQAs.map(qa => (
          <QAItem key={qa.id} qa={qa} onAnswer={handleAnswer} />
        ))}
      </TodoCard>
      <TodoCard title="本周内容任务" count={contentTasks.length}>
        {/* 营销素材、FAQ 词条编写任务 */}
      </TodoCard>
    </div>
  );
}
```

#### Lisa（项目负责人）的待办

```jsx
function LisaDashboard() {
  return (
    <div>
      <AlertBanner alerts={overdueStages} type="warning"
                   title={`${overdueStages.length} 个阶段已超出预计时间`} />

      <ProjectKanban customers={allCustomers} />

      <MilestoneCalendar
        events={[
          ...threeMonthChecks,
          ...sixMonthChecks,
          ...ninemonthChecks
        ]}
      />
    </div>
  );
}
```

#### Tim（客户经理）的待办

```jsx
function TimDashboard() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <TodoCard title="24小时内未回复的 QA" count={urgentQAs.length}>
        {urgentQAs.map(qa => (
          <UrgentQAItem key={qa.id} qa={qa}
                         hoursElapsed={hoursSince(qa.created_at)} />
        ))}
      </TodoCard>
      <TodoCard title="今日会议" count={todayMeetings.length}>
        {todayMeetings.map(m => <MeetingItem key={m.id} meeting={m} />)}
      </TodoCard>
      <TodoCard title="客户情绪关注" count={attentionCustomers.length}>
        {/* 长时间无互动的客户 */}
      </TodoCard>
    </div>
  );
}
```

#### Ryan（BDM）的待办

```jsx
function RyanDashboard() {
  return (
    <div>
      <RevenueSnapshot customers={allCustomers} />
      <MilestoneAlerts type="financial" customers={allCustomers} />
      <NewLeadsPipeline leads={hotLeads} />
    </div>
  );
}
```

### 4. 客户详情页（Staff 视角）

**路由**：`/staff/customers/:customerId`
**文件**：`src/pages/staff/StaffCustomerDetail.jsx`

Staff 能看到客户的一切，但操作权限按角色划分：

```jsx
// 权限守卫函数
function canUpdateProgress(staffRole) {
  return ['project_manager', 'customer_manager'].includes(staffRole);
}

function canAnswerQA(staffRole) {
  return ['copywriter', 'project_manager', 'customer_manager'].includes(staffRole);
}

function canUploadDocs(staffRole) {
  return true; // 所有 staff 都可以
}
```

页面 Tab 结构：
- Tab 1：Journey 进度（所有 Staff 可看，PM/Tim 可更新状态）
- Tab 2：客户 QA（所有 Staff 可看，Kelly/Tim 可回答）
- Tab 3：文档中心（所有 Staff 可看可上传）
- Tab 4：HR 合规（所有 Staff 可看，PM 可 Sign-Off）
- Tab 5：Appendix A（所有 Staff 可看，PM 可核验）
- Tab 6：报告（所有 Staff 可看可生成）
- Tab 7：会议（所有 Staff 可看，Tim 可创建）
- Tab 8：财务数据（所有 Staff 可看，Ryan 可录入月度数据）

### 5. 权限差异的具体实现

**方案**：不做复杂的 RLS，而是在前端组件里判断：

```javascript
// src/lib/staffPermissions.js
export const STAFF_PERMISSIONS = {
  copywriter: {
    updateProgress: false,
    answerQA: true,
    uploadDocs: true,
    signOffHR: false,
    verifyAppendix: false,
    generateReports: true,
    createMeeting: false,
    enterFinancials: false,
  },
  project_manager: {
    updateProgress: true,
    answerQA: true,
    uploadDocs: true,
    signOffHR: true,
    verifyAppendix: true,
    generateReports: true,
    createMeeting: true,
    enterFinancials: false,
  },
  customer_manager: {
    updateProgress: true,
    answerQA: true,
    uploadDocs: true,
    signOffHR: false,
    verifyAppendix: false,
    generateReports: true,
    createMeeting: true,
    enterFinancials: false,
  },
  bdm: {
    updateProgress: false,
    answerQA: false,
    uploadDocs: false,
    signOffHR: false,
    verifyAppendix: false,
    generateReports: false,
    createMeeting: false,
    enterFinancials: true,
  },
};

export function hasPermission(staffRole, action) {
  return STAFF_PERMISSIONS[staffRole]?.[action] ?? false;
}
```

**数据库层面（RLS）**：Staff 都有 `role_staff=true`，RLS 统一允许 staff 读取所有客户数据。写入操作在 API 层做角色判断（不用 DB-level 精细控制，v1 阶段够用）。

```sql
-- Staff 读取所有客户数据的 RLS Policy
CREATE POLICY "staff_read_all_customers" ON customer_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_staff = true)
  );

-- 同理为其他表添加 staff 读取政策
-- journey_stages, customer_journey_progress, customer_qa, etc.
```

### 6. 合规预警系统（Lisa 专用）

**文件**：`src/lib/complianceAlerts.js`

定义预警规则：

```javascript
export function computeAlerts(customers, allProgress) {
  const alerts = [];

  for (const customer of customers) {
    const progress = allProgress.filter(p => p.customer_id === customer.id);

    // 阶段超时预警
    const overdueStages = progress.filter(p => {
      if (p.status !== 'in_progress') return false;
      const expectedDays = p.journey_stages?.estimated_duration_days || 14;
      const elapsed = daysSince(p.started_at);
      return elapsed > expectedDays * 1.2; // 超出预计时间 20%
    });
    if (overdueStages.length > 0) {
      alerts.push({
        type: 'stage_overdue',
        severity: 'warning',
        customer_id: customer.id,
        customer_name: customer.full_name,
        message: `${overdueStages.length} 个阶段已超出预计时间`,
      });
    }

    // 证书到期预警
    const warnings = customer.warnings || [];
    // TB 体检窗口、英语成绩到期等已在问卷引擎中计算，从 customer_profiles.warnings 读取
    for (const w of warnings) {
      if (w.severity === 'red') {
        alerts.push({ type: 'customer_warning', severity: 'red', ...w, customer_id: customer.id });
      }
    }

    // 营业额里程碑预警（基于 monthly_operations_data）
    const ops = customer.monthly_operations_data || [];
    if (ops.length >= 3) {
      const threeMonthRevenue = ops.slice(-3).reduce((sum, m) => sum + m.revenue, 0);
      if (threeMonthRevenue < 20000) {
        alerts.push({
          type: 'revenue_below_target',
          severity: 'warning',
          customer_id: customer.id,
          message: `前 3 个月营业额 £${threeMonthRevenue.toLocaleString()} 低于目标 £30,000`,
        });
      }
    }
  }

  return alerts.sort((a, b) => (a.severity === 'red' ? -1 : 1));
}
```

## 验收标准

- [ ] Admin 能在 `/admin/team` 开通 Kelly/Lisa/Tim/Ryan 的账号
- [ ] 4 名成员登录后自动进入 `/staff` 路径，看到各自的 Dashboard
- [ ] Kelly 的待办：显示未回答的客户 QA 列表
- [ ] Lisa 的待办：显示超时阶段预警、里程碑日历
- [ ] Tim 的待办：显示 24 小时未回复 QA、今日会议
- [ ] Ryan 的待办：显示财务里程碑进度、新线索
- [ ] 进入 `/staff/customers/:id` 能看到客户完整信息（所有 Tab）
- [ ] 没有权限的操作按钮显示为禁用（灰色）或不显示
- [ ] Kelly 不能看到"更新进度"按钮，Tim 可以
- [ ] Ryan 能看到"录入月度财务数据"，Kelly 看不到
- [ ] Lisa 的合规预警：超时阶段正确标红，营业额低于目标显示警告

## 不要做的事

- ❌ 不要给 Staff 设置过于复杂的 DB-level RLS（v1 前端判断即可）
- ❌ 不要让 Staff 看到系统设置、定价修改等 Admin 专有功能
- ❌ 不要删除数据权限（只有 Admin 可以删除）
- ❌ 不要混淆 Staff 和 Admin 的路由（`/staff/*` 和 `/admin/*` 完全分开）

## 完成后的 commit message

```
feat(staff): implement internal team role system with 4 staff roles

- Add staff role routing and layout (/staff/*)
- Add role-specific dashboards for Kelly/Lisa/Tim/Ryan
- Add staff customer detail view with permission-gated actions
- Add compliance alert system for project manager
- Add admin team management page (/admin/team)
- Add staff permission utility (src/lib/staffPermissions.js)
```

## 完成后更新 PROGRESS.md

```markdown
## 任务 04c：内部团队角色系统 ✅
- 完成日期：[填入]
- 测试账号：[Kelly/Lisa/Tim/Ryan 各测试一遍]
- 权限矩阵验证：[Y/N]
- 备注：[备注]
```
