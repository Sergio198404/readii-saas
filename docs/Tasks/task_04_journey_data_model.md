# 任务 04：Journey 数据模型和 18 阶段内容

## 目标

把"服务路径"做成客户工作台的核心功能。Code 这个任务要做三件事：
1. 做一个 Admin 端的 Journey 模板管理界面（让苏晓宇能编辑 18 个阶段的内容）
2. 把苏晓宇录入的 18 个阶段在客户端正确展示
3. 实现客户点击某个阶段查看详情的功能

## 前置条件

- 任务 01（Schema）已完成
- 任务 03（客户工作台骨架）已完成

## 上下文

参考 `docs/v1_product_manual.md`：
- 第 1.2 节（journey_templates, journey_stages 表结构）
- 第 2.4.3 节（admin 更新进度 API）

## 关键业务理解

**Journey 是 Readii v1 最核心的产品资产**。它把"一个签证全案"拆成 18 个阶段，每个阶段都让客户清楚：
- 这一步为什么重要
- 客户自己要做什么
- Readii 在做什么

**这个产品能成立的前提是 18 个阶段的文案足够好**。如果文案敷衍，客户看了没感觉；如果文案好，客户每次打开都能感受到服务价值。

## 具体任务

### 1. 苏晓宇需要提供的原始内容

在开始编码前，苏晓宇需要提供以下内容（文件：`docs/journey_content/sw_self_sponsored.md`）：

**自雇工签 18 个阶段完整内容**：

每个阶段包含：
```
阶段 1：签约与需求深度沟通
- 中文标题：签约与需求深度沟通
- 英文标题：Contract Signing & Deep Discovery
- 为什么重要：（2-3 句话）这一步确立...
- 你需要做什么：（3-5 个动作）完成合同签署、缴纳首付款...
- Readii 在做什么：（3-5 个动作）整理你的 case file...
- 预计天数：3
- 交付物：合同副本、Case File、24 周时间表
```

苏晓宇需要把完整的 18 个阶段写完。这是业务内容，Code 只负责展示。

**建议的 18 个阶段骨架**（自雇工签）：
1. 签约与需求深度沟通
2. 英国公司注册
3. 公司银行账户开立
4. 办公地址确定
5. 商业计划书制定
6. 公司合规基础建设（VAT、PAYE、雇主保险）
7. Sponsor License 申请准备
8. Sponsor License 递交
9. Sponsor License 获批
10. CoS 准备与发放
11. 工签申请材料准备
12. 英语要求与 IHS 支付
13. 递交签证申请
14. 生物信息采集（BRP）
15. 签证下发
16. 入境英国准备
17. 入境后合规（落地 30 天内）
18. 后续年度合规（SL 维护、报税、ILR 规划）

**同样需要为创新签做一份**（`docs/journey_content/innovator_founder.md`），可能阶段略有不同（增加背书机构对接、ES evidence 等）。

### 2. 开发任务

#### 2.1 Admin 端：Journey 模板管理

**路由**：`/admin/journey-templates`

**页面 1：模板列表**（`src/pages/admin/JourneyTemplatesList.jsx`）

显示所有 journey_templates（默认就 2 个：SW 和 IF）。每个模板展示：
- 模板名、服务类型、总阶段数、估计周期
- 编辑按钮 → 进入阶段列表

**页面 2：阶段列表**（`src/pages/admin/JourneyStagesList.jsx`）

路由：`/admin/journey-templates/:templateId/stages`

功能：
- 显示模板下所有阶段（按 stage_number 排序）
- 每个阶段显示：阶段号、标题、状态（内容完整度）
- 支持拖拽重排序（可选，v1 可以暂时不做）
- 支持新增阶段
- 点击阶段 → 进入编辑页

**页面 3：单阶段编辑**（`src/pages/admin/JourneyStageEditor.jsx`）

路由：`/admin/journey-templates/:templateId/stages/:stageId/edit`

表单字段：
- 阶段号（number）
- 中文标题（title）
- 英文标题（title_en，可选）
- 为什么重要（description_why，textarea，支持 markdown）
- 你需要做什么（description_customer_action，textarea，支持 markdown）
- Readii 在做什么（description_readii_action，textarea，支持 markdown）
- 预计天数（estimated_duration_days）
- 交付物列表（deliverables，数组字段，用户可增删）

**API 调用**：

```javascript
// src/lib/api/admin.js（新建）

export async function listJourneyTemplates() {
  const { data, error } = await supabase
    .from('journey_templates')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getJourneyTemplateWithStages(templateId) {
  const { data: template } = await supabase
    .from('journey_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  const { data: stages } = await supabase
    .from('journey_stages')
    .select('*')
    .eq('template_id', templateId)
    .order('stage_number');

  return { template, stages };
}

export async function updateJourneyStage(stageId, updates) {
  const { data, error } = await supabase
    .from('journey_stages')
    .update(updates)
    .eq('id', stageId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createJourneyStage(templateId, data) {
  const { data: created, error } = await supabase
    .from('journey_stages')
    .insert({ ...data, template_id: templateId })
    .select()
    .single();
  if (error) throw error;
  return created;
}

export async function deleteJourneyStage(stageId) {
  const { error } = await supabase
    .from('journey_stages')
    .delete()
    .eq('id', stageId);
  if (error) throw error;
}
```

#### 2.2 Admin 端：客户进度管理

**路由**：`/admin/customers/:customerId/progress`

功能：
- 显示该客户的完整 journey（所有 18 阶段）
- 每个阶段展示状态 dropdown（pending / in_progress / blocked_on_customer / blocked_on_readii / completed / skipped）
- 支持快速切换状态
- 切换时自动更新 customer_profiles.current_stage_id 到第一个 in_progress 的阶段
- 备注字段（每个阶段一个 notes）

**API 调用**：

```javascript
export async function getCustomerProgress(customerId) {
  const { data: customer } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('id', customerId)
    .single();

  const { data: template } = await supabase
    .from('journey_templates')
    .select('*')
    .eq('service_type', customer.service_type)
    .single();

  const { data: stages } = await supabase
    .from('journey_stages')
    .select('*')
    .eq('template_id', template.id)
    .order('stage_number');

  const { data: progress } = await supabase
    .from('customer_journey_progress')
    .select('*')
    .eq('customer_id', customerId);

  return { customer, template, stages, progress };
}

export async function updateStageProgress(customerId, stageId, update) {
  // 先查是否已有记录
  const { data: existing } = await supabase
    .from('customer_journey_progress')
    .select('*')
    .eq('customer_id', customerId)
    .eq('stage_id', stageId)
    .single();

  if (existing) {
    // 更新
    const { data, error } = await supabase
      .from('customer_journey_progress')
      .update({
        ...update,
        updated_at: new Date().toISOString(),
        ...(update.status === 'in_progress' && !existing.started_at ? { started_at: new Date().toISOString() } : {}),
        ...(update.status === 'completed' && !existing.completed_at ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // 插入
    const { data, error } = await supabase
      .from('customer_journey_progress')
      .insert({
        customer_id: customerId,
        stage_id: stageId,
        ...update,
        ...(update.status === 'in_progress' ? { started_at: new Date().toISOString() } : {}),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// 同步更新 customer_profiles.current_stage_id
export async function updateCustomerCurrentStage(customerId) {
  const { data: progress } = await supabase
    .from('customer_journey_progress')
    .select('stage_id, journey_stages!inner(stage_number)')
    .eq('customer_id', customerId)
    .eq('status', 'in_progress')
    .order('journey_stages(stage_number)');

  if (progress && progress[0]) {
    await supabase
      .from('customer_profiles')
      .update({ current_stage_id: progress[0].stage_id })
      .eq('id', customerId);
  }
}
```

#### 2.3 客户端：完整 Journey 页面

**路由**：`/customer/journey`

**文件**：`src/pages/customer/CustomerJourney.jsx`

功能：
- 显示 18 阶段纵向时间线（不同于 Dashboard 的横向进度条）
- 每个阶段卡片显示：
  - 阶段号 + 标题 + 状态 badge
  - 点击展开 → 显示"为什么/你做什么/Readii 做什么"三栏
  - 如果已完成：显示 completed_at 时间
  - 如果 blocked：显示 blocker_reason
- 顶部摘要：总体进度、预计完成日期

**视觉参考**：类似 Stripe Atlas 的进度页（垂直时间线 + 可展开卡片）。

```jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../contexts/RoleContext';

export function CustomerJourney() {
  const { user } = useRole();
  const [data, setData] = useState(null);
  const [expandedStageId, setExpandedStageId] = useState(null);

  useEffect(() => {
    loadJourneyData();
  }, []);

  async function loadJourneyData() {
    const { data: customer } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const { data: template } = await supabase
      .from('journey_templates')
      .select('*')
      .eq('service_type', customer.service_type)
      .single();

    const { data: stages } = await supabase
      .from('journey_stages')
      .select('*')
      .eq('template_id', template.id)
      .order('stage_number');

    const { data: progress } = await supabase
      .from('customer_journey_progress')
      .select('*')
      .eq('customer_id', customer.id);

    setData({ customer, template, stages, progress });
  }

  if (!data) return <div>加载中...</div>;

  const progressMap = Object.fromEntries(
    data.progress.map(p => [p.stage_id, p])
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">我的完整路径</h1>

      <div className="space-y-4">
        {data.stages.map(stage => {
          const p = progressMap[stage.id];
          const isExpanded = expandedStageId === stage.id;
          const isCurrent = stage.id === data.customer.current_stage_id;

          return (
            <div key={stage.id} className={`
              bg-white rounded-lg shadow transition-all
              ${isCurrent ? 'ring-2 ring-blue-500' : ''}
            `}>
              <button
                onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <StageStatusIcon status={p?.status} stageNumber={stage.stage_number} />
                  <div className="text-left">
                    <div className="font-medium">{stage.title}</div>
                    <div className="text-sm text-gray-500">
                      {stage.estimated_duration_days} 天 ·
                      <StatusLabel status={p?.status || 'pending'} />
                    </div>
                  </div>
                </div>
                <span className="text-gray-400">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t p-6">
                  <div className="grid grid-cols-3 gap-4">
                    <InfoBox title="💡 为什么重要" content={stage.description_why} bg="amber" />
                    <InfoBox title="✅ 你需要做什么" content={stage.description_customer_action} bg="blue" />
                    <InfoBox title="🔧 Readii 在做什么" content={stage.description_readii_action} bg="green" />
                  </div>

                  {stage.deliverables?.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">本阶段交付物：</div>
                      <ul className="text-sm text-gray-600 list-disc pl-5">
                        {stage.deliverables.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}

                  {p?.blocker_reason && (
                    <div className="mt-4 p-3 bg-red-50 rounded text-sm">
                      <span className="font-medium text-red-700">卡住原因：</span>
                      {p.blocker_reason}
                    </div>
                  )}

                  {p?.completed_at && (
                    <div className="mt-4 text-sm text-green-700">
                      ✓ 已完成于 {new Date(p.completed_at).toLocaleString('zh-CN')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageStatusIcon({ status, stageNumber }) {
  const map = {
    completed: <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center">✓</div>,
    in_progress: <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center animate-pulse">{stageNumber}</div>,
    blocked_on_customer: <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center">!</div>,
    blocked_on_readii: <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center">!</div>,
    skipped: <div className="w-10 h-10 rounded-full bg-gray-300 text-white flex items-center justify-center">-</div>,
    pending: <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">{stageNumber}</div>,
  };
  return map[status] || map.pending;
}

function StatusLabel({ status }) {
  const map = {
    completed: <span className="ml-2 text-green-600">已完成</span>,
    in_progress: <span className="ml-2 text-blue-600">进行中</span>,
    blocked_on_customer: <span className="ml-2 text-red-600">等待你的行动</span>,
    blocked_on_readii: <span className="ml-2 text-orange-600">Readii 处理中</span>,
    pending: <span className="ml-2 text-gray-500">待开始</span>,
    skipped: <span className="ml-2 text-gray-500">已跳过</span>,
  };
  return map[status] || map.pending;
}

function InfoBox({ title, content, bg }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-900',
    blue: 'bg-blue-50 text-blue-900',
    green: 'bg-green-50 text-green-900',
  };
  return (
    <div className={`${colors[bg]} rounded-lg p-4`}>
      <div className="font-medium mb-2">{title}</div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap">{content}</div>
    </div>
  );
}
```

### 3. 初始数据录入

**Admin 侧创建两个模板**：

```sql
-- 自雇工签模板
INSERT INTO journey_templates (service_type, name, total_stages, estimated_weeks)
VALUES ('sw_self_sponsored', '自雇工签全流程', 18, 24);

-- 创新签模板
INSERT INTO journey_templates (service_type, name, total_stages, estimated_weeks)
VALUES ('innovator_founder', '创新签全流程', 16, 36);
```

然后苏晓宇通过 admin 界面录入 34 个阶段的完整内容（18 + 16）。

## 验收标准

- [ ] Admin 能在 `/admin/journey-templates` 看到 2 个模板
- [ ] Admin 能进入每个模板编辑单个阶段（完整表单）
- [ ] Admin 能在 `/admin/customers/:customerId/progress` 查看客户进度并修改
- [ ] 修改进度后，客户端 Dashboard 实时更新（F5 刷新即可）
- [ ] 客户在 `/customer/journey` 看到所有 18 阶段的完整时间线
- [ ] 点击阶段展开/折叠正常
- [ ] 三栏布局（为什么 / 你做什么 / Readii 做什么）美观
- [ ] 状态 icon 根据状态显示不同颜色
- [ ] 苏晓宇至少完成自雇工签 18 个阶段的内容录入

## 不要做的事

- ❌ 不要做阶段拖拽排序（v1 不需要，阶段号固定）
- ❌ 不要做 journey_templates 的新建/删除（admin 只编辑现有的，不新建）
- ❌ 不要做客户端修改进度的功能（只有 admin 能改）
- ❌ 不要实现 markdown 渲染，先用 whitespace-pre-wrap

## 完成后的 commit message

```
feat(journey): implement journey template management and customer journey view

- Add admin routes for managing journey templates and stages
- Add admin UI for updating customer progress
- Add customer journey timeline view with expandable stage cards
- Seed 2 journey templates (sw_self_sponsored, innovator_founder)
```

## 完成后更新 PROGRESS.md

```markdown
## 任务 4：Journey 数据模型 ✅
- 完成日期：[填入]
- 模板数：2（SW + IF）
- 已录入阶段：[X]/34
- 备注：[备注]
```
