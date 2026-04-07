-- ============================================================
-- Readii Sales — leads 表
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  channel     text,                                  -- 来源渠道：小红书、朋友介绍…
  p           text not null default 'P2',            -- 优先级：P1 / P2 / P3
  s           text not null default 'S0',            -- 阶段：S0–S5
  prod        text,                                  -- 产品：IFV / SW / GT / Student / PlanB / ?
  b           text default 'B0',                     -- 预算：B0–B4
  exp         text,                                  -- 签证到期 YYYYMM
  goal        text,                                  -- 目标月份 YYYYMM
  "next"      text,                                  -- 下一步动作：Call / Docs / Pay / Intro / Wait
  follow      text,                                  -- 跟进日期 MMDD
  note        text,                                  -- 一句话进度
  updates     jsonb not null default '[]'::jsonb,     -- 更新历史 [{date, note}]
  created_at  timestamptz not null default now()
);

-- 开启 Row Level Security
alter table public.leads enable row level security;

-- 允许 anon 角色完全访问（单用户 CRM，无需复杂权限）
create policy "Allow anon full access" on public.leads
  for all
  using (true)
  with check (true);

-- 开启 Realtime 推送
alter publication supabase_realtime add table public.leads;
