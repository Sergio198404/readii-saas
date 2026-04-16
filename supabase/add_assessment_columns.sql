-- v0.13.0: 问卷评估字段
alter table public.leads
  add column if not exists contact_info text,
  add column if not exists assessment_data jsonb;
