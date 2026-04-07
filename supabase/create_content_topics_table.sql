-- ============================================================
-- Readii Sales — content_topics 选题库
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

create table if not exists public.content_topics (
  id            uuid primary key default gen_random_uuid(),
  topic         text not null,                          -- 选题标题
  source_count  integer not null default 1,             -- 来源客户数
  platform      text not null default '抖音',            -- 平台：抖音/视频号/小红书
  angle         text,                                   -- 内容角度
  status        text not null default '待创作',          -- 状态：待创作/已发布
  created_at    timestamptz not null default now()
);

alter table public.content_topics enable row level security;

create policy "Allow anon full access" on public.content_topics
  for all
  using (true)
  with check (true);

alter publication supabase_realtime add table public.content_topics;
