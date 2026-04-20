# 任务 01：数据库 Schema 部署

## 目标

把 Readii v1 产品手册第 1 节中的所有数据库 Schema 部署到 Supabase 项目 `pgjqfcirfpoitybgmuka`。这是 v1 的第一个任务，所有后续任务都依赖这个 Schema。

## 上下文

完整 SQL 在 `docs/v1_product_manual.md` 的第 1 节（1.1-1.6）。这次新建的表有 17 个：

**客户工作台相关（6 个表）**：
- `customer_profiles`（客户档案）
- `journey_templates`（服务路径模板）
- `journey_stages`（路径阶段定义）
- `customer_journey_progress`（客户的进度）
- `customer_documents`（文档中心）
- `customer_qa`（问答沉淀）
- `customer_meetings`（会议安排）

**渠道系统相关（6 个表）**：
- `partner_profiles`（渠道档案，如果现有 partners 表不够则新建）
- `marketing_assets`（营销素材库）
- `partner_leads`（线索）
- `lead_conversations`（聊天记录+AI话术）
- `faq_knowledge`（FAQ 知识库）
- `partner_commissions`（佣金记录）

**咨询师平台相关（5 个表）**：
- `consultant_profiles`（咨询师档案）
- `consultation_categories`（咨询类目）
- `consultant_categories`（咨询师-类目关联）
- `consultant_availability`（可预约时段）
- `consultation_bookings`（预约订单）
- `consultation_reviews`（评价）

外加对现有 `profiles` 表的字段扩展（role_customer, role_partner, role_consultant, role_admin 等）。

## 具体任务

### 1. 准备工作

1. `cd C:\Users\sergi\Downloads\Saas project` 进入项目目录
2. 检查现有 Supabase migrations 目录结构（通常是 `supabase/migrations/`）
3. 查看现有 `profiles` 表的字段（避免重复添加）
4. 查看现有是否已有 `partners` 表、`leads` 表、`deals` 表等，避免冲突

### 2. 创建迁移文件

在 `supabase/migrations/` 目录创建新文件：

```
20260421000001_v1_profiles_extension.sql
20260421000002_v1_customer_workspace.sql
20260421000003_v1_partner_system.sql
20260421000004_v1_consultant_marketplace.sql
20260421000005_v1_rls_policies.sql
20260421000006_v1_helper_functions.sql
```

分成 6 个文件的理由：每个文件聚焦一块功能，如果某一部分出错，其他部分可以独立回滚。

### 3. 每个迁移文件的内容

**20260421000001_v1_profiles_extension.sql**：

从 `v1_product_manual.md` 第 1.1 节复制 ALTER TABLE profiles 的所有语句。使用 `IF NOT EXISTS` 保护。

**20260421000002_v1_customer_workspace.sql**：

从第 1.2 节复制 customer_profiles、journey_templates、journey_stages、customer_journey_progress、customer_documents、customer_qa、customer_meetings 的 CREATE TABLE 和 INDEX 语句。所有 CREATE 语句用 `IF NOT EXISTS`。

**20260421000003_v1_partner_system.sql**：

从第 1.3 节复制 partner_profiles、marketing_assets、partner_leads、lead_conversations、faq_knowledge、partner_commissions 的 CREATE TABLE 和 INDEX。

**注意**：如果现有 `partners` 表存在且字段兼容，**不要重新创建** `partner_profiles`，而是 ALTER 现有表。先 SELECT `pg_tables` 检查。

**20260421000004_v1_consultant_marketplace.sql**：

从第 1.4 节复制所有 consultant_* 相关表和 consultation_* 相关表。包含 `consultation_categories` 的初始数据 INSERT。

**20260421000005_v1_rls_policies.sql**：

从第 1.5 节复制所有 RLS 策略。先 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`，然后 `CREATE POLICY`。

**20260421000006_v1_helper_functions.sql**：

从第 1.6 节复制所有辅助函数：
- `generate_booking_number()`
- `generate_referral_code(name TEXT)`
- `update_consultant_stats()`

以及相关的 TRIGGER：`tr_update_consultant_stats`。

### 4. 部署到 Supabase

1. 使用 `supabase db push` 部署所有新迁移
2. 如果使用 Supabase Dashboard，可以在 SQL Editor 逐个执行迁移文件内容
3. 验证部署成功：在 Supabase Dashboard 的 Database → Tables 中看到所有新表

### 5. 基础测试

创建一个临时 SQL 文件 `docs/tasks/test_task_01.sql` 做快速验证：

```sql
-- 验证表创建
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'customer_profiles', 'journey_templates', 'journey_stages',
    'partner_profiles', 'marketing_assets', 'consultant_profiles',
    'consultation_bookings'
  );

-- 验证 RLS 启用
SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('customer_profiles', 'customer_qa', 'partner_leads');

-- 验证 consultation_categories 初始数据
SELECT * FROM consultation_categories ORDER BY sort_order;

-- 验证函数
SELECT generate_referral_code('TestName');
SELECT generate_booking_number();
```

如果这些查询都能正确返回，部署成功。

## 验收标准

- [ ] 6 个迁移文件都在 `supabase/migrations/` 目录
- [ ] Supabase Dashboard 能看到所有 17 个新表
- [ ] 所有新表的 RLS 已启用（`rowsecurity = true`）
- [ ] `consultation_categories` 表有 4 条初始数据
- [ ] `generate_referral_code` 和 `generate_booking_number` 函数可调用
- [ ] 现有销售看板功能不受影响（运行一次现有登录测试）

## 不要做的事

- ❌ 不要创建除了 consultation_categories 之外的任何初始数据
- ❌ 不要改动现有的 `leads`、`deals`、`proposals` 表结构
- ❌ 不要部署任何 Edge Functions（下个任务做）
- ❌ 不要创建 Storage bucket（后续任务做）
- ❌ 不要写任何 API 代码

## 可能遇到的问题和对策

**问题 1**：现有 `partners` 表结构不兼容
- 对策：新建 `partner_profiles` 作为扩展表，通过 user_id 关联

**问题 2**：RLS 策略阻止 admin 操作
- 对策：所有 admin policy 使用 `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)`

**问题 3**：Supabase 免费计划的限制
- 对策：检查当前数据库大小，v1 新 schema 预计增加 < 5MB

## 完成后的 commit message

```
feat(db): deploy v1 schema for customer workspace, partner system, and consultant marketplace

- Add customer journey tables (7)
- Add partner referral system tables (6)
- Add consultant marketplace tables (5)
- Extend profiles with multi-role flags
- Enable RLS on all new tables
- Add helper functions for booking numbers and referral codes

Migration files: 20260421000001 to 20260421000006
```

## 完成后更新 PROGRESS.md

在项目根目录的 `PROGRESS.md` 文件里（如果没有请创建）：

```markdown
## 任务 1：数据库 Schema 部署 ✅
- 完成日期：[填入完成日期]
- 新增表数量：17
- 迁移文件：6
- 备注：[如果遇到什么特殊情况]
```
