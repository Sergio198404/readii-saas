-- v1 Migration 3: Partner system tables
-- Note: existing `partners` table is kept as-is; partner_profiles is a new v1 table

CREATE TABLE IF NOT EXISTS partner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('a_type', 'b_type')),
  referral_code TEXT UNIQUE NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 15.00,
  total_referrals INT DEFAULT 0,
  total_commission_earned_pence INT DEFAULT 0,
  bio TEXT,
  onboarded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_referral_code ON partner_profiles(referral_code);

CREATE TABLE IF NOT EXISTS marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'moments_post', 'article', 'video_script', 'poster', 'xiaohongshu_post',
    'fee_list', 'material_checklist', 'brochure', 'case_study'
  )),
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  media_urls TEXT[],
  download_url TEXT,
  tags TEXT[],
  usage_notes TEXT,
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON marketing_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_topic ON marketing_assets(topic);

CREATE TABLE IF NOT EXISTS partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partner_profiles(id),
  lead_name TEXT,
  lead_wechat TEXT,
  lead_phone TEXT,
  lead_email TEXT,
  source TEXT,
  initial_message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new', 'qualifying', 'hot', 'warm', 'cold', 'converted', 'lost'
  )),
  estimated_budget TEXT,
  service_interest TEXT,
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  converted_to_customer_id UUID REFERENCES customer_profiles(id),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_partner ON partner_leads(partner_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON partner_leads(status);

CREATE TABLE IF NOT EXISTS lead_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES partner_leads(id) ON DELETE CASCADE,
  message_from TEXT CHECK (message_from IN ('lead', 'partner')),
  message_content TEXT NOT NULL,
  message_at TIMESTAMPTZ,
  ai_suggested_reply TEXT,
  ai_generated_at TIMESTAMPTZ,
  partner_actual_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_lead ON lead_conversations(lead_id);

CREATE TABLE IF NOT EXISTS faq_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer_short TEXT NOT NULL,
  answer_full TEXT,
  related_service TEXT[],
  sort_order INT DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faq_category ON faq_knowledge(category);

CREATE TABLE IF NOT EXISTS partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partner_profiles(id),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'customer_contract', 'consultant_booking', 'addon_service'
  )),
  source_id UUID NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_comm_partner ON partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_comm_status ON partner_commissions(status);
