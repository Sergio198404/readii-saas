-- ============================================================
-- Readii Sales — settings 表（键值存储）
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null default '{}'::jsonb
);

-- 开启 RLS
alter table public.settings enable row level security;

-- 允许 anon 角色完全访问
create policy "Allow anon full access" on public.settings
  for all
  using (true)
  with check (true);
