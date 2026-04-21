-- v1 Proposal feature: extend proposals table with client-facing fields,
-- add proposal_third_party_defaults admin-editable defaults table, 8-char
-- token generator + 48h expires_at trigger, RLS for admin-all + public-by-token.

-- 1. Extend existing proposals table (kept from old feature)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'sw_self_sponsored' CHECK (service_type IN (
    'sw_self_sponsored','ifv_innovator','ew_expansion','gt_global_talent','plan_b'
  )),
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_meta TEXT,
  ADD COLUMN IF NOT EXISTS route_label TEXT,
  ADD COLUMN IF NOT EXISTS route_note TEXT,
  ADD COLUMN IF NOT EXISTS service_price_pence INT DEFAULT 480000,
  ADD COLUMN IF NOT EXISTS anchor_price_pence INT DEFAULT 6000000,
  ADD COLUMN IF NOT EXISTS payment_1_pence INT DEFAULT 150000,
  ADD COLUMN IF NOT EXISTS payment_2_pence INT DEFAULT 330000,
  ADD COLUMN IF NOT EXISTS timeline_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS third_party_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent' CHECK (status IN (
    'draft','sent','viewed','confirmed','expired','converted'
  )),
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_client_phone TEXT,
  ADD COLUMN IF NOT EXISTS converted_customer_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- 2. Token generator (8-char, low-ambiguity alphabet)
CREATE OR REPLACE FUNCTION generate_proposal_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random()*length(chars)+1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. INSERT trigger: auto-assign unique token + default expires_at (48h)
CREATE OR REPLACE FUNCTION set_proposal_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token IS NULL THEN
    LOOP
      NEW.token := generate_proposal_token();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM proposals WHERE token = NEW.token);
    END LOOP;
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '48 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposals_set_defaults ON proposals;
CREATE TRIGGER proposals_set_defaults
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION set_proposal_defaults();

-- 4. Admin-editable third-party fee defaults (per visa type)
CREATE TABLE IF NOT EXISTS proposal_third_party_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL CHECK (service_type IN (
    'sw_self_sponsored','ifv_innovator','ew_expansion','gt_global_talent','plan_b'
  )),
  item_order INT DEFAULT 0,
  item_name TEXT NOT NULL,
  item_note TEXT,
  is_required BOOLEAN DEFAULT true,
  frequency TEXT DEFAULT '一次性',
  price_from_pence INT,
  price_to_pence INT,
  price_fixed_pence INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_defaults_type
  ON proposal_third_party_defaults(service_type, item_order);

-- 5. Seed: IFV (endorsement body fee = £1,000 corrected from earlier £500)
INSERT INTO proposal_third_party_defaults
  (service_type, item_order, item_name, item_note, is_required, frequency, price_fixed_pence, price_from_pence, price_to_pence)
VALUES
  ('ifv_innovator',1,'背书机构申请费','向认可机构提交背书申请',true,'一次性',100000,NULL,NULL),
  ('ifv_innovator',2,'签证官方申请费','Home Office 签证主申请费',true,'一次性',148600,NULL,NULL),
  ('ifv_innovator',3,'IHS 医疗附加税','按签证年限计算，3年期',true,'按年计',310500,NULL,NULL),
  ('ifv_innovator',4,'英国公司注册 + 虚拟地址','Readii 可介绍合作会计楼，含首年地址',true,'首年含注册',NULL,50000,80000),
  ('ifv_innovator',5,'移民律师审核','如需律师签字确认，Readii 可转介绍',false,'按案收费',NULL,150000,300000),
  ('ifv_innovator',6,'雅思备考课程','满足豁免条件者无需',false,'按课时',NULL,30000,80000);

-- 6. Seed: self-sponsored worker visa
INSERT INTO proposal_third_party_defaults
  (service_type, item_order, item_name, item_note, is_required, frequency, price_fixed_pence, price_from_pence, price_to_pence)
VALUES
  ('sw_self_sponsored',1,'Sponsor Licence 申请费','小型雇主',true,'一次性',57400,NULL,NULL),
  ('sw_self_sponsored',2,'CoS 分配费','每份',true,'一次性',52500,NULL,NULL),
  ('sw_self_sponsored',3,'Immigration Skills Charge（3年）','小型雇主',true,'按年计',109200,NULL,NULL),
  ('sw_self_sponsored',4,'IHS 医疗附加税（3年）','雇员支付',true,'按年计',310500,NULL,NULL),
  ('sw_self_sponsored',5,'签证申请费','境内申请',true,'一次性',82700,NULL,NULL),
  ('sw_self_sponsored',6,'英国公司注册 + 虚拟地址','含首年地址',true,'首年含注册',44000,NULL,NULL),
  ('sw_self_sponsored',7,'Sponsor Licence 律师递交费','含 RFE 响应',true,'按案收费',500000,NULL,NULL);

-- 7. RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_third_party_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_proposals" ON proposals;
CREATE POLICY "admin_all_proposals" ON proposals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "public_read_proposal_by_token" ON proposals;
CREATE POLICY "public_read_proposal_by_token" ON proposals
  FOR SELECT USING (status != 'draft');

DROP POLICY IF EXISTS "admin_manage_tp_defaults" ON proposal_third_party_defaults;
CREATE POLICY "admin_manage_tp_defaults" ON proposal_third_party_defaults
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "public_read_tp_defaults" ON proposal_third_party_defaults;
CREATE POLICY "public_read_tp_defaults" ON proposal_third_party_defaults
  FOR SELECT USING (is_active = true);
