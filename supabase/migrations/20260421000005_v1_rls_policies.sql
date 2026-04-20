-- v1 Migration 5: RLS policies for all new tables

-- Customer profiles
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_own_profile" ON customer_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin_all_customers" ON customer_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Journey templates: all authenticated users can read
ALTER TABLE journey_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey_templates_read" ON journey_templates
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "journey_templates_admin" ON journey_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Journey stages: all authenticated users can read
ALTER TABLE journey_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey_stages_read" ON journey_stages
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "journey_stages_admin" ON journey_stages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Customer journey progress
ALTER TABLE customer_journey_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_own_progress" ON customer_journey_progress
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "admin_all_progress" ON customer_journey_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Customer documents
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

-- Customer QA
ALTER TABLE customer_qa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_own_qa" ON customer_qa
  FOR ALL USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Customer meetings
ALTER TABLE customer_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_own" ON customer_meetings
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "admin_all_meetings" ON customer_meetings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Partner profiles
ALTER TABLE partner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_own_profile" ON partner_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin_all_partners_v1" ON partner_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Marketing assets
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

-- Partner leads
ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_own_leads_v1" ON partner_leads
  FOR ALL USING (
    partner_id IN (SELECT id FROM partner_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- FAQ knowledge
ALTER TABLE faq_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faq_all_read" ON faq_knowledge
  FOR SELECT USING (is_public = true);
CREATE POLICY "faq_admin_write" ON faq_knowledge
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Partner commissions
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions_own" ON partner_commissions
  FOR SELECT USING (
    partner_id IN (SELECT id FROM partner_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "admin_all_commissions" ON partner_commissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Consultant profiles
ALTER TABLE consultant_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consultants_public_read" ON consultant_profiles
  FOR SELECT USING (status = 'active');
CREATE POLICY "consultants_own_write" ON consultant_profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "admin_all_consultants" ON consultant_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Consultation categories: public read
ALTER TABLE consultation_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON consultation_categories
  FOR SELECT USING (is_active = true);
CREATE POLICY "categories_admin" ON consultation_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Consultant categories: public read
ALTER TABLE consultant_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consultant_cats_read" ON consultant_categories
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "consultant_cats_admin" ON consultant_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Consultant availability
ALTER TABLE consultant_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "availability_public_read" ON consultant_availability
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "availability_own_write" ON consultant_availability
  FOR ALL USING (
    consultant_id IN (SELECT id FROM consultant_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );

-- Consultation bookings
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

-- Consultation reviews
ALTER TABLE consultation_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON consultation_reviews
  FOR SELECT USING (is_public = true);
CREATE POLICY "reviews_own_write" ON consultation_reviews
  FOR INSERT WITH CHECK (reviewer_user_id = auth.uid());
CREATE POLICY "admin_all_reviews" ON consultation_reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_admin = true)
  );
