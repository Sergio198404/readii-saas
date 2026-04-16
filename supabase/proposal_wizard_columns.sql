-- v0.11.0: 建议书分步向导所需的新字段
alter table public.proposals
  add column if not exists typical_disadvantages text[] default '{}',
  add column if not exists client_advantages text[] default '{}',
  add column if not exists selected_goals jsonb default '[]',
  add column if not exists metrics jsonb default '{}',
  add column if not exists selected_values jsonb default '[]',
  add column if not exists timeline jsonb default '[]',
  add column if not exists risk_note text,
  add column if not exists cover_tags text[] default '{}';
