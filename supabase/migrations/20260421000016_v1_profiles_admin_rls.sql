-- v1 Fix: Profiles table RLS — allow admin + staff to read all profile rows.
-- Root cause: queries like `customer_profiles.select('*, profiles:user_id(...)')`
--   do an INNER JOIN because user_id is NOT NULL. If the admin can't SELECT the
--   referenced profile row, the whole customer_profiles row is dropped and shown
--   as "no data found" on the frontend.
-- Fix: grant admin and staff SELECT access on profiles while preserving
--   each-user-reads-own-row policy.
--
-- Note: `CREATE POLICY IF NOT EXISTS` is not supported in PostgreSQL 15/16
-- (Supabase baseline). Using DROP POLICY IF EXISTS + CREATE POLICY for idempotency.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles self
      WHERE self.id = auth.uid()
        AND (self.role_admin = true OR self.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "staff_read_all_profiles" ON profiles;
CREATE POLICY "staff_read_all_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles self
      WHERE self.id = auth.uid()
        AND self.role_staff = true
    )
  );

-- Also allow admin to update any profile (for promoting/demoting staff roles etc.)
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
CREATE POLICY "admin_update_all_profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles self
      WHERE self.id = auth.uid()
        AND (self.role_admin = true OR self.role = 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles self
      WHERE self.id = auth.uid()
        AND (self.role_admin = true OR self.role = 'admin')
    )
  );

-- Each user can update their own profile
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
