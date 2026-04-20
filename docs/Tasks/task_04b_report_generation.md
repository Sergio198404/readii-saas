# 任务 04b：报告生成引擎（7 种报告）

## 目标

实现 Readii 工作台的全部 7 种可下载 PDF 报告：

| # | 报告类型 | 触发条件 | 受众 |
|---|---|---|---|
| 1 | Journey 进度报告 | 随时可生成 | 客户 + 内部 |
| 2 | HR 合规审计报告 | 22项全部完成 | 客户 + 内部 |
| 3 | Appendix A 就绪报告 | 全部文件核验 | 内部（律师用）|
| 4 | Key Personnel 审核报告 | 全部核查通过 | 内部 |
| 5 | AO 面试准备度报告 | 3次模拟后手动 | 内部 |
| 6 | 工签申请人面试准备度报告 | 2次模拟后手动 | 内部 |
| 7 | 月度运营合规报告 | 每月底自动 | 运营陪跑客户 |

> 注意：报告 2（HR 合规审计）在任务 04a 中已实现。这个任务实现剩余 6 种。

## 前置条件

- 任务 01（`generated_reports` 表已部署）
- 任务 04a（HR 合规模块已完成，报告 2 已有参考实现）
- 相关数据已存在（报告 3 需要 Appendix A 数据，报告 7 需要运营数据）

## 上下文

参考文件：`docs/journey_content/readii_sw_journey_content_batch3.md` → 第三部分（7 种报告模板）

每种报告的具体字段和格式在 batch3 文档中都有完整模板。

## 技术架构

### 公共 HTML → PDF 转换工具

**文件**：`netlify/functions/utils/pdfGenerator.js`

所有 7 种报告共用同一个 HTML→PDF 转换工具：

```javascript
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function generatePDF(htmlContent) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });

  await browser.close();
  return pdf;
}
```

**安装依赖**：
```bash
npm install puppeteer-core @sparticuz/chromium
```

**公共报告 HTML 模板头**：

```javascript
export function reportHeader(title, subtitle, date) {
  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap');
      body { font-family: 'Noto Sans SC', Arial, sans-serif; color: #1B2A4A; margin: 0; }
      .header { background: #1B2A4A; color: white; padding: 24px 32px; }
      .logo { color: #C9A84C; font-size: 28px; font-weight: bold; }
      .report-title { font-size: 20px; margin-top: 8px; }
      .subtitle { font-size: 13px; color: #aaa; margin-top: 4px; }
      .content { padding: 32px; }
      .section-title { color: #1B2A4A; font-size: 16px; font-weight: bold;
                       border-bottom: 2px solid #C9A84C; padding-bottom: 6px; margin-top: 24px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1B2A4A; color: white; padding: 8px; text-align: left; }
      td { border-bottom: 1px solid #eee; padding: 8px; }
      .badge-green { color: #27AE60; font-weight: bold; }
      .badge-red { color: #E74C3C; }
      .footer { background: #F5F6FA; padding: 16px 32px; font-size: 11px; color: #888;
               border-top: 1px solid #ddd; margin-top: 32px; }
      .stamp-area { border: 1px solid #ddd; height: 60px; margin-top: 8px;
                   display: flex; align-items: center; padding: 8px; color: #999; font-size: 12px; }
    </style>
    <div class="header">
      <div class="logo">Readii</div>
      <div class="report-title">${title}</div>
      <div class="subtitle">${subtitle} · 生成日期：${date}</div>
    </div>
    <div class="content">
  `;
}

export function reportFooter() {
  return `
    </div>
    <div class="footer">
      本报告由 Readii 工作台自动生成 · Readii Limited, Canterbury, UK · readii.co.uk<br>
      免责声明：本报告基于系统记录的信息，仅供内部参考，不构成法律建议。如有任何法律问题，请咨询专业律师。
    </div>
  `;
}
```

### 公共存储和记录逻辑

**文件**：`netlify/functions/utils/reportUtils.js`

```javascript
import { createClient } from '@supabase/supabase-js';

export async function saveReport(customerId, reportType, pdfBuffer, metadata = {}) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const timestamp = Date.now();
  const fileName = `${reportType}_${timestamp}.pdf`;
  const filePath = `reports/${customerId}/${fileName}`;

  // 上传 PDF
  const { error: uploadError } = await supabase.storage
    .from('reports')
    .upload(filePath, pdfBuffer, { contentType: 'application/pdf' });

  if (uploadError) throw uploadError;

  // 将之前的同类型报告标记为非最新
  await supabase
    .from('generated_reports')
    .update({ is_latest: false })
    .eq('customer_id', customerId)
    .eq('report_type', reportType);

  // 记录新报告
  const { data, error } = await supabase
    .from('generated_reports')
    .insert({
      customer_id: customerId,
      report_type: reportType,
      file_url: filePath,
      file_name: getReportFileName(reportType),
      is_latest: true,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;

  // 获取签名下载 URL（有效期 1 小时）
  const { data: urlData } = await supabase.storage
    .from('reports')
    .createSignedUrl(filePath, 3600);

  return { reportId: data.id, downloadUrl: urlData.signedUrl };
}

function getReportFileName(reportType) {
  const names = {
    journey_progress: 'Journey进度报告',
    hr_compliance_audit: 'HR合规审计报告',
    appendix_a_ready: 'AppendixA材料就绪报告',
    key_personnel_review: 'KeyPersonnel资质审核报告',
    ao_interview_readiness: 'AO面试准备度报告',
    applicant_interview_readiness: '工签申请人面试准备度报告',
    monthly_operations: '月度运营合规报告',
  };
  const date = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  return `${names[reportType] || reportType}_${date}.pdf`;
}
```

## 各报告实现

### 报告 1：Journey 进度报告

**Function**：`netlify/functions/generate-journey-report.js`
**触发**：任意时间，手动触发（客户或内部均可）
**数据来源**：`customer_journey_progress` + `journey_stages` + `customer_profiles`

HTML 结构（参照 batch3 文档报告 1 模板）：
- 整体进度概览（完成百分比、当前阶段）
- 已完成阶段列表（含完成日期）
- 进行中阶段（含下一步行动）
- 待开始阶段列表
- 关键时间窗口（英语成绩、TB 体检等）
- 待处理事项（客户操作项）

### 报告 3：Appendix A 材料就绪报告

**Function**：`netlify/functions/generate-appendix-report.js`
**触发**：`customer_appendix_a` 所有 mandatory 项目 status='verified'，Admin 手动触发
**数据来源**：`customer_appendix_a` + `customer_profiles`

HTML 结构（参照 batch3 文档报告 3 模板）：
- 核验结论（全部就绪 ✓）
- 按分类（A 到 J）列出每份文件及状态
- 关键文件时效性确认（有效期日期）
- Readii 合规顾问确认签字区域

**注意**：此报告只对 Staff/Admin 开放，客户不能生成。

### 报告 4：Key Personnel 资质审核报告

**Function**：`netlify/functions/generate-kp-report.js`
**触发**：`key_personnel_reviews.review_status='passed'`，Admin 手动触发
**数据来源**：`key_personnel_reviews` + `customer_profiles`

HTML 结构（参照 batch3 文档报告 4 / batch2 文档中的 Key Personnel 报告模板）

### 报告 5：AO 面试准备度报告

**Function**：`netlify/functions/generate-ao-report.js`
**触发**：Staff 手动触发（3 次模拟面试后）
**数据来源**：手动输入的评分数据（需要一个评分录入界面）

**额外需要**：Admin 端的"AO 面试评分录入界面"

路由：`/admin/customers/:customerId/ao-interview-score`

表单字段：
- 模拟面试日期 1/2/3（日期选择器）
- 每次 5 个维度的评分（数字输入，1-100）
- 主要薄弱点（文本，可选）
- 最终结论（通过/不通过）

录入完成后点击"生成报告"。

### 报告 6：工签申请人面试准备度报告

与报告 5 类似，但是 2 次模拟面试，5 个不同的评分维度。

**额外需要**：Admin 端的"申请人面试评分录入界面"
路由：`/admin/customers/:customerId/applicant-interview-score`

### 报告 7：月度运营合规报告

**Function**：`netlify/functions/generate-monthly-report.js`
**触发**：每月月底自动（Netlify Scheduled Functions） + 手动触发
**条件**：仅对 `needs_mentoring=true` 且阶段 12 进行中的客户自动生成

**Netlify 定时任务配置**（`netlify.toml`）：

```toml
[functions."generate-monthly-report"]
  schedule = "0 18 28-31 * *"
  # 每月 28-31 日 18:00 UTC 运行，函数内部判断是否是当月最后一天
```

**数据来源**：
- 营业额数据：从 `customer_documents`（银行对账单）读取，或手动录入
- 合规状态：从 `customer_journey_progress` 读取
- 月度工作摘要：从 `customer_meetings`（当月会议记录）读取

**注意**：v1 阶段，营业额数字需要 Admin/Staff 手动录入到一个"月度运营数据"字段中。不做自动解析银行对账单（那是 v2-v3 的功能）。

**新增字段**（`customer_profiles`）：
```sql
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS monthly_operations_data JSONB DEFAULT '[]'::jsonb;
  -- 格式：[{ month: '2026-04', revenue: 35000, bank_balance: 85000, notes: '...' }]
```

## 前端报告下载中心

**路由**：`/customer/reports`
**文件**：`src/pages/customer/ReportsCenter.jsx`

展示客户可以下载的所有报告：

```
我的报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Journey 进度报告
上次生成：2026-05-20
[下载 PDF]  [重新生成]

HR 合规审计报告
上次生成：2026-05-18（22/22 项完成时自动生成）
[下载 PDF]

月度运营合规报告（2026年4月）
[下载 PDF]
月度运营合规报告（2026年5月）
[下载 PDF]
```

**Admin 端报告中心**（`/admin/customers/:customerId/reports`）：

显示所有 7 种报告，包括客户端看不到的报告（3/4/5/6）：

```
[生成 Journey 进度报告]
[查看 HR 合规审计报告]
[生成 Appendix A 就绪报告] ← 仅当条件满足时激活
[生成 Key Personnel 审核报告] ← 仅当条件满足时激活
[录入 AO 面试评分] → [生成报告]
[录入申请人面试评分] → [生成报告]
[月度运营报告归档]
```

## 验收标准

- [ ] 报告 1：客户点击"生成进度报告"，2 分钟内返回可下载的 PDF
- [ ] 报告 2：HR 合规 22 项全部完成后，PDF 自动生成（任务 04a 已实现）
- [ ] 报告 3：Admin 在所有 Appendix A 文件核验后，能生成 PDF
- [ ] 报告 4：Admin 在 Key Personnel 全部通过后，能生成 PDF
- [ ] 报告 5：Admin 录入 3 次 AO 模拟面试评分后，能生成评估报告 PDF
- [ ] 报告 6：Admin 录入 2 次申请人模拟面试评分后，能生成评估报告 PDF
- [ ] 报告 7：每月底自动为运营陪跑客户生成，Admin 可手动触发
- [ ] 所有报告 PDF 包含：Readii Logo、客户公司名、生成日期、免责声明
- [ ] 所有报告下载链接有效（Supabase Storage 签名 URL，1 小时有效）
- [ ] 同类型报告只保留最新版本为 is_latest=true
- [ ] `customer/reports` 页面列出所有已生成报告并提供下载

## 不要做的事

- ❌ 不要在一个 Function 里处理所有 7 种报告（每种一个 Function）
- ❌ 不要用浏览器截图替代服务端 PDF 生成
- ❌ 不要让客户访问报告 3/4/5/6（这些是内部报告）
- ❌ 不要自动解析银行对账单（v1 月度数据手动录入）

## 完成后的 commit message

```
feat(reports): implement 7-type report generation engine

- Add shared PDF generation utility with branded HTML template
- Add shared report save/storage utility
- Implement reports 1,3,4,5,6,7 (report 2 done in task 04a)
- Add AO and applicant interview score entry forms for admin
- Add monthly operations data field and scheduled monthly report
- Add customer report download center (/customer/reports)
- Add admin report management per customer (/admin/customers/:id/reports)
```

## 完成后更新 PROGRESS.md

```markdown
## 任务 04b：报告生成引擎 ✅
- 完成日期：[填入]
- 7种报告全部实现：[Y/N]
- PDF 生成测试（每种各测一次）：[Y/N]
- 定时任务配置：[Y/N]
- 备注：[备注]
```
