# 任务 04a：HR 合规子模块（22 项）

## 目标

实现 Journey 阶段 10 的子模块：英国雇主 HR 合规审计（22 项），包含：
1. 22 项合规清单的展示和进度追踪
2. 每项的证明文件上传
3. Phase sign-off 功能
4. 完成后生成可下载的《HR 合规审计报告》PDF

## 前置条件

- 任务 01 已完成（`hr_compliance_items` 和 `customer_hr_compliance` 表已部署）
- 任务 04 已完成（Journey 视图中阶段 10 有入口按钮）

## 上下文

参考文件：`docs/journey_content/readii_sw_journey_content_batch2.md` → 第一部分（HR 合规子模块详细规范）

重点关注：
- 22 项的分类（Phase 1-4）
- 每项的合规依据、操作步骤、证明文件要求
- Phase sign-off 节点（3.1 和 4.1）
- 报告格式（见 batch2 文档末尾的报告模板）

## 数据库：初始数据录入

```sql
-- 录入 22 项合规定义（静态数据）
-- 参考 batch2 文档的完整内容，这里仅展示格式

INSERT INTO hr_compliance_items (item_code, phase_number, item_number, title, description, compliance_basis, evidence_type, is_mandatory) VALUES
('1_1', 1, '1.1', '雇佣合同签署并留档',
 '双方签字，明确薪资（≥£41,700/年）、职责、工作时间。职位描述须与 CoS 申请完全一致。',
 'Employment Rights Act 1996 s.1',
 '双方签字的雇佣合同 PDF',
 true),
('1_2', 1, '1.2', 'Right to Work 核查完成并留档',
 '入职前核查 Graduate Visa 原件，拍照留存，记录核查日期和核查人。',
 'Immigration Act 2014',
 'RTW 核查记录表 + 护照/签证彩色照片',
 true),
-- ... 继续录入所有 22 项（Code 参照 batch2 文档录入完整内容）
('4_8', 4, '4.8', 'Training 记录',
 '员工培训记录，含安全、合规、职能培训，每次须有签到和完成确认。',
 '雇主最佳实践',
 '培训记录表（含签到/完成确认）',
 true);
```

**注意**：所有 22 条数据必须从 `batch2.md` 文档逐条录入，Code 自行读取文档完成。

## 具体任务

### 1. 客户端 HR 合规页面

**路由**：`/customer/hr-compliance`
**文件**：`src/pages/customer/HRCompliance.jsx`

**页面结构**：

```
HR 合规审计（22 项）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

进度：[====------] 8/22 已完成

[生成报告（需全部完成）]  [下载 PDF]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▼ Phase 1：现有员工合规审计（8项）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ 1.1 雇佣合同签署并留档               [已完成] [查看文件]
⟳ 1.2 Right to Work 核查              [进行中]
○ 1.3 P45/P46 存档                    [待完成] [上传文件] [查看说明]
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▼ Phase 2：雇佣合同和政策文件（4项）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[锁定，需 Phase 1 全部完成后解锁]
```

**每项的展开视图**（点击项目名称展开）：

```
1.1 雇佣合同签署并留档
━━━━━━━━━━━━━━━━━━━
合规依据：Employment Rights Act 1996 s.1

说明：
[完整的操作说明，来自 batch2 文档]

需要上传的证明文件：
双方签字的雇佣合同 PDF

━━━━━━━━━━━━━━━━━━━
[上传文件]  [标记为已完成]
已上传文件：contract_signed_20260420.pdf  [预览] [删除]
```

**Phase 锁定逻辑**：
- Phase 1（8 项）：默认开放
- Phase 2（4 项）：Phase 1 全部完成后解锁
- Phase 3（6 项）：Phase 2 全部完成后解锁（特别是 3.1 sign-off）
- Phase 4（8 项）：Phase 3 全部完成后解锁（特别是 4.1 sign-off）

**3.1 和 4.1（Phase Sign-Off）的特殊处理**：
- 这两项不需要客户上传文件，而是由 Readii 内部签字确认
- 客户端显示"等待 Readii 合规团队确认"
- Admin 端有"Phase X Sign Off"按钮，点击后标记为 completed

### 2. Admin 端 HR 合规管理

**路由**：`/admin/customers/:customerId/hr-compliance`

Admin 端显示所有 22 项的状态，额外功能：
- Phase 1 Sign-Off 按钮（Admin 确认所有 Phase 1 完成）
- Phase 2 Sign-Off 按钮
- 查看客户上传的每份证明文件
- 可以手动修改某项的状态（如标记为"waived"）

### 3. 文件上传

每项合规证明文件上传到 Supabase Storage：
- Bucket：`hr-compliance-docs`
- 路径格式：`{customerId}/{item_code}/{filename}`
- 上传后 URL 保存到 `customer_hr_compliance.evidence_url`

文件上传组件复用任务 06（文档中心）的实现，不需要重新写。

### 4. HR 合规审计报告生成

**触发条件**：22 项全部 status = 'completed'

**Netlify Function**：`netlify/functions/generate-hr-report.js`

```javascript
export async function handler(event) {
  const { customerId } = JSON.parse(event.body);

  // 1. 验证 22 项全部完成
  const items = await supabase
    .from('customer_hr_compliance')
    .select('*, hr_compliance_items(*)')
    .eq('customer_id', customerId);

  const allCompleted = items.data.every(i => i.status === 'completed');
  if (!allCompleted) {
    return { statusCode: 400, body: JSON.stringify({ error: '22 项未全部完成' }) };
  }

  // 2. 获取客户信息
  const customer = await getCustomerInfo(customerId);

  // 3. 生成 PDF
  // 使用 puppeteer 或 @sparticuz/chromium（Netlify Functions 可用）
  // 或者使用 jsPDF 库生成
  // 报告内容来自 batch2 文档中的报告模板
  const pdfBuffer = await generateHRReportPDF(customer, items.data);

  // 4. 上传到 Supabase Storage
  const filePath = `reports/${customerId}/hr_compliance_${Date.now()}.pdf`;
  await supabase.storage.from('reports').upload(filePath, pdfBuffer);

  // 5. 记录到 generated_reports 表
  await supabase.from('generated_reports').insert({
    customer_id: customerId,
    report_type: 'hr_compliance_audit',
    file_url: filePath,
    file_name: `HR合规审计报告_${new Date().toLocaleDateString('zh-CN')}.pdf`,
    is_latest: true,
  });

  return { statusCode: 200, body: JSON.stringify({ success: true, filePath }) };
}
```

**PDF 内容**：按照 batch2 文档中的报告模板格式，包含：
- Readii Logo + 客户公司名称 + CRN
- 生成日期
- 合规总览（22/22 完成）
- 按 Phase 列出详细清单（含完成日期、负责人）
- Readii 合规顾问签字行（v1 为文字占位，非电子签名）
- 免责声明

**报告 PDF 技术方案**（推荐）：

```javascript
// 使用 html-pdf-node 或 puppeteer
// 先生成 HTML，再转 PDF

const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #1B2A4A; }
    .completed { color: green; }
    .logo { color: #C9A84C; font-weight: bold; font-size: 24px; }
  </style>
</head>
<body>
  <div class="logo">Readii</div>
  <h1>HR 合规审计报告</h1>
  <p>公司名称：${customer.company_name}</p>
  ...
</body>
</html>
`;
```

### 5. 报告下载入口

在 HR 合规页面顶部，22 项全部完成后显示：

```jsx
{allCompleted && (
  <button
    onClick={handleGenerateReport}
    className="px-6 py-3 bg-navy text-white rounded-lg font-semibold"
  >
    生成 HR 合规审计报告（PDF）
  </button>
)}

{latestReport && (
  <a href={latestReport.download_url} download>
    下载最新报告（{latestReport.generated_at}）
  </a>
)}
```

## 验收标准

- [ ] 22 项全部录入 `hr_compliance_items` 表（从 batch2 文档录入）
- [ ] 客户登录后能从阶段 10 进入 HR 合规页面
- [ ] 22 项按 Phase 1-4 分组展示，状态正确
- [ ] Phase 锁定逻辑正确（Phase 1 完成后才解锁 Phase 2）
- [ ] 每项可以展开查看详细说明和操作步骤
- [ ] 每项可以上传证明文件（文件上传到 Storage，URL 记录到 DB）
- [ ] 3.1 和 4.1（Sign-Off）由 Admin 端确认，客户端显示"等待确认"
- [ ] 22 项全部完成后，"生成报告"按钮激活
- [ ] 点击生成报告，PDF 生成成功，可下载
- [ ] PDF 内容包含：客户公司名称、22 项清单、完成日期、Readii 签字行

## 不要做的事

- ❌ 不要让客户自己编辑 HR 合规项目的定义（只有 Admin 能添加/修改项目定义）
- ❌ 不要在 Phase 未解锁时允许提交下一 Phase 的文件
- ❌ 不要用截图替代 PDF 报告
- ❌ 不要在一个 Netlify Function 里同时处理所有 7 种报告（每种报告一个 Function）

## 完成后的 commit message

```
feat(hr-compliance): implement HR compliance sub-module with 22-item checklist

- Seed 22 HR compliance items in hr_compliance_items table
- Add customer HR compliance page with Phase 1-4 grouped checklist
- Add file upload per compliance item
- Add Phase sign-off functionality for admin
- Implement HR compliance audit report PDF generation
- Add report download in customer portal
```

## 完成后更新 PROGRESS.md

```markdown
## 任务 04a：HR 合规子模块 ✅
- 完成日期：[填入]
- 22 项已录入：[Y/N]
- PDF 生成测试：[Y/N]
- 备注：[备注]
```
