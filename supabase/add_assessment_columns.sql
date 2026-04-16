-- v0.13.0 + v0.13.1: 问卷评估字段
alter table public.leads
  add column if not exists contact_info text,
  add column if not exists assessment_data jsonb,
  add column if not exists family_flag boolean default false,
  add column if not exists readiness text;
