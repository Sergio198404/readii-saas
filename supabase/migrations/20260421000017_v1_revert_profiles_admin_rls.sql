-- v1 Revert: Drop admin/staff read-all policies on profiles table.
-- Approach changed: instead of granting admin/staff RLS access on profiles,
-- frontend queries are refactored to do separate fetches (admin.js
-- listCustomerProfiles + getCustomerQuestionnaire). Each user reads only
-- their own profile row, matching the original minimal policy.

DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "staff_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;

-- Defensive cleanup (function never created in committed migrations, but
-- DROP IF EXISTS is a safe no-op if it doesn't exist)
DROP FUNCTION IF EXISTS is_admin_user();

-- Keep: users_read_own_profile and users_update_own_profile from migration 16
-- (these match the typical Supabase default and don't depend on admin/staff
-- detection — safe to retain).
