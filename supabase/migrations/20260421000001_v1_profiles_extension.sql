-- v1 Migration 1: Extend profiles with multi-role flags
-- full_name and avatar_url already exist from v0.1.0, using IF NOT EXISTS

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_customer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_partner BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_consultant BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'zh-CN',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Shanghai',
  ADD COLUMN IF NOT EXISTS wechat_id TEXT;

-- Backfill: existing admin users get role_admin = true
UPDATE profiles SET role_admin = true WHERE role = 'admin';
UPDATE profiles SET role_partner = true WHERE role = 'partner';
