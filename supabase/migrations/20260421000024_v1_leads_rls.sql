-- v1 Leads RLS: partner isolation.
--   * Partners see / insert / update only their own leads (partner_id matches
--     the caller's partners.id).
--   * Admins and staff retain full or read access as before.
--   * No DELETE for partners (keep that admin-only — matches UI).
--
-- The leads table currently has no RLS policies; enabling RLS without a
-- complete set of policies would lock out admin flows. So we add all four
-- complementary policies in this migration.

-- 1. Ensure partner_id column exists (idempotent; already present on prod,
--    but keep this for fresh databases).
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id);

CREATE INDEX IF NOT EXISTS idx_leads_partner_id ON leads(partner_id);

-- 2. Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 3. Admin: full CRUD
DROP POLICY IF EXISTS "admin_all_leads" ON leads;
CREATE POLICY "admin_all_leads" ON leads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND (role_admin = true OR role = 'admin'))
  );

-- 4. Staff: read-only (StaffCustomerDetail may surface lead info)
DROP POLICY IF EXISTS "staff_read_all_leads" ON leads;
CREATE POLICY "staff_read_all_leads" ON leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role_staff = true)
  );

-- 5. Partner: read own
DROP POLICY IF EXISTS "partner_read_own_leads" ON leads;
CREATE POLICY "partner_read_own_leads" ON leads
  FOR SELECT USING (
    partner_id = (SELECT id FROM partners WHERE user_id = auth.uid())
  );

-- 6. Partner: insert with own partner_id enforced
DROP POLICY IF EXISTS "partner_insert_own_leads" ON leads;
CREATE POLICY "partner_insert_own_leads" ON leads
  FOR INSERT WITH CHECK (
    partner_id = (SELECT id FROM partners WHERE user_id = auth.uid())
  );

-- 7. Partner: update own leads (and cannot reassign partner_id to someone else)
DROP POLICY IF EXISTS "partner_update_own_leads" ON leads;
CREATE POLICY "partner_update_own_leads" ON leads
  FOR UPDATE
  USING (
    partner_id = (SELECT id FROM partners WHERE user_id = auth.uid())
  )
  WITH CHECK (
    partner_id = (SELECT id FROM partners WHERE user_id = auth.uid())
  );
