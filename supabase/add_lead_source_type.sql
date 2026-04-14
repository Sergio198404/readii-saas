-- v0.5.0: 线索归属字段
-- source_type: 来源类型（专属链接 / 直接录入 / 内容引流 / 朋友介绍）
alter table public.leads
  add column if not exists source_type text
    check (source_type in ('ref_link', 'direct', 'content', 'referral'))
    default 'direct';
