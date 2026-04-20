# 任务 03：客户画像问卷引擎

## 目标

实现一个供 Readii 内部（苏晓宇/Tim）填写的客户画像问卷系统。填完 10 个问题后，系统自动：
1. 为该客户生成定制化的 Journey 阶段列表（包含哪些阶段、每个阶段用哪个变体）
2. 生成客户画像卡片（内部用）
3. 识别所有前置风险预警
4. 计算关键时间窗口

## 前置条件

- 任务 01（Schema）已完成
- 任务 02（角色路由）已完成
- 任务 04（Journey 变体数据已入库）**已完成或同步进行**
  - 注意：任务 03 和 04 可以同步开发，但问卷的"生成 Journey"功能依赖任务 04 的数据

## 上下文

参考以下文件：
- `docs/journey_content/readii_sw_journey_content_v1.md` → **第一部分：客户画像问卷**（10 个问题的完整定义、字段名、选项值、触发规则）
- `docs/v1_product_manual.md` → 第 0.3 节（角色）、第 3.1 节（路由）

## 具体任务

### 1. 数据库：客户画像表

在 `customer_profiles` 表上增加画像字段（已有表，用 ALTER 扩展）：

```sql
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS questionnaire_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS questionnaire_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS questionnaire_completed_by UUID REFERENCES profiles(id),
  -- Q1
  ADD COLUMN IF NOT EXISTS employee_location TEXT CHECK (employee_location IN (
    'uk_psw', 'uk_other', 'overseas'
  )),
  -- Q2
  ADD COLUMN IF NOT EXISTS employee_nationality TEXT CHECK (employee_nationality IN (
    'cn_mainland', 'cn_hk_mo', 'tw', 'english_native', 'other'
  )),
  -- Q3
  ADD COLUMN IF NOT EXISTS current_visa_remaining_months TEXT CHECK (current_visa_remaining_months IN (
    'lt_6', '6_to_12', 'gt_12', 'na'
  )),
  -- Q4
  ADD COLUMN IF NOT EXISTS employee_english_status TEXT CHECK (employee_english_status IN (
    'uk_degree', 'english_native', 'ecctis', 'has_valid_score', 'need_exam'
  )),
  -- Q5
  ADD COLUMN IF NOT EXISTS target_soc_code TEXT,
  ADD COLUMN IF NOT EXISTS requires_criminal_record BOOLEAN DEFAULT false,
  -- Q6
  ADD COLUMN IF NOT EXISTS countries_lived TEXT[], -- 曾居住国家（无犯罪相关）
  -- Q7
  ADD COLUMN IF NOT EXISTS startup_capital TEXT CHECK (startup_capital IN (
    'lt_50k', '50k_to_100k', 'gt_100k'
  )),
  -- Q8
  ADD COLUMN IF NOT EXISTS company_structure TEXT CHECK (company_structure IN (
    'investor_only', 'investor_plus_employee'
  )),
  -- Q9
  ADD COLUMN IF NOT EXISTS ao_candidate TEXT CHECK (ao_candidate IN (
    'investor', 'employee', 'third_party', 'undecided'
  )),
  -- Q10
  ADD COLUMN IF NOT EXISTS needs_mentoring BOOLEAN DEFAULT false,
  -- 计算字段（由规则引擎填充）
  ADD COLUMN IF NOT EXISTS visa_path TEXT CHECK (visa_path IN ('a_inside_uk', 'b_outside_uk')),
  ADD COLUMN IF NOT EXISTS director_uk_status TEXT,
  ADD COLUMN IF NOT EXISTS annual_revenue_target TEXT,
  ADD COLUMN IF NOT EXISTS requires_tb_test BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]'::jsonb;
```

### 2. 路由和页面

**Admin 端页面**：`/admin/customers/:customerId/questionnaire`

这是一个 **仅 Admin/Staff** 可见的页面，不对客户开放。

### 3. 前端：问卷表单组件

**文件**：`src/pages/admin/CustomerQuestionnaire.jsx`

实现一个分步骤表单（Step Wizard），每步一个问题，支持前后导航：

```
Step 1/10 → Step 2/10 → ... → Step 10/10 → 预览 → 确认生成
```

**每个步骤的 UI 要求**：
- 问题标题（中文）
- 简短的说明文字（解释为什么问这个）
- 选项（单选按钮或下拉选择）
- 如果有触发规则，在选项旁边用图标提示（⚠️ 橙色 = 需要注意，🔴 红色 = 阻断）
- "上一步"/"下一步"按钮

**第 5 题（SOC Code）的特殊处理**：
- 提供一个下拉搜索框（输入关键词搜索 SOC Code）
- 同时提供"需要无犯罪记录"的 SOC Code 快速标注（如果选择了这类 SOC，自动提示）
- SOC Code 列表可以在前端硬编码（选取最常见的 20-30 个）

**第 6 题（居住国家）的条件显示**：
- 仅在 Q5 触发了"需要无犯罪记录"时显示
- 多选，提供常见国家快速选项 + 自由输入

### 4. 规则引擎：`src/lib/journeyRuleEngine.js`

这是核心逻辑，根据问卷答案计算：
1. visa_path（路径 A 还是 B）
2. 需要哪些阶段（stage_codes 列表）
3. 每个阶段用哪个变体（variant）
4. 所有警告（warnings）
5. 关键时间窗口计算

```javascript
// src/lib/journeyRuleEngine.js

export function runRuleEngine(questionnaire) {
  const {
    employee_location, employee_nationality, current_visa_remaining_months,
    employee_english_status, target_soc_code, requires_criminal_record,
    countries_lived, startup_capital, company_structure, ao_candidate,
    needs_mentoring, signed_date
  } = questionnaire;

  // 1. 确定路径
  const visa_path = employee_location === 'overseas' ? 'b_outside_uk' : 'a_inside_uk';

  // 2. 计算需要哪些阶段
  const stages = computeStages(questionnaire, visa_path);

  // 3. 计算警告
  const warnings = computeWarnings(questionnaire, visa_path);

  // 4. 计算时间窗口
  const timelineHints = computeTimeline(questionnaire, visa_path, signed_date);

  return { visa_path, stages, warnings, timelineHints };
}

function computeStages(q, visa_path) {
  // 参考 docs/journey_content/readii_sw_journey_content_v1.md 的触发规则 JSON
  const stages = [];

  // 所有客户都有的阶段（always）
  const always = ['stage_01', 'stage_02', 'stage_04', 'stage_05', 'stage_06',
                  'stage_07', 'stage_08', 'stage_09', 'stage_12', 'stage_13',
                  'stage_15', 'stage_16', 'stage_17', 'stage_18', 'stage_19',
                  'stage_20', 'stage_22', 'stage_23', 'stage_24'];

  stages.push(...always.map(code => ({
    stage_code: code,
    variant: selectVariant(code, q)
  })));

  // 条件阶段
  if (q.requires_criminal_record && visa_path === 'b_outside_uk') {
    stages.splice(2, 0, { stage_code: 'stage_03', variant: null });
  }
  if (visa_path === 'a_inside_uk') {
    stages.push({ stage_code: 'stage_10', variant: null });
  }
  if (visa_path === 'b_outside_uk') {
    stages.push({ stage_code: 'stage_11', variant: null });
    if (['cn_mainland', 'cn_hk_mo'].includes(q.employee_nationality)) {
      stages.push({ stage_code: 'stage_14', variant: null });
    }
    stages.push({ stage_code: 'stage_21', variant: null });
  }

  // 按阶段编号排序
  return stages.sort((a, b) => stageOrder(a.stage_code) - stageOrder(b.stage_code));
}

function selectVariant(stageCode, q) {
  const variantMap = {
    'stage_02': {
      'uk_degree': 'variant_2a',
      'english_native': 'variant_2b',
      'ecctis': 'variant_2c',
      'has_valid_score': 'variant_2d',
      'need_exam': 'variant_2e',
    },
    'stage_04': {
      'investor_only': 'variant_4a',
      'investor_plus_employee': 'variant_4b',
    },
    'stage_06': {
      'a_inside_uk': 'variant_6a', // director 在英国
      'b_outside_uk': 'variant_6b', // director 境外
    },
    'stage_09': {
      'lt_50k': 'variant_9a',
      '50k_to_100k': 'variant_9a',
      'gt_100k': 'variant_9a',
    },
    'stage_23': {
      'a_inside_uk': 'variant_23a',
      'b_outside_uk': 'variant_23b',
    },
  };

  const map = variantMap[stageCode];
  if (!map) return null;

  if (stageCode === 'stage_02') return map[q.employee_english_status] || null;
  if (stageCode === 'stage_04') return map[q.company_structure] || null;
  if (stageCode === 'stage_06') return map[q.visa_path] || null;
  if (stageCode === 'stage_09') return map[q.startup_capital] || 'variant_9a';
  if (stageCode === 'stage_23') return map[q.visa_path] || null;

  return null;
}

function computeWarnings(q, visa_path) {
  const warnings = [];

  if (q.current_visa_remaining_months === 'lt_6') {
    warnings.push({
      severity: 'red',
      code: 'visa_expiry_critical',
      message: '⛔ 签证剩余不足 6 个月，整个工签流程需要 12-14 个月，须立即评估过桥方案（例如切换签证类型）。'
    });
  }
  if (q.current_visa_remaining_months === '6_to_12') {
    warnings.push({
      severity: 'orange',
      code: 'visa_expiry_tight',
      message: '⚠️ 签证剩余 6-12 个月，时间紧张。所有前置事项（英语、Ecctis 等）必须立即启动。'
    });
  }
  if (q.startup_capital === 'lt_50k') {
    warnings.push({
      severity: 'red',
      code: 'capital_insufficient',
      message: '⛔ 启动资金不足 £50K。申请 Sponsor Licence 时银行余额须达此标准，须讨论追加资金计划。'
    });
  }
  if (q.ao_candidate === 'undecided') {
    warnings.push({
      severity: 'blocker',
      code: 'ao_undecided',
      message: '🚫 AO 人选未确定。此项目确认前，公司注册阶段无法推进。'
    });
  }
  if (q.employee_english_status === 'ecctis') {
    warnings.push({
      severity: 'orange',
      code: 'ecctis_urgent',
      message: '⚠️ Ecctis 认证最长 20 工作日，无加急选项。签约后第一周内必须发出 MOI 申请邮件。'
    });
  }
  if (q.ao_candidate === 'employee') {
    warnings.push({
      severity: 'orange',
      code: 'ao_is_employee',
      message: '⚠️ 雇员担任 AO：UKVI 会格外审查 genuine employment 关系，须确保公司结构和汇报关系清晰合理。'
    });
  }

  return warnings;
}

function computeTimeline(q, visa_path, signed_date) {
  const start = signed_date ? new Date(signed_date) : new Date();
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
  const fmt = d => d.toISOString().split('T')[0];

  const slSubmitDate = addMonths(start, 10);
  const slApprovalDate = addMonths(start, 12);
  const visaSubmitDate = addMonths(start, 13);
  const visaApprovalDate = visa_path === 'b_outside_uk'
    ? addMonths(start, 14)
    : addMonths(start, 15);

  // TB 体检窗口：SL 预计获批前 3-5 个月
  const tbWindowStart = addMonths(slApprovalDate, -5);
  const tbWindowEnd = addMonths(slApprovalDate, -3);

  const hints = {
    sl_expected_submit: fmt(slSubmitDate),
    sl_expected_approval: fmt(slApprovalDate),
    visa_expected_submit: fmt(visaSubmitDate),
    visa_expected_approval: fmt(visaApprovalDate),
  };

  if (visa_path === 'b_outside_uk' && ['cn_mainland','cn_hk_mo'].includes(q.employee_nationality)) {
    hints.tb_test_window_start = fmt(tbWindowStart);
    hints.tb_test_window_end = fmt(tbWindowEnd);
  }

  return hints;
}

const STAGE_ORDER = {
  stage_01: 1, stage_02: 2, stage_03: 3, stage_04: 4, stage_05: 5,
  stage_06: 6, stage_07: 7, stage_08: 8, stage_09: 9, stage_10: 10,
  stage_11: 11, stage_12: 12, stage_13: 13, stage_14: 14, stage_15: 15,
  stage_16: 16, stage_17: 17, stage_18: 18, stage_19: 19, stage_20: 20,
  stage_21: 21, stage_22: 22, stage_23: 23, stage_24: 24,
};

function stageOrder(code) { return STAGE_ORDER[code] || 99; }
```

### 5. 预览页面：客户画像卡片

问卷最后一步（Step 10）填完后，进入"预览"步骤，显示：

```
客户画像预览
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

签证路径：路径 A（境内 PSW 转签）
英语方案：Ecctis 认证
需要 TB 体检：否（路径 A 不需要）
需要无犯罪证明：否（非教育/医疗岗位）
公司结构：投资人 100% 持股
AO 人选：投资人本人
资金状况：£50-100K（⚠️ 注意维持余额）
运营陪跑：是

定制 Journey 将包含 [N] 个阶段：
阶段 1, 2（变体2C-Ecctis）, 4（变体4A）, 5, 6（变体6A）,
7, 8, 9, 10（HR合规子模块）, 12, 13, 15, 16, 17, 18, 19, 20, 22, 23（变体23A）, 24

⚠️ 前置风险预警：
- Ecctis 认证必须本周启动（无加急选项）
- 资金处于下限，建议保持 £50K+ 余额

🗓️ 预估关键时间节点：
- 预计 SL 申请递交：2027-02
- 预计 SL 获批：2027-04
- 预计工签获批：2027-07

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[确认，生成 Journey] [返回修改]
```

### 6. 生成 Journey 的 API 调用

点击"确认，生成 Journey"后，调用 Netlify Function：

**文件**：`netlify/functions/generate-customer-journey.js`

```javascript
// 伪代码，Code 按实际情况实现
export async function handler(event) {
  const { customerId } = JSON.parse(event.body);

  // 1. 从 customer_profiles 读取问卷答案
  const profile = await supabase.from('customer_profiles')
    .select('*').eq('id', customerId).single();

  // 2. 运行规则引擎
  const { visa_path, stages, warnings, timelineHints } = runRuleEngine(profile.data);

  // 3. 找到每个 stage_code 对应的 journey_stage 记录（从数据库）
  //    查询 journey_stages 表，过滤 service_type='sw_self_sponsored'
  //    和 stage_code 在 stages 列表中

  // 4. 为该客户创建 customer_journey_progress 记录
  //    每个 stage 一条记录，status='pending'，记录 selected_variant

  // 5. 更新 customer_profiles：
  //    - questionnaire_completed = true
  //    - visa_path, requires_tb_test 等计算字段
  //    - warnings JSON
  //    - expected_completion_date（根据 timelineHints）

  // 6. 返回生成的 Journey 数据
  return { success: true, stageCount: stages.length, warnings };
}
```

### 7. Admin 创建客户的流程（整合）

**原有流程**（任务文档 2.4.2）：Admin 在 `/admin/customers/create` 创建客户

**新增步骤**：创建客户账号后，自动跳转到问卷页面
```
/admin/customers/create → 填基本信息（姓名、邮箱、签约日期）
→ 创建账号成功
→ 自动跳转到 /admin/customers/:id/questionnaire
→ 填 10 题问卷
→ 预览 + 确认
→ Journey 自动生成
→ 跳转到 /admin/customers/:id（客户详情页）
```

## 验收标准

- [ ] 问卷 10 道题全部可以正常填写，支持前后导航
- [ ] 第 6 题（居住国家）仅在 Q5 触发"需要无犯罪证明"时才显示
- [ ] 填完问卷后，预览页面正确显示：路径 A/B、阶段数量、所有警告
- [ ] 点击"确认生成"后，`customer_journey_progress` 表中有对应记录（每个阶段一条）
- [ ] 生成后，客户登录 `/customer/dashboard` 能看到 Journey 进度条（阶段数量正确）
- [ ] 路径 B 的客户 Journey 中有 `stage_11`（境外协作）和 `stage_21`（Defined CoS），路径 A 的有 `stage_10`（HR 合规）
- [ ] 变体正确匹配：Ecctis 背景的客户，阶段 2 显示变体 2C 的内容
- [ ] 警告正确触发：资金 < £50K 显示红色警告

## 不要做的事

- ❌ 不要让客户自己填这个问卷（问卷只对 Admin/Staff 开放）
- ❌ 不要一次性提交所有问题（必须是分步 wizard，支持随时保存草稿）
- ❌ 不要硬编码阶段内容（阶段内容从数据库读，不是前端写死）
- ❌ 不要在同一 PR 里同时实现问卷 + 阶段内容展示（这是两个不同任务）

## 完成后的 commit message

```
feat(questionnaire): implement customer profile questionnaire engine

- Add 10-question step wizard form for admin/staff use
- Implement journey rule engine (src/lib/journeyRuleEngine.js)
- Auto-generate customer Journey with correct stages and variants
- Display profile preview with warnings before confirming
- Create customer_journey_progress records on confirmation
- Extend customer_profiles with questionnaire fields
```

## 完成后更新 PROGRESS.md

```markdown
## 任务 03：客户画像问卷引擎 ✅
- 完成日期：[填入]
- 测试客户：[填入]
- 生成 Journey 阶段数：[路径A: N / 路径B: N]
- 备注：[备注]
```
