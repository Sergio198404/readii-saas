# Readii v1 产品手册
## 付费客户工作台 + 渠道推广工具 + 过来人付费咨询撮合

**版本**：v1.0
**工期**：30 天
**目标读者**：Code（开发团队）
**技术栈**：沿用现有 Readii 销售看板（Vite + React + Supabase + Netlify Functions + Anthropic API + Stripe + EmailJS）
**部署**：同一项目扩展，无新仓库

---

## 0. v1 总览

### 0.1 v1 要解决的真实问题

基于苏晓宇当前业务状态：
- 正在服务 **2 个付费客户**（1 个自雇工签本月初签约+1 个创新签陪跑一年多已停滞）
- 即将有 **A 型渠道**（想来英国的潜在创业者同时是自己的客户+推广者）
- 有 **几十个 B 型渠道候选人**（已在英国的过来人，愿意提供付费咨询）
- 创始人 100% 生物能交付，迫切需要减少沟通摩擦并开辟小现金流

v1 聚焦三个非常具体的痛点：

**痛点 1**：付费客户不知道自己下一步该做什么，感知不到服务价值，创始人被反复询问进度、被动约会议、做翻译传话
**痛点 2**：即将上线的 A 型渠道没有统一的推广工具和销售话术，每个人都要苏晓宇手把手带
**痛点 3**：中国客户不为"咨询"付费，但愿意为"过来人一手经验"付费，需要一个轻量撮合平台

### 0.2 v1 不做的事情

- 不做面向新客户的订阅会员（£79/月 会员平台是 v2 之后的事）
- 不做自雇/创新/拓展工签的自助向导（这是 v2 重点）
- 不做完整的供应商平台（v3）
- 不做 AI 完全自动化的内容生成（v1 只做半自动+模板）
- 不做复杂的合规基础设施（IAA/SRA 合作协议等）

**v1 是一个三边 MVP：客户端 + A 渠道端 + B 咨询师端 + Admin**。用最少的代码让苏晓宇的当前业务跑得更顺，为 v2 积累真实数据和用户反馈。

### 0.3 v1 四端角色矩阵

| 端 | 用户角色 | 首批规模 | 核心动作 |
|---|---|---|---|
| Customer | 付费客户 | 2-5 人 | 查看服务进度、下载文档、问答沉淀 |
| Partner（A 型） | 推广渠道 | 5-10 人 | 拿推广码、生成话术、查看佣金 |
| Consultant（B 型） | 过来人咨询师 | 5-8 人 | 接预约、做咨询、收款 |
| Admin | 苏晓宇 | 1 人 | 全局管理、佣金结算、问答审核 |

### 0.4 v1 预期产出

- 客户工作台：**2 个现有客户 100% 上线使用**，苏晓宇被问"我现在到哪一步"的频率减少 70%
- A 型渠道：**5-10 个渠道开通账号**，第一批推广话术和线索提交跑通
- B 型咨询师：**5-8 个过来人上线**，月成交 **8-15 单咨询**（£199/次起），月 GMV £1,500-3,000，Readii 抽成 £300-600

### 0.5 30 天时间线

| 周 | 重点 | 交付物 |
|---|---|---|
| Week 1 | 数据库 schema + 角色权限 + 客户工作台骨架 | Schema 部署、客户端可登录 |
| Week 2 | 客户工作台完整功能 + A 渠道基础后台 | 2 个客户可用、渠道账号开通 |
| Week 3 | 推广工具包 + 话术生成 + 销售材料库 | A 渠道全套工具可用 |
| Week 4 | B 咨询师入驻 + 预约 + 支付 + 上线 | 三端全部跑通、收到第一单咨询付费 |

---

## 1. 数据库 Schema（Supabase PostgreSQL）

### 1.1 角色和权限扩展

在现有 `profiles` 表上扩展（不新建）：

```sql
-- 扩展现有 profiles 表
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_customer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_partner BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_consultant BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'zh-CN',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Shanghai',
  ADD COLUMN IF NOT EXISTS wechat_id TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 一个人可以同时有多个角色（苏晓宇本人会同时是 admin + consultant）
-- 登录后通过切换器选择当前身份
```

### 1.2 Block 1：付费客户工作台

```sql
-- 客户档案（一对一扩展 profiles）
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN (
    'sw_self_sponsored', 'innovator_founder', 'expansion_worker', 'general_consulting'
  )),
  signed_date DATE NOT NULL,
  total_contract_value_pence INT,
  paid_amount_pence INT DEFAULT 0,
  current_stage_id UUID, -- 引用下面的 journey_stages
  expected_completion_date DATE,
  primary_consultant_id UUID REFERENCES profiles(id), -- 通常是苏晓宇
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_profiles_user ON customer_profiles(user_id);
CREATE INDEX idx_customer_profiles_status ON customer_profiles(status);

-- 服务路径阶段（每种服务类型有自己的 journey）
-- 这是 v1 的核心设计——客户看到的"我在哪一步"
CREATE TABLE IF NOT EXISTS journey_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  name TEXT NOT NULL,
  total_stages INT NOT NULL,
  estimated_weeks INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journey_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES journey_templates(id) ON DELETE CASCADE,
  stage_number INT NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  description_why TEXT NOT NULL, -- "为什么这一步重要"
  description_customer_action TEXT NOT NULL, -- "你需要做什么"
  description_readii_action TEXT NOT NULL, -- "Readii 在做什么"
  estimated_duration_days INT,
  deliverables TEXT[], -- 本阶段交付物清单
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, stage_number)
);

-- 客户的实际进度
CREATE TABLE IF NOT EXISTS customer_journey_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES journey_stages(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'blocked_on_customer', 'blocked_on_readii', 'completed', 'skipped'
  )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  blocker_reason TEXT, -- 卡住的原因
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, stage_id)
);

CREATE INDEX idx_cjp_customer ON customer_journey_progress(customer_id);
CREATE INDEX idx_cjp_status ON customer_journey_progress(status);

-- 文档中心
CREATE TABLE IF NOT EXISTS customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES journey_stages(id), -- 关联到哪个阶段
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_url TEXT NOT NULL, -- Supabase Storage URL
  file_name TEXT NOT NULL,
  file_type TEXT, -- 'pdf', 'docx', 'image', 'other'
  file_size_bytes BIGINT,
  category TEXT CHECK (category IN (
    'contract', 'visa_application', 'company_documents', 'financial',
    'identity', 'correspondence', 'review_report', 'other'
  )),
  description TEXT,
  is_visible_to_customer BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cust_docs_customer ON customer_documents(customer_id);
CREATE INDEX idx_cust_docs_stage ON customer_documents(stage_id);

-- 客户问答沉淀（微信沟通产品化的核心）
CREATE TABLE IF NOT EXISTS customer_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES profiles(id),
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES profiles(id),
  answered_at TIMESTAMPTZ,
  related_stage_id UUID REFERENCES journey_stages(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'archived')),
  is_reusable BOOLEAN DEFAULT false, -- 是否可以进入知识库
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_qa_customer ON customer_qa(customer_id);
CREATE INDEX idx_customer_qa_status ON customer_qa(status);

-- 会议安排（解决时差问题）
CREATE TABLE IF NOT EXISTS customer_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  scheduled_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  meeting_link TEXT, -- Zoom/Meet 链接
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  timezone TEXT,
  agenda TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'
  )),
  notes_before TEXT,
  notes_after TEXT,
  related_stage_id UUID REFERENCES journey_stages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meetings_customer ON customer_meetings(customer_id);
CREATE INDEX idx_meetings_scheduled ON customer_meetings(scheduled_at);
```

**journey_templates 初始数据**（需要苏晓宇提供实际内容，以下是结构示例）：

```sql
-- 自雇工签 Journey 模板（约 18-20 个阶段）
INSERT INTO journey_templates (service_type, name, total_stages, estimated_weeks) VALUES
  ('sw_self_sponsored', '自雇工签全流程', 18, 24);

-- 示例阶段（苏晓宇需要根据自己的 SOP 补全全部 18 个）
-- 每个阶段都包含：为什么重要 / 客户做什么 / Readii 做什么
-- 以下为 Code 建表时参考格式
INSERT INTO journey_stages (template_id, stage_number, title, description_why, description_customer_action, description_readii_action, estimated_duration_days) VALUES
  ((SELECT id FROM journey_templates WHERE service_type='sw_self_sponsored'), 1,
   '签约与需求深度沟通',
   '这一步确立你和 Readii 对目标的一致理解，避免后续方向偏差。',
   '完成合同签署、首付款、基础信息表填写',
   '整理你的 case file，分配专属顾问，制定 24 周完整时间表',
   3),
  ((SELECT id FROM journey_templates WHERE service_type='sw_self_sponsored'), 2,
   '英国公司注册',
   '公司是自雇工签的载体，没有公司就没有签证。',
   '确认公司名称、注册地址、持股结构、董事信息',
   '完成 Companies House 注册申请、获得 CRN',
   5);
-- ... 继续补全剩余 16 个阶段
```

### 1.3 Block 2：A 型渠道后台 + 推广工具

```sql
-- 渠道档案（扩展现有 partners 表，如果不存在则创建）
CREATE TABLE IF NOT EXISTS partner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('a_type', 'b_type')),
  -- A 型：想来英国的推广者，可能本身也是客户
  -- B 型：已在英国的咨询师（同时使用 consultant 角色）
  referral_code TEXT UNIQUE NOT NULL, -- 唯一推广码，如 "READII-XIAOYU-2025"
  commission_rate DECIMAL(5,2) DEFAULT 15.00, -- 佣金百分比
  total_referrals INT DEFAULT 0,
  total_commission_earned_pence INT DEFAULT 0,
  bio TEXT, -- 自我介绍
  onboarded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_referral_code ON partner_profiles(referral_code);

-- 推广工具包：内容素材库
CREATE TABLE IF NOT EXISTS marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'moments_post', 'article', 'video_script', 'poster', 'xiaohongshu_post',
    'fee_list', 'material_checklist', 'brochure', 'case_study'
  )),
  topic TEXT NOT NULL, -- 'sw_visa', 'innovator_founder', 'company_setup', 'landing_life'
  title TEXT NOT NULL,
  content TEXT, -- 文字内容
  media_urls TEXT[], -- 配图/视频链接
  download_url TEXT, -- 如果是可下载的文件
  tags TEXT[],
  usage_notes TEXT, -- 使用说明
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assets_type ON marketing_assets(asset_type);
CREATE INDEX idx_assets_topic ON marketing_assets(topic);

-- 渠道的销售线索（从推广码进来的潜在客户）
CREATE TABLE IF NOT EXISTS partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partner_profiles(id),
  lead_name TEXT,
  lead_wechat TEXT,
  lead_phone TEXT,
  lead_email TEXT,
  source TEXT, -- 'moments', 'wechat_group', 'direct_message', 'article'
  initial_message TEXT, -- 客户最开始发来的信息
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new', 'qualifying', 'hot', 'warm', 'cold', 'converted', 'lost'
  )),
  estimated_budget TEXT, -- 预算区间
  service_interest TEXT, -- 感兴趣的服务
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  converted_to_customer_id UUID REFERENCES customer_profiles(id),
  locked_until TIMESTAMPTZ, -- 48 小时锁定期，其他渠道不能抢
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_partner ON partner_leads(partner_id);
CREATE INDEX idx_leads_status ON partner_leads(status);

-- 线索聊天记录（用于 AI 生成销售话术）
CREATE TABLE IF NOT EXISTS lead_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES partner_leads(id) ON DELETE CASCADE,
  message_from TEXT CHECK (message_from IN ('lead', 'partner')),
  message_content TEXT NOT NULL,
  message_at TIMESTAMPTZ,
  ai_suggested_reply TEXT, -- AI 生成的回复建议
  ai_generated_at TIMESTAMPTZ,
  partner_actual_reply TEXT, -- 渠道实际发送的（可选录入）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conv_lead ON lead_conversations(lead_id);

-- FAQ 知识库（渠道用来回答常见问题）
CREATE TABLE IF NOT EXISTS faq_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'visa_basics', 'pricing', 'timeline', 'requirements'
  question TEXT NOT NULL,
  answer_short TEXT NOT NULL, -- 一句话版本
  answer_full TEXT, -- 完整版本
  related_service TEXT[], -- 相关服务类型
  sort_order INT DEFAULT 0,
  is_public BOOLEAN DEFAULT true, -- 是否对渠道可见
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_faq_category ON faq_knowledge(category);

-- 佣金记录
CREATE TABLE IF NOT EXISTS partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partner_profiles(id),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'customer_contract', 'consultant_booking', 'addon_service'
  )),
  source_id UUID NOT NULL, -- 对应订单的 ID
  gross_amount_pence INT NOT NULL,
  commission_pence INT NOT NULL,
  commission_rate DECIMAL(5,2),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'paid', 'clawed_back'
  )),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comm_partner ON partner_commissions(partner_id);
CREATE INDEX idx_comm_status ON partner_commissions(status);
```

### 1.4 Block 3：B 型咨询师撮合

```sql
-- 咨询师档案
CREATE TABLE IF NOT EXISTS consultant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL, -- 公开展示名（可以是昵称）
  headline TEXT NOT NULL, -- 一句话介绍，比如 "创新签 2 年持有者，伦敦教培创业者"
  bio TEXT NOT NULL, -- 详细介绍
  avatar_url TEXT,
  uk_city TEXT NOT NULL, -- 所在城市
  years_in_uk INT,
  visa_types_experienced TEXT[], -- ['innovator_founder', 'sw_self_sponsored']
  industries TEXT[], -- ['tech', 'education', 'retail', 'consulting']
  languages TEXT[] DEFAULT ARRAY['zh-CN', 'en-GB'],
  hourly_rate_pence INT DEFAULT 19900, -- £199/小时起
  min_booking_duration_minutes INT DEFAULT 60,
  max_bookings_per_week INT DEFAULT 5,
  stripe_connect_account_id TEXT, -- Stripe Connect 账号，用于收款
  status TEXT DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'active', 'paused', 'suspended'
  )),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  total_bookings INT DEFAULT 0,
  total_revenue_earned_pence INT DEFAULT 0,
  average_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consultant_status ON consultant_profiles(status);
CREATE INDEX idx_consultant_city ON consultant_profiles(uk_city);

-- 咨询类目（结构化标签，方便客户搜索）
CREATE TABLE IF NOT EXISTS consultation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES consultation_categories(id),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 初始类目（苏晓宇确认的优先顺序：签证体验 > 创业经验 > 生活经验）
INSERT INTO consultation_categories (code, name, description, sort_order) VALUES
  ('visa_experience', '签证亲历', '过来人讲自己办签证的真实经历', 1),
  ('entrepreneurship', '创业经验', '在英国创立和运营公司的一手经验', 2),
  ('industry_specific', '行业经验', '特定行业在英国的创业和运营', 3),
  ('local_life', '当地生活', '在特定城市的落地和生活经验', 4);

-- 咨询师和类目的关联
CREATE TABLE IF NOT EXISTS consultant_categories (
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES consultation_categories(id),
  PRIMARY KEY (consultant_id, category_id)
);

-- 咨询师可预约时段
CREATE TABLE IF NOT EXISTS consultant_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT DEFAULT 'Europe/London',
  is_recurring BOOLEAN DEFAULT true,
  specific_date DATE, -- 如果不是 recurring，这里填具体日期
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 咨询预约订单
CREATE TABLE IF NOT EXISTS consultation_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE NOT NULL, -- "RC-20260420-001"
  customer_user_id UUID NOT NULL REFERENCES profiles(id),
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id),
  category_id UUID REFERENCES consultation_categories(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  meeting_link TEXT, -- Zoom/Meet 链接
  customer_questions TEXT, -- 客户预约时填的问题
  consultant_notes TEXT, -- 咨询师咨询前的准备笔记
  price_pence INT NOT NULL,
  readii_fee_pence INT NOT NULL, -- 20% 平台费
  consultant_earnings_pence INT NOT NULL, -- 80% 咨询师收入
  referred_by_partner_id UUID REFERENCES partner_profiles(id), -- 如果来自渠道推荐
  partner_commission_pence INT DEFAULT 0,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'paid', 'refunded', 'failed'
  )),
  booking_status TEXT DEFAULT 'pending_payment' CHECK (booking_status IN (
    'pending_payment', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
  )),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer ON consultation_bookings(customer_user_id);
CREATE INDEX idx_bookings_consultant ON consultation_bookings(consultant_id);
CREATE INDEX idx_bookings_scheduled ON consultation_bookings(scheduled_at);
CREATE INDEX idx_bookings_status ON consultation_bookings(booking_status);

-- 咨询后评价
CREATE TABLE IF NOT EXISTS consultation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES consultation_bookings(id),
  reviewer_user_id UUID NOT NULL REFERENCES profiles(id),
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_consultant ON consultation_reviews(consultant_id);
```

### 1.5 Row Level Security 策略

```sql
-- 客户档案：客户本人可读，admin 可读写
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_own_profile" ON customer_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin_all_customers" ON customer_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- 客户进度：客户本人可读，admin 可读写
ALTER TABLE customer_journey_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_own_progress" ON customer_journey_progress
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "admin_all_progress" ON customer_journey_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- 客户文档：客户本人可读（且 is_visible_to_customer = true），admin 全部
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_own_docs" ON customer_documents
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
    AND is_visible_to_customer = true
  );

CREATE POLICY "admin_all_docs" ON customer_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- 客户问答：客户本人可读写自己的，admin 全部
ALTER TABLE customer_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_own_qa" ON customer_qa
  FOR ALL USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- 渠道档案：渠道本人可读，admin 读写
ALTER TABLE partner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_own_profile" ON partner_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin_all_partners" ON partner_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- 营销资产：渠道+admin 可读，admin 可写
ALTER TABLE marketing_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_partner_read" ON marketing_assets
  FOR SELECT USING (
    is_active = true AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_partner = true)
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
    )
  );

CREATE POLICY "assets_admin_write" ON marketing_assets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- 渠道线索：自己的可读写
ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_own_leads" ON partner_leads
  FOR ALL USING (
    partner_id IN (SELECT id FROM partner_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- FAQ 知识库：所有登录用户可读
ALTER TABLE faq_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faq_all_read" ON faq_knowledge
  FOR SELECT USING (is_public = true);

CREATE POLICY "faq_admin_write" ON faq_knowledge
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- 咨询师档案：active 的所有用户可读，本人可写自己的
ALTER TABLE consultant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultants_public_read" ON consultant_profiles
  FOR SELECT USING (status = 'active');

CREATE POLICY "consultants_own_write" ON consultant_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "admin_all_consultants" ON consultant_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- 咨询预约：客户+咨询师双方可见自己的，admin 全部
ALTER TABLE consultation_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_own_customer" ON consultation_bookings
  FOR SELECT USING (customer_user_id = auth.uid());

CREATE POLICY "bookings_own_consultant" ON consultation_bookings
  FOR SELECT USING (
    consultant_id IN (SELECT id FROM consultant_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "admin_all_bookings" ON consultation_bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );
```

### 1.6 数据库辅助函数

```sql
-- 生成预约编号
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  seq_num INT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO seq_num
    FROM consultation_bookings
    WHERE booking_number LIKE 'RC-' || date_part || '%';
  RETURN 'RC-' || date_part || '-' || LPAD(seq_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 生成渠道推广码
CREATE OR REPLACE FUNCTION generate_referral_code(name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  seq_num INT := 0;
BEGIN
  base_code := 'READII-' || UPPER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) || '-' || TO_CHAR(NOW(), 'YYYY');
  final_code := base_code;
  WHILE EXISTS (SELECT 1 FROM partner_profiles WHERE referral_code = final_code) LOOP
    seq_num := seq_num + 1;
    final_code := base_code || '-' || seq_num;
  END LOOP;
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- 更新咨询师的总预约数和收入
CREATE OR REPLACE FUNCTION update_consultant_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_status = 'completed' AND OLD.booking_status != 'completed' THEN
    UPDATE consultant_profiles
    SET total_bookings = total_bookings + 1,
        total_revenue_earned_pence = total_revenue_earned_pence + NEW.consultant_earnings_pence
    WHERE id = NEW.consultant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_consultant_stats
  AFTER UPDATE ON consultation_bookings
  FOR EACH ROW EXECUTE FUNCTION update_consultant_stats();
```

---

## 2. Netlify Functions 清单

所有函数遵循 REST 风格，返回统一格式：
```json
{ "success": true, "data": {...} }
// 或
{ "success": false, "error": { "code": "...", "message": "..." } }
```

### 2.1 客户工作台 Functions

#### 2.1.1 `GET /api/customer/dashboard`

**功能**：客户登录后的工作台首页，返回完整概览

**Request**: 仅需 auth token

**Response**:
```json
{
  "customer": {
    "id": "uuid",
    "service_type": "sw_self_sponsored",
    "signed_date": "2026-04-03",
    "expected_completion_date": "2026-09-15",
    "total_contract_value_pence": 3500000,
    "paid_amount_pence": 1750000
  },
  "progress": {
    "current_stage": {
      "stage_number": 2,
      "title": "英国公司注册",
      "description_why": "...",
      "description_customer_action": "...",
      "description_readii_action": "...",
      "status": "in_progress",
      "estimated_duration_days": 5
    },
    "total_stages": 18,
    "completed_stages": 1,
    "percent_complete": 5.5,
    "all_stages": [...]
  },
  "upcoming_meetings": [...],
  "pending_actions": [...],
  "recent_documents": [...]
}
```

#### 2.1.2 `GET /api/customer/journey`

**功能**：完整的服务路径，18 个阶段全部展示

**Response**:
```json
{
  "template": { "id": "...", "name": "..." },
  "stages": [
    {
      "id": "uuid",
      "stage_number": 1,
      "title": "签约与需求深度沟通",
      "status": "completed",
      "started_at": "...",
      "completed_at": "...",
      "description_why": "...",
      "description_customer_action": "...",
      "description_readii_action": "...",
      "deliverables": [...]
    }
  ]
}
```

#### 2.1.3 `POST /api/customer/qa/ask`

**功能**：客户提交问题

**Request**:
```json
{
  "question": "公司注册完之后我需要准备什么？",
  "related_stage_id": "uuid (optional)"
}
```

**Response**:
```json
{
  "qa_id": "uuid",
  "auto_suggested_answer": "...",
  "status": "pending",
  "message": "苏晓宇会在 24 小时内回复你"
}
```

**实现要点**：
- 自动搜索 `faq_knowledge` 表，如果有匹配度 > 0.8 的答案，直接返回（但仍然创建 qa 记录让 admin 可以跟进）
- 无匹配则进入 admin 待答队列

#### 2.1.4 `GET /api/customer/qa/list`

**功能**：查看我提过的所有问题和答案

**Response**:
```json
{
  "qa_list": [
    {
      "id": "uuid",
      "question": "...",
      "answer": "...",
      "status": "answered",
      "created_at": "...",
      "answered_at": "..."
    }
  ]
}
```

#### 2.1.5 `GET /api/customer/documents`

**功能**：查看所有文档

**Response**:
```json
{
  "documents": [
    {
      "id": "uuid",
      "file_name": "合同.pdf",
      "file_url": "signed_url",
      "category": "contract",
      "stage_id": "uuid",
      "created_at": "..."
    }
  ]
}
```

**实现要点**：
- `file_url` 必须是 Supabase Storage 的 signed URL，有效期 1 小时

#### 2.1.6 `POST /api/customer/documents/upload`

**功能**：客户上传文档

**Request**: multipart/form-data
- `file`: File
- `category`: 'identity' | 'financial' | 'other'
- `description`: string (optional)
- `stage_id`: uuid (optional)

**Response**:
```json
{
  "document_id": "uuid",
  "file_url": "...",
  "message": "文档已上传，Readii 团队已收到"
}
```

#### 2.1.7 `GET /api/customer/meetings`

**功能**：查看所有会议

#### 2.1.8 `POST /api/customer/meetings/request`

**功能**：客户发起会议请求

**Request**:
```json
{
  "preferred_dates": ["2026-04-25T14:00Z", "2026-04-26T14:00Z"],
  "duration_minutes": 30,
  "agenda": "想讨论公司注册的具体选项"
}
```

**Response**:
```json
{
  "request_id": "uuid",
  "message": "Readii 团队将在 2 个工作日内确认时间"
}
```

### 2.2 A 型渠道 Functions

#### 2.2.1 `GET /api/partner/dashboard`

**Response**:
```json
{
  "partner": {
    "id": "uuid",
    "referral_code": "READII-NAME-2026",
    "commission_rate": 15.00
  },
  "stats": {
    "total_referrals": 3,
    "active_leads": 1,
    "converted_customers": 1,
    "this_month_commission_pence": 35000,
    "pending_commission_pence": 52500,
    "total_earned_pence": 87500
  },
  "recent_leads": [...],
  "recent_commissions": [...]
}
```

#### 2.2.2 `GET /api/partner/marketing-assets`

**功能**：浏览推广工具包

**Query**:
- `type`: 'moments_post' | 'article' | 'video_script' | ...
- `topic`: 'sw_visa' | ...

**Response**:
```json
{
  "assets": [
    {
      "id": "uuid",
      "asset_type": "moments_post",
      "title": "自雇工签 vs 创新签，哪个适合我？",
      "content": "完整的朋友圈文案...",
      "media_urls": ["https://..."],
      "usage_notes": "适合转发到朋友圈，建议配图"
    }
  ]
}
```

#### 2.2.3 `GET /api/partner/marketing-assets/:id/download`

**功能**：下载素材（海报、清单等）并记录使用

**Response**: 直接返回文件或 signed URL

#### 2.2.4 `POST /api/partner/leads`

**功能**：渠道提交新线索

**Request**:
```json
{
  "lead_name": "张三",
  "lead_wechat": "zhangsan123",
  "source": "moments",
  "initial_message": "你朋友圈发的那个工签我有兴趣...",
  "estimated_budget": "30-50k",
  "service_interest": "sw_self_sponsored"
}
```

**Response**:
```json
{
  "lead_id": "uuid",
  "locked_until": "2026-04-22T10:00Z",
  "message": "线索已锁定 48 小时"
}
```

#### 2.2.5 `GET /api/partner/leads`

**功能**：查看自己所有线索

**Response**:
```json
{
  "leads": [
    {
      "id": "uuid",
      "lead_name": "张三",
      "status": "qualifying",
      "last_contact_at": "...",
      "initial_message": "...",
      "suggested_reply": "...(AI 生成)"
    }
  ]
}
```

#### 2.2.6 `POST /api/partner/leads/:id/conversation`

**功能**：录入客户微信聊天记录（用于生成 AI 回复建议）

**Request**:
```json
{
  "messages": [
    { "from": "lead", "content": "工签怎么办？", "at": "2026-04-20T10:00Z" },
    { "from": "partner", "content": "...", "at": "2026-04-20T10:05Z" }
  ]
}
```

**Response**:
```json
{
  "conversation_ids": ["uuid1", "uuid2"],
  "ai_suggested_reply": "根据你刚才的对话，建议这样回复..."
}
```

**实现要点（核心 AI 功能）**：
- 调用 Anthropic API，system prompt：
  ```
  你是 Readii 的销售话术助手。你的任务是根据客户和渠道的聊天上下文，为渠道生成下一句最优回复。

  规则：
  1. 不提供移民法律建议，只围绕服务价值和下一步动作
  2. 话术要符合中国用户习惯，亲切但不过度销售
  3. 如果客户问题超出你能答的范围，建议"我帮你约 Readii 的苏总给你详细讲解"
  4. 每次回复控制在 3 句话以内

  当前聊天上下文：{conversations}

  最后一句来自客户的话：{last_lead_message}

  请生成渠道的下一句回复：
  ```
- 结果存入 `lead_conversations.ai_suggested_reply`
- 总是附带免责声明

#### 2.2.7 `GET /api/partner/faq`

**功能**：浏览常见问题库

**Query**:
- `category`: 'visa_basics' | 'pricing' | ...
- `search`: 关键词

**Response**:
```json
{
  "faqs": [
    {
      "id": "uuid",
      "category": "visa_basics",
      "question": "自雇工签和创新签有什么区别？",
      "answer_short": "...",
      "answer_full": "..."
    }
  ]
}
```

#### 2.2.8 `GET /api/partner/commissions`

**功能**：查看佣金明细

### 2.3 B 型咨询师 Functions

#### 2.3.1 `POST /api/consultant/apply`

**功能**：咨询师申请入驻

**Request**:
```json
{
  "display_name": "Jay（伦敦创业者）",
  "headline": "创新签持有者 2 年，教培行业创业",
  "bio": "详细介绍...",
  "uk_city": "London",
  "years_in_uk": 5,
  "visa_types_experienced": ["innovator_founder"],
  "industries": ["education", "tech"],
  "hourly_rate_pence": 19900,
  "category_ids": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "consultant_id": "uuid",
  "status": "pending_review",
  "message": "申请已提交，Readii 团队将在 3 个工作日内审核"
}
```

#### 2.3.2 `POST /api/consultant/availability`

**功能**：设置可预约时段

**Request**:
```json
{
  "recurring_slots": [
    { "day_of_week": 1, "start_time": "19:00", "end_time": "22:00" },
    { "day_of_week": 6, "start_time": "10:00", "end_time": "18:00" }
  ]
}
```

#### 2.3.3 `GET /api/consultant/dashboard`

**Response**:
```json
{
  "consultant": {...},
  "upcoming_bookings": [...],
  "this_month_stats": {
    "completed_bookings": 5,
    "revenue_pence": 99500,
    "average_rating": 4.8
  },
  "all_time_stats": {...}
}
```

#### 2.3.4 `GET /api/consultants/browse`（客户视角）

**功能**：客户浏览可预约的咨询师

**Query**:
- `category`: 'visa_experience' | 'entrepreneurship' | ...
- `visa_type`: 'sw_self_sponsored' | ...
- `city`: 'London' | ...

**Response**:
```json
{
  "consultants": [
    {
      "id": "uuid",
      "display_name": "Jay（伦敦创业者）",
      "headline": "...",
      "avatar_url": "...",
      "hourly_rate_pence": 19900,
      "average_rating": 4.8,
      "total_bookings": 12,
      "next_available_slot": "2026-04-22T19:00Z",
      "categories": [...]
    }
  ]
}
```

#### 2.3.5 `GET /api/consultants/:id`

**功能**：咨询师详情页

**Response**: 完整的 consultant_profiles 数据 + 最近 5 个公开评价

#### 2.3.6 `GET /api/consultants/:id/available-slots`

**功能**：获取咨询师未来 14 天可预约时段

**Response**:
```json
{
  "slots": [
    { "datetime": "2026-04-22T19:00Z", "duration_minutes": 60 },
    { "datetime": "2026-04-22T20:30Z", "duration_minutes": 60 }
  ]
}
```

#### 2.3.7 `POST /api/consultations/book`

**功能**：客户发起预约（创建 Stripe Checkout）

**Request**:
```json
{
  "consultant_id": "uuid",
  "category_id": "uuid",
  "scheduled_at": "2026-04-22T19:00Z",
  "duration_minutes": 60,
  "customer_questions": "我想了解你当年办创新签的真实经历...",
  "referral_code": "READII-NAME-2026 (optional)"
}
```

**Response**:
```json
{
  "booking_id": "uuid",
  "booking_number": "RC-20260420-001",
  "checkout_url": "https://checkout.stripe.com/...",
  "price_pence": 19900
}
```

**实现要点**：
- 创建 `consultation_bookings` 记录，状态 `pending_payment`
- 计算 Readii 20% + 咨询师 80%
- 如果有 referral_code，验证并记录 `referred_by_partner_id` 和 `partner_commission_pence`（5% from Readii's 20%，即整单的 1%）
- Stripe Checkout Session 设置 metadata `booking_id`，webhook 更新状态

#### 2.3.8 `POST /api/webhooks/stripe`

**功能**：Stripe Webhook 处理

**事件处理**：
- `checkout.session.completed` → 更新 booking 状态为 `confirmed`，发送邮件，生成 Meeting Link
- `charge.refunded` → 退款处理
- 所有事件写入 `stripe_events` 表（幂等）

#### 2.3.9 `POST /api/consultations/:id/cancel`

**功能**：取消预约

**规则**：
- 24 小时前取消：全额退款
- 24 小时内取消：扣 50%
- 咨询师取消：客户全额退款 + Readii 承担 50% 咨询师罚金

#### 2.3.10 `POST /api/consultations/:id/complete`

**功能**：咨询师标记完成

#### 2.3.11 `POST /api/consultations/:id/review`

**功能**：客户提交评价

**Request**:
```json
{
  "rating": 5,
  "review_text": "Jay 分享的经验非常有价值...",
  "is_public": true
}
```

### 2.4 Admin Functions

#### 2.4.1 `GET /api/admin/overview`

**功能**：admin 总览

**Response**: 全局统计（客户数、渠道数、咨询师数、本月 GMV、待处理事项）

#### 2.4.2 `POST /api/admin/customer/create`

**功能**：admin 手动添加客户（绑定现有客户）

#### 2.4.3 `POST /api/admin/customer/:id/progress/update`

**功能**：更新客户进度

**Request**:
```json
{
  "stage_id": "uuid",
  "status": "in_progress",
  "notes": "..."
}
```

#### 2.4.4 `POST /api/admin/customer/qa/:id/answer`

**功能**：admin 回复客户问题

**Request**:
```json
{
  "answer": "...",
  "is_reusable": true,
  "add_to_faq_category": "visa_basics"
}
```

**实现要点**：
- 如果 `is_reusable=true`，同时写入 `faq_knowledge`

#### 2.4.5 `POST /api/admin/consultant/:id/approve`

**功能**：审批咨询师

#### 2.4.6 `POST /api/admin/partner/create`

**功能**：admin 开通渠道账号（就是你答应下周给的那个）

**Request**:
```json
{
  "user_id": "uuid",
  "partner_type": "a_type",
  "commission_rate": 15.00,
  "bio": "..."
}
```

**Response**:
```json
{
  "partner_id": "uuid",
  "referral_code": "READII-XXX-2026"
}
```

### 2.5 AI 相关 Functions

#### 2.5.1 `POST /api/ai/generate-sales-reply`

**功能**：根据聊天记录生成销售话术建议（Partner 使用）

#### 2.5.2 `POST /api/ai/answer-customer-question`

**功能**：尝试自动回答客户常见问题

**实现要点**：
- 先搜索 `faq_knowledge`，cosine similarity > 0.85 直接返回
- 否则调用 Claude，严格按照系统 prompt：
  ```
  你是 Readii 的信息助手，你只提供事实信息，不提供法律或移民建议。
  如果问题需要专业判断，回复："这个问题需要苏晓宇顾问具体分析你的情况。"

  可用知识库：{faq_results}

  客户问题：{question}
  ```

---

## 3. 前端页面清单

### 3.1 路由结构

```
/ (营销首页，现有，微调)
/login, /register (现有)

# 客户端
/customer
/customer/dashboard
/customer/journey (完整路径视图)
/customer/journey/stage/:stageNumber (单步详情)
/customer/documents
/customer/qa
/customer/meetings
/customer/settings

# 渠道端 (A 型)
/partner
/partner/dashboard
/partner/marketing (素材库)
/partner/leads
/partner/leads/:id
/partner/leads/:id/conversation (AI 话术生成)
/partner/faq
/partner/commissions
/partner/settings

# 咨询师端 (B 型)
/consultant
/consultant/apply (入驻申请)
/consultant/dashboard
/consultant/bookings
/consultant/availability
/consultant/profile

# 客户浏览咨询师
/consultants (列表)
/consultants/:id (详情)
/consultants/:id/book (预约)

# Admin
/admin (现有，扩展)
/admin/customers
/admin/customers/:id
/admin/partners
/admin/consultants
/admin/consultants/pending
/admin/qa (待回答问题队列)
/admin/commissions
/admin/assets (素材管理)
/admin/faq (FAQ 管理)
```

### 3.2 核心组件清单

**客户端关键组件**：

```
src/components/customer/
├── JourneyProgressBar.jsx       # 横向进度条，18 个点
├── CurrentStageCard.jsx          # 当前阶段大卡片
├── StageDetailPanel.jsx          # 单阶段详情面板
│   ├── WhyThisMatters            # 为什么重要
│   ├── YourActions               # 你需要做什么
│   └── ReadiiActions             # Readii 在做什么
├── DocumentCenter.jsx
├── QuickActionPanel.jsx          # 快捷操作（问问题、约会议、上传文档）
├── QAThread.jsx                  # Q&A 沉淀
└── UpcomingMeetings.jsx
```

**渠道端关键组件**：

```
src/components/partner/
├── ReferralCodeCard.jsx          # 推广码复制卡片
├── MarketingAssetLibrary.jsx     # 素材库浏览器
│   ├── AssetFilter               # 按类型/主题筛选
│   └── AssetCard                 # 单个素材卡片
├── LeadKanban.jsx                # 线索看板
├── LeadCard.jsx                  # 单个线索卡片（含聊天记录 + AI 建议）
├── AIConversationAssistant.jsx   # AI 话术助手
├── FAQSearch.jsx                 # FAQ 搜索
└── CommissionDashboard.jsx
```

**咨询师端关键组件**：

```
src/components/consultant/
├── ConsultantApplicationForm.jsx
├── ConsultantDashboard.jsx
├── BookingList.jsx
├── AvailabilityPicker.jsx
└── EarningsSummary.jsx
```

**客户浏览咨询师**：

```
src/components/consultants-marketplace/
├── ConsultantList.jsx
├── ConsultantFilter.jsx          # 按类目/城市/价格筛选
├── ConsultantCard.jsx
├── ConsultantDetailPage.jsx
├── BookingSlotPicker.jsx         # 时段选择
└── CheckoutForm.jsx
```

### 3.3 关键交互规范

**客户工作台首页（/customer/dashboard）必须包含**：

1. **顶部**：客户姓名、当前服务类型、合同总价、已付金额
2. **进度条**（最醒目）：横向 18 段，当前位置高亮
3. **当前阶段大卡片**：
   - 标题（大字）
   - 三个并列块：为什么重要 / 你需要做什么 / Readii 在做什么
   - 状态 badge
   - 预计完成时间
4. **下一步行动**：基于 current_stage 推荐的动作按钮
5. **待办事项**：客户需要做的事（未上传文档、未回复问题等）
6. **快捷操作区**：问问题、约会议、上传文档（大按钮）
7. **最近动态**：Readii 最近 7 天为你做的事情

**渠道端 Dashboard（/partner/dashboard）必须包含**：

1. **推广码卡片**：一键复制 + 扫码下载二维码
2. **本月数据卡片**：佣金、线索数、转化数
3. **线索漏斗**：new → qualifying → hot → converted
4. **今日待办**：需要回复的线索
5. **推荐素材**：本周新素材推送

---

## 4. Stripe 配置

### 4.1 需要创建的产品

由于 v1 不做订阅会员，只做咨询预约和部分服务加购，Stripe 产品相对简单：

1. **Consultation Booking**（动态定价）
   - 不使用预设 Price，每次用 Dynamic Price
   - Price range: £199 - £500 per session
2. **Existing products**：沿用现有销售看板的 product definitions

### 4.2 Stripe Connect 账户（咨询师收款）

**策略**：v1 简化版——Readii 统一收款，月底手动打款给咨询师

**理由**：
- Stripe Connect Express 需要每个咨询师做 KYC，v1 规模太小，ROI 不合适
- v1 阶段 5-8 个咨询师，苏晓宇月底手动结算更灵活

**v2 再升级**：当咨询师超过 15 个或月预约超过 50 单时，迁移到 Stripe Connect Express

### 4.3 Webhook 配置

**事件订阅**：
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

**幂等处理**：使用 Stripe event ID 去重，存入 `stripe_events` 表

---

## 5. Anthropic API 集成

### 5.1 使用场景

**场景 A：渠道 AI 话术助手**
- 模型：`claude-sonnet-4-6`（需要较好的中文和语境理解）
- Max tokens: 300
- 日均调用预估：5 渠道 × 3 次/天 = 15 次，月成本约 £15

**场景 B：客户问答自动匹配**
- 模型：`claude-haiku-4-5-20251001`（便宜，用于 embedding 和简单匹配）
- Max tokens: 200
- 日均调用预估：5 客户 × 2 次/天 = 10 次，月成本约 £3

### 5.2 系统 Prompt 锁定

**话术助手 system prompt**：

```
你是 Readii 的销售话术助手。Readii 是帮助中国人在英国创业和拿身份的咨询平台。

严格规则：
1. 你不提供移民法律建议，只生成销售话术
2. 所有话术必须符合中国用户习惯：亲切、专业、不过度销售
3. 每条回复控制在 3 句话以内
4. 如果客户的问题涉及具体法律判断，引导他"约 Readii 的苏总聊一次"
5. 禁止承诺签证结果（如"100%通过"）

当前聊天上下文会作为 user message 提供。请生成渠道下一句最优回复。
```

**客户问答助手 system prompt**：

```
你是 Readii 的信息助手。你只提供事实信息，不提供个性化建议。

规则：
1. 回答必须基于提供的 FAQ 知识库
2. 如果知识库没有答案，回复："这个问题需要苏晓宇顾问具体分析，请在 Q&A 中提交，苏总会在 24 小时内回复"
3. 每次回答控制在 150 字以内
4. 禁止推测或编造信息

知识库：{faq_context}
用户问题：{question}
```

### 5.3 成本控制

- 每次调用存入 `ai_usage_log` 表
- 每日检查是否超过 £5/天预算
- 超预算自动降级到 Haiku 或返回"AI 助手暂时不可用"

---

## 6. EmailJS 邮件模板

v1 需要创建的邮件模板：

| 模板名 | 触发事件 | 收件人 | 核心内容 |
|---|---|---|---|
| `customer_welcome` | 客户签约 | 客户 | 欢迎、工作台链接、登录凭证 |
| `customer_stage_updated` | 阶段变更 | 客户 | 新阶段说明、下一步 |
| `customer_qa_answered` | QA 被回答 | 客户 | 问题、回答、工作台链接 |
| `partner_welcome` | 渠道开通 | 渠道 | 推广码、手册链接 |
| `partner_new_commission` | 佣金入账 | 渠道 | 金额、来源 |
| `consultant_approved` | 审核通过 | 咨询师 | 审核结果、设置时段链接 |
| `consultation_booking_confirmed` | 预约成功 | 客户+咨询师 | 时间、链接、准备事项 |
| `consultation_reminder_24h` | 预约前 24 小时 | 双方 | 提醒 |
| `consultation_completed` | 咨询完成 | 客户 | 评价邀请 |
| `admin_new_qa` | 新 QA | 苏晓宇 | 待回答提醒 |
| `admin_new_consultant_application` | 新咨询师申请 | 苏晓宇 | 审核提醒 |

---

## 7. 开发节奏（30 天）

### Week 1（Day 1-7）：基础设施 + 客户工作台骨架

**Day 1-2**：
- [ ] Supabase schema 全部部署（所有表、索引、RLS）
- [ ] 基础函数部署（生成编号、触发器）
- [ ] 已有 `profiles` 表扩展完成

**Day 3-4**：
- [ ] 现有销售看板代码结构梳理，确定 v1 扩展位置
- [ ] 添加角色路由（`/customer/*`, `/partner/*`, `/consultant/*`）
- [ ] 角色切换器组件（用户有多角色时）

**Day 5-7**：
- [ ] 客户工作台路由骨架
- [ ] Journey 进度条组件（核心视觉）
- [ ] 当前阶段卡片组件
- [ ] API: `/api/customer/dashboard`, `/api/customer/journey`

**Week 1 验收**：苏晓宇能以 customer 身份登录，看到自雇工签客户的 journey（虽然数据还没填满）

### Week 2（Day 8-14）：客户工作台完整 + 渠道基础

**Day 8-10**：
- [ ] Journey 的 18 个阶段数据填充（苏晓宇提供内容）
- [ ] 客户 QA 功能（提问、查看、Admin 回答）
- [ ] 文档中心（上传、列表、下载）

**Day 11-14**：
- [ ] 渠道后台 Dashboard
- [ ] 推广码生成和展示
- [ ] 基础营销素材库（先只做浏览）
- [ ] FAQ 知识库展示
- [ ] Admin 开通渠道账号的功能

**Week 2 验收**：
- 2 个客户正式接入工作台
- 5 个 A 型渠道账号开通，能看到推广码和素材库

### Week 3（Day 15-21）：推广工具包 + AI 话术

**Day 15-17**：
- [ ] 完整的营销素材库（朋友圈、文章、视频脚本、海报）
- [ ] 素材下载追踪
- [ ] 苏晓宇批量上传首批素材（至少 30 个）

**Day 18-21**：
- [ ] 线索提交和管理
- [ ] 线索聊天记录录入
- [ ] **AI 话术生成核心功能**（最难的部分）
- [ ] 渠道使用 AI 生成话术并记录
- [ ] 佣金记录查询

**Week 3 验收**：
- 渠道能独立使用工具包开始推广
- AI 话术生成对 80% 的场景能生成可用的回复

### Week 4（Day 22-30）：咨询师撮合 + 上线

**Day 22-24**：
- [ ] 咨询师入驻申请流程
- [ ] Admin 审核咨询师
- [ ] 咨询师 Dashboard 和时段设置

**Day 25-27**：
- [ ] 客户浏览咨询师列表
- [ ] 咨询师详情页
- [ ] 时段选择和预约
- [ ] Stripe Checkout 集成

**Day 28-29**：
- [ ] Webhook 处理
- [ ] 邮件通知全部到位
- [ ] 咨询后评价
- [ ] 首批 5-8 个咨询师入驻

**Day 30**：
- [ ] 全流程 End-to-End 测试
- [ ] 真实客户场景测试（用自雇工签客户测试工作台）
- [ ] 小红书/公众号发布"Readii 咨询平台上线"
- [ ] 收到第一单咨询预约

**Week 4 验收**：
- 咨询平台上线，完成第一单 £199+ 咨询付费
- 客户工作台正式服务 2 个付费客户
- A 型渠道正在用工具推广

---

## 8. 测试用例

### 8.1 客户工作台

**TC-C1**：客户登录后能看到完整的 18 阶段路径
**TC-C2**：客户点击当前阶段，能看到"为什么/你做什么/Readii 做什么"
**TC-C3**：客户提问题后 24 小时内收到 email 通知（如果 admin 已回复）
**TC-C4**：客户上传文档后，admin 立即收到通知
**TC-C5**：客户不能看到其他客户的任何数据（RLS）

### 8.2 渠道推广

**TC-P1**：渠道账号开通后收到 email，包含推广码和登录链接
**TC-P2**：渠道使用推广链接注册的用户，自动归属到该渠道
**TC-P3**：渠道提交线索后，48 小时内其他渠道不能抢同一个微信号
**TC-P4**：AI 话术生成的回复符合中国用户语境，不包含法律建议
**TC-P5**：渠道的佣金计算正确（15% × 转化订单额）

### 8.3 咨询撮合

**TC-B1**：咨询师申请 → admin 审核 → 激活全流程通
**TC-B2**：客户浏览咨询师列表，按城市/类目过滤正确
**TC-B3**：客户预约时段 → Stripe 付款 → webhook 确认 → 邮件发送给双方
**TC-B4**：24 小时前取消 → 全额退款
**TC-B5**：24 小时内取消 → 扣 50%
**TC-B6**：咨询完成后客户可提交评价，评分和评论显示在咨询师页面

### 8.4 关键业务流程 E2E

**TC-E2E-1**：完整的新客户引流路径
1. 渠道发朋友圈带推广码
2. 潜在客户点击注册 → 自动归属渠道
3. 客户预约 £199 过来人咨询 → 支付 → 咨询完成
4. 客户决定签约全案 → admin 创建 customer_profile
5. 渠道的 commission_pence 记录正确（咨询 5% + 全案 15%）

---

## 9. 上线 Checklist

### 数据层
- [ ] 所有 schema 部署到生产
- [ ] 所有 RLS 策略验证
- [ ] 初始数据导入（journey_stages、categories、FAQ 种子数据）
- [ ] 备份策略启用

### 代码层
- [ ] 所有 Netlify Functions 部署
- [ ] 环境变量配置齐全（Stripe key、Anthropic key、EmailJS key）
- [ ] CORS 配置正确
- [ ] 错误监控（Sentry）接入

### 业务准备
- [ ] 苏晓宇录入 2 个客户的完整 journey 数据
- [ ] 5-10 个渠道账号创建（现有 wechat 联系人）
- [ ] 30+ 营销素材上传
- [ ] 50+ FAQ 条目
- [ ] 5-8 个咨询师审核通过
- [ ] Stripe 产品创建、测试支付通过

### 合规层
- [ ] 所有客户端页面有免责声明
- [ ] 咨询师服务条款起草
- [ ] 客户服务协议起草
- [ ] GDPR 隐私政策更新

### 沟通
- [ ] 给 2 个付费客户发邮件说明工作台使用
- [ ] 给 5-10 个渠道发手册和推广码
- [ ] 给 5-8 个咨询师发入驻邮件
- [ ] 小红书/公众号首发内容准备

---

## 10. v1 成功标准

**上线 30 天内需达成**：

1. **客户满意度**：2 个付费客户的工作台 NPS ≥ 8/10
2. **效率提升**：苏晓宇每日响应客户问题的时间减少 > 40%
3. **渠道激活**：至少 3 个 A 型渠道产生第一个线索提交
4. **咨询成交**：至少 5 单 £199+ 咨询预约完成
5. **营收**：v1 当月咨询抽成营收 £200+（5 单 × £199 × 20%）
6. **数据积累**：FAQ 知识库达到 100+ 条，营销素材达到 50+ 个

**不达标时的调整策略**：
- 客户 NPS 低 → 排查是什么让他们不满（通常是信息展示不足或权限问题）
- 渠道未激活 → 可能推广码没发对地方，或话术生成质量差
- 咨询无成交 → 可能定价锚点错误、或页面 SEO/推广不够

---

## 附录 A：后续 v2-v4 路径预览

v1 跑通后的自然延伸：

**v2（Month 2-3）**：
- 自助向导（自雇工签问卷 → 清单 → 模板填充）
- ILR/签证天数计算器
- 订阅会员制度上线（£79/月）

**v3（Month 4-6）**：
- 律师审核 SKU 正式化
- BP 写手对接
- 完整的 14 SKU 交叉销售

**v4（Month 7-12）**：
- 供应商平台化
- UGC 内容生态
- 规模化增长

---

**v1 手册结束。所有内容可直接作为开发团队 sprint 的输入，建表、建函数、建路由无歧义。**
