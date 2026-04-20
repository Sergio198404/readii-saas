-- v1 Fix: Admin RLS policies + role_admin backfill
-- Problem: policies from 000005 only check role_admin=true.
--   Admin accounts with role='admin' but role_admin=false (default) are blocked.
--   Cause: useAuth.ensureProfile() creates new admin profiles with role='admin' only.
-- Fix: (1) backfill role_admin for any user with role='admin';
--      (2) rewrite admin RLS policies to accept either role='admin' OR role_admin=true.

-- ═══ (1) Backfill ═══
UPDATE profiles SET role_admin = true WHERE role = 'admin' AND role_admin IS DISTINCT FROM true;

-- ═══ (2) Replace admin RLS policies to accept either flag ═══

DROP POLICY IF EXISTS "admin_all_customers" ON customer_profiles;
CREATE POLICY "admin_all_customers" ON customer_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "journey_templates_admin" ON journey_templates;
CREATE POLICY "journey_templates_admin" ON journey_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "journey_stages_admin" ON journey_stages;
CREATE POLICY "journey_stages_admin" ON journey_stages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "admin_all_progress" ON customer_journey_progress;
CREATE POLICY "admin_all_progress" ON customer_journey_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "admin_all_docs" ON customer_documents;
CREATE POLICY "admin_all_docs" ON customer_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "customers_own_qa" ON customer_qa;
CREATE POLICY "customers_own_qa" ON customer_qa
  FOR ALL USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "admin_all_meetings" ON customer_meetings;
CREATE POLICY "admin_all_meetings" ON customer_meetings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "admin_all_partners_v1" ON partner_profiles;
CREATE POLICY "admin_all_partners_v1" ON partner_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

-- Also fix RLS on v1 Task 4a/4b tables (hr_compliance, generated_reports, etc.)
-- Enable RLS first (these tables don't have it yet; task 4a only created storage policies)

ALTER TABLE hr_compliance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_items_read_all" ON hr_compliance_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_items_admin" ON hr_compliance_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

ALTER TABLE customer_hr_compliance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chc_own" ON customer_hr_compliance
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "chc_admin" ON customer_hr_compliance
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_own" ON generated_reports
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "reports_admin" ON generated_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

ALTER TABLE stage_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants_read_all" ON stage_variants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "variants_admin" ON stage_variants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

ALTER TABLE customer_appendix_a ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appx_own" ON customer_appendix_a
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "appx_admin" ON customer_appendix_a
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

ALTER TABLE key_personnel_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kp_admin" ON key_personnel_reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

ALTER TABLE ao_interview_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ao_scores_admin" ON ao_interview_scores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );

ALTER TABLE applicant_interview_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applicant_scores_admin" ON applicant_interview_scores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role_admin = true OR role = 'admin'))
  );
