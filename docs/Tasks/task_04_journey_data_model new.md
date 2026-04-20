# 任务 04：Journey 变体系统 + 阶段内容数据库

## 目标

把 `docs/journey_content/readii_sw_journey_content_v1.md` 的全部内容入库，并实现：
1. 阶段变体表 + 阶段内容扩展字段
2. Admin 端阶段内容管理界面（供苏晓宇录入 24 个阶段的内容）
3. 客户端纵向 Journey 时间线视图
4. 每个阶段的自助/委托选择功能

## 前置条件

- 任务 01 已完成（Schema 已部署）
- 任务 03 已完成或并行进行

## 上下文

主要参考：`docs/journey_content/readii_sw_journey_content_v1.md` 第二部分（24 个阶段完整内容 + 17 个变体）

## 数据库扩展

### 扩展 journey_stages 表

```sql
ALTER TABLE journey_stages
  ADD COLUMN IF NOT EXISTS stage_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'always' CHECK (
    applies_to IN ('always', 'path_a', 'path_b', 'conditional')
  ),
  ADD COLUMN IF NOT EXISTS has_sku BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sku_self_serve_label TEXT,
  ADD COLUMN IF NOT EXISTS sku_delegate_label TEXT,
  ADD COLUMN IF NOT EXISTS sku_price_pence INT,
  ADD COLUMN IF NOT EXISTS sku_member_price_pence INT,
  ADD COLUMN IF NOT EXISTS sku_self_serve_content TEXT,
  ADD COLUMN IF NOT EXISTS has_sub_module BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_module_type TEXT;
```

### 新建 stage_variants 表

```sql
CREATE TABLE IF NOT EXISTS stage_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
  variant_code TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  trigger_field TEXT NOT NULL,
  trigger_value TEXT NOT NULL,
  title TEXT NOT NULL,
  description_why TEXT NOT NULL,
  description_customer_action TEXT NOT NULL,
  description_readii_action TEXT NOT NULL,
  estimated_duration_days INT,
  deliverables TEXT[],
  warnings TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stage_id, variant_code)
);

CREATE INDEX idx_variants_stage ON stage_variants(stage_id);
```

### 扩展 customer_journey_progress 表

```sql
ALTER TABLE customer_journey_progress
  ADD COLUMN IF NOT EXISTS selected_variant_id UUID REFERENCES stage_variants(id),
  ADD COLUMN IF NOT EXISTS service_mode TEXT DEFAULT 'self' CHECK (
    service_mode IN ('self', 'delegate', 'not_applicable')
  ),
  ADD COLUMN IF NOT EXISTS service_mode_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_mode_confirmed_at TIMESTAMPTZ;
```

### 初始化模板数据

```sql
INSERT INTO journey_templates (service_type, name, total_stages, estimated_weeks)
VALUES ('sw_self_sponsored', '自雇工签全案（Sponsor Licence + Skilled Worker）', 24, 60)
ON CONFLICT DO NOTHING;
```

## 具体任务

### 1. Admin 阶段管理界面

**路由**：`/admin/journey-templates`

**页面 A：模板列表**（`src/pages/admin/JourneyTemplatesList.jsx`）
- 显示所有模板（v1 只有 1 个：自雇工签）
- 每个模板显示：名称、阶段数、最后更新时间
- 点击"管理阶段"→ 进入页面 B

**页面 B：阶段列表**（`src/pages/admin/JourneyStagesList.jsx`）
- 路由：`/admin/journey-templates/:templateId/stages`
- 列出所有阶段（按 stage_number 排序）
- 每行显示：阶段号、stage_code、标题、适用路径、内容完整度（用色块标注：绿=完整、黄=部分、红=空）
- 点击某行→ 进入页面 C

**页面 C：阶段编辑**（`src/pages/admin/JourneyStageEditor.jsx`）
- 路由：`/admin/journey-templates/:templateId/stages/:stageId/edit`

**Tab 1：基本信息**：
```
stage_code（只读）
阶段号（只读）
中文标题（text input）
适用路径（select: always/path_a/path_b/conditional）
预计天数（number input）
交付物（tag input，可增删）
```

**Tab 2：三段式内容**：
```
为什么重要（rich textarea，支持换行）
你需要做什么（rich textarea）
Readii 在做什么（rich textarea）
```

**Tab 3：SKU 设置**：
```
是否有 SKU（toggle）
  → 开启后显示：
  自助版按钮文案（如"免费（Readii 提供指引）"）
  委托版按钮文案（如"委托 Readii £1,799"）
  委托版定价（number，单位：便士）
  会员价（number，单位：便士）
  自助版内容说明（textarea，展开给客户看的自助操作指引）
```

**Tab 4：变体管理**（仅有变体的阶段显示此 Tab）：
- 显示该阶段的所有变体列表
- 每个变体可展开编辑：variant_code、变体标题、三段式内容、预计天数

**保存按钮**：保存当前 Tab 内容到数据库

**Admin API（Netlify Functions）**：
- `GET /api/admin/journey-stages` → 获取所有阶段
- `PUT /api/admin/journey-stages/:id` → 更新阶段
- `POST /api/admin/stage-variants` → 创建变体
- `PUT /api/admin/stage-variants/:id` → 更新变体
- `DELETE /api/admin/stage-variants/:id` → 删除变体

### 2. 客户端 Journey 视图

**路由**：`/customer/journey`
**文件**：`src/pages/customer/CustomerJourney.jsx`

**视觉布局**：纵向时间线，左侧状态图标，右侧内容区

```
┌──┬──────────────────────────────────────────────┐
│✓ │ 阶段 1  客户接洽与信息收集          已完成    │
├──┼──────────────────────────────────────────────┤
│⟳ │ 阶段 2  英语准备·Ecctis认证中       进行中   │ ← 点击展开
│  │ ─────────────────────────────────────────    │
│  │ 💡 为什么重要                                 │
│  │ [内容]                                       │
│  │                                              │
│  │ ✅ 你需要做什么                               │
│  │ [内容]                                       │
│  │                                              │
│  │ 🔧 Readii 在做什么                           │
│  │ [内容]                                       │
│  │                                              │
│  │ ┌─────────────────┐  ┌──────────────────┐  │
│  │ │ 🛠 自助做（免费）│  │ 📦 委托 Readii   │  │
│  │ │ 下载 Ecctis 指引 │  │ ★ £799（会员价）│  │
│  │ └─────────────────┘  └──────────────────┘  │
├──┼──────────────────────────────────────────────┤
│○ │ 阶段 4  公司结构确认               待开始    │
└──┴──────────────────────────────────────────────┘
```

**数据加载逻辑**：

```javascript
// 1. 从 customer_profiles 获取 visa_path 等画像信息
// 2. 从 customer_journey_progress 获取该客户的所有进度记录
//    每条记录含 selected_variant_id（问卷生成时已选定）
// 3. 从 stage_variants 获取变体内容
// 4. 组合：用变体内容替换主阶段内容展示

// 如果某个阶段没有选定变体（无变体阶段），直接用 journey_stages 的内容
```

**状态图标映射**：

```javascript
const STATUS_CONFIG = {
  completed:          { icon: '✓', color: 'bg-green-500',  label: '已完成' },
  in_progress:        { icon: '⟳', color: 'bg-blue-500 animate-pulse', label: '进行中' },
  blocked_on_customer:{ icon: '!', color: 'bg-red-500',    label: '等待你的操作' },
  blocked_on_readii:  { icon: '⏳', color: 'bg-orange-400', label: 'Readii 处理中' },
  pending:            { icon: '○', color: 'bg-gray-300',   label: '待开始' },
  skipped:            { icon: '—', color: 'bg-gray-200',   label: '已跳过' },
};
```

**自助/委托选择按钮**：
- 仅对 `has_sku = true` 的阶段显示
- 已选"自助"：展开 `sku_self_serve_content`，按钮显示绿色选中态
- 已选"委托"：v1 阶段显示"已提交委托，Readii 团队会联系你"的确认提示
- 选择保存到 `customer_journey_progress.service_mode`

**HR 合规子模块入口**（阶段 10）：

```jsx
{stage.has_sub_module && stage.sub_module_type === 'hr_compliance' && (
  <Link
    to="/customer/hr-compliance"
    className="mt-4 flex items-center gap-2 p-3 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50"
  >
    <span className="text-2xl">📋</span>
    <div>
      <div className="font-medium">进入 HR 合规子模块（22 项）</div>
      <div className="text-sm text-gray-500">
        已完成：[X]/22 项 · 点击查看详情
      </div>
    </div>
    <span className="ml-auto">→</span>
  </Link>
)}
```

### 3. 数据录入操作说明（给苏晓宇的指引文档）

在 `docs/tasks/content_entry_guide.md` 创建一个录入指引，告诉苏晓宇：

1. 登录 Admin 后台 → `/admin/journey-templates`
2. 点击"自雇工签全案" → 看到 24 个阶段
3. 按顺序进入每个阶段编辑：
   - **Tab 2（三段式内容）** 是最重要的，从 `readii_sw_journey_content_v1.md` 复制对应内容
   - **Tab 3（SKU 设置）** 按定价 Excel 里的价格填入
4. 有变体的阶段（2/4/6/9/23）在 **Tab 4（变体管理）** 中录入每个变体的内容
5. 全部录入完成后，在测试客户账号下触发问卷生成，验证 Journey 显示正确

**预计录入时间**：约 3-4 小时（24 个阶段 + 17 个变体）。

## 验收标准

- [ ] Admin 能查看 24 个阶段列表，颜色标注内容完整度
- [ ] Admin 能编辑每个阶段的三段式内容，保存成功
- [ ] Admin 能管理 5 个有变体阶段（2/4/6/9/23）的变体内容
- [ ] 苏晓宇录入完所有内容后，测试客户的 Journey 显示正确（内容来自 DB 而非前端硬编码）
- [ ] 客户在 `/customer/journey` 看到纵向时间线，点击阶段展开三段式内容
- [ ] 展开后显示的是正确的**变体内容**（Ecctis 客户看到 2C 变体，UK 学历看到 2A 变体）
- [ ] `has_sku=true` 的阶段显示自助/委托两个按钮
- [ ] 选择"自助"后展开自助内容，选择"委托"后显示联系提示
- [ ] 阶段 10 显示 HR 合规子模块入口按钮

## 不要做的事

- ❌ 不要把阶段内容写死在前端组件里
- ❌ 不要实现 Stripe 支付（委托按钮 v1 只显示联系提示）
- ❌ 不要实现阶段排序（stage_number 固定）
- ❌ 不要在这个任务里实现 HR 合规 22 项的具体功能（任务 04a）
- ❌ 不要实现报告生成（任务 04b）

## 完成后的 commit message

```
feat(journey): implement variant system and stage content management

- Add stage_variants table and stage SKU/variant fields
- Add admin UI for managing 24 stages and 17 variants (4 Tabs per stage)
- Implement customer journey timeline with expandable cards and variant content
- Add self-serve/delegate selection with service_mode persistence
- Add HR compliance sub-module entry button in Stage 10
```

## 完成后更新 PROGRESS.md

```markdown
## 任务 04：Journey 变体系统 ✅
- 完成日期：[填入]
- 阶段内容录入：[X]/24 个阶段已录入内容
- 变体录入：[X]/17
- 备注：[备注]
```
