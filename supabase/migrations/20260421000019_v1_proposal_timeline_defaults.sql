-- v1 Proposal wizard step 2-3 support:
--   * Extend proposals with plan name/description + payment trigger columns
--     (the 5-step wizard now captures richer copy than just two prices)
--   * New proposal_timeline_defaults table (admin-editable defaults for
--     wizard step 3, per service_type) + seed for IFV and SW

-- 1. Extend proposals for the richer step 2 / step 3 payloads
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS recommended_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS recommended_plan_desc TEXT,
  ADD COLUMN IF NOT EXISTS anchor_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS anchor_plan_desc TEXT,
  ADD COLUMN IF NOT EXISTS payment_1_trigger TEXT,
  ADD COLUMN IF NOT EXISTS payment_2_trigger TEXT;

-- 2. Timeline defaults table (one row per default timeline step, per service_type)
CREATE TABLE IF NOT EXISTS proposal_timeline_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL CHECK (service_type IN (
    'sw_self_sponsored','ifv_innovator','ew_expansion','gt_global_talent','plan_b'
  )),
  item_order INT DEFAULT 0,
  month_label TEXT NOT NULL,
  task_name TEXT NOT NULL,
  task_sub TEXT,
  is_key_milestone BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tl_defaults_type
  ON proposal_timeline_defaults(service_type, item_order);

-- 3. Seed: IFV innovator visa
INSERT INTO proposal_timeline_defaults
  (service_type, item_order, month_label, task_name, task_sub, is_key_milestone)
VALUES
  ('ifv_innovator',1,'第 1 个月','商业叙事构建','Readii 视频通话 × 2，输出叙事框架文档；锁定目标背书机构',true),
  ('ifv_innovator',2,'第 2–3 个月','商业计划书 + 支撑材料撰写','使用 Readii 文案模板，按叙事框架逐步完成；Readii 书面审核一次',false),
  ('ifv_innovator',3,'第 4 个月','背书机构面试 + 提交申请','使用 Readii 面试题库做模拟练习；通过后取得 Endorsement Letter',true),
  ('ifv_innovator',4,'第 5 个月','英国公司注册 + 银行开户','Readii 介绍合作会计楼，全程协助完成注册与开户',false),
  ('ifv_innovator',5,'第 6–7 个月','签证主申请提交','Readii 终审全套材料；Home Office 审理期约 8 周',true),
  ('ifv_innovator',6,'第 8 个月','签证获批，入境英国',NULL,false);

-- 4. Seed: self-sponsored worker visa
INSERT INTO proposal_timeline_defaults
  (service_type, item_order, month_label, task_name, task_sub, is_key_milestone)
VALUES
  ('sw_self_sponsored',1,'第 1–2 个月','公司注册 + 银行开户 + 税务注册','协调会计事务所完成全部注册手续',false),
  ('sw_self_sponsored',2,'第 2–3 个月','HR 合规 22 项 + 基础运营建设','完成雇员合规体系；官网/邮箱/Logo/BP 制定',false),
  ('sw_self_sponsored',3,'第 3–9 个月','业务运营 + 营业额积累','真实运营，积累 6–12 个月银行流水记录',true),
  ('sw_self_sponsored',4,'第 9 个月','财务健康检查 + Appendix A 文件准备','Readii 合规团队核查全套材料',true),
  ('sw_self_sponsored',5,'第 10–11 个月','Sponsor Licence 申请递交','律所递交；UKVI 审理期约 8–12 周',true),
  ('sw_self_sponsored',6,'第 12–13 个月','CoS 分配 + 工签递交','获批后分配 CoS，雇员递交 Skilled Worker 工签',false),
  ('sw_self_sponsored',7,'第 13–14 个月','工签获批，入境或转签',NULL,false);

-- 5. RLS
ALTER TABLE proposal_timeline_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_tl_defaults" ON proposal_timeline_defaults;
CREATE POLICY "admin_manage_tl_defaults" ON proposal_timeline_defaults
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "public_read_tl_defaults" ON proposal_timeline_defaults;
CREATE POLICY "public_read_tl_defaults" ON proposal_timeline_defaults
  FOR SELECT USING (is_active = true);
