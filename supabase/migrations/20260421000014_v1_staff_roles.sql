-- v1 Task 4c: Internal staff roles (Kelly/Lisa/Tim/Ryan)
-- Adds role_staff + staff_role to profiles; staff-wide read policies on core tables.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_staff BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_role TEXT CHECK (staff_role IN (
    'copywriter', 'project_manager', 'customer_manager', 'bdm'
  ));

-- Staff read policies: all role_staff=true users can read all customer-side data
-- (writes are gated in the frontend via staffPermissions.js — v1 keeps DB policies simple)

CREATE POLICY "staff_read_customer_profiles" ON customer_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role_staff = true
  ));

CREATE POLICY "staff_read_journey_progress" ON customer_journey_progress
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role_staff = true
  ));

CREATE POLICY "staff_read_customer_qa" ON customer_qa
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role_staff = true
  ));

CREATE POLICY "staff_read_customer_docs" ON customer_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role_staff = true
  ));

CREATE POLICY "staff_read_customer_meetings" ON customer_meetings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role_staff = true
  ));

CREATE POLICY "staff_read_hr_compliance" ON customer_hr_compliance
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role_staff = true
  ));

CREATE POLICY "staff_read_generated_reports" ON generated_reports
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role_staff = true
  ));

-- Write policies for staff: Tim (customer_manager) + Lisa (project_manager) can update progress/QA
-- Kelly (copywriter) + Tim (customer_manager) can write QA answers
-- All staff can insert documents (uploadDocs: true for all)

CREATE POLICY "staff_update_journey_progress" ON customer_journey_progress
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role_staff = true AND staff_role IN ('project_manager', 'customer_manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role_staff = true AND staff_role IN ('project_manager', 'customer_manager')
  ));

CREATE POLICY "staff_update_customer_qa" ON customer_qa
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role_staff = true AND staff_role IN ('copywriter', 'project_manager', 'customer_manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role_staff = true AND staff_role IN ('copywriter', 'project_manager', 'customer_manager')
  ));

CREATE POLICY "staff_update_hr_compliance" ON customer_hr_compliance
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role_staff = true AND staff_role = 'project_manager'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role_staff = true AND staff_role = 'project_manager'
  ));

CREATE POLICY "staff_update_customer_monthly_ops" ON customer_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role_staff = true AND staff_role = 'bdm'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role_staff = true AND staff_role = 'bdm'
  ));
