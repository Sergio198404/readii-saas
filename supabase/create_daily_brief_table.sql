-- ============================================================
-- Readii Sales — daily_brief 每日简报
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

create table if not exists public.daily_brief (
  id          uuid primary key default gen_random_uuid(),
  date        text not null,                            -- YYYY-MM-DD
  category    text not null,                            -- 英国签证动态 / 国内热点结合点 / 平台爆款参考
  title       text not null,
  summary     text,
  url         text,
  angle       text,                                     -- 结合 Readii 业务的角度
  created_at  timestamptz not null default now()
);

alter table public.daily_brief enable row level security;

create policy "Allow anon full access" on public.daily_brief
  for all
  using (true)
  with check (true);
