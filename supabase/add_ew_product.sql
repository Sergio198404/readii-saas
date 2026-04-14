-- v0.7.0: 新增 EW（拓展工签）产品；GT 在 create_partner_platform_tables.sql 的初始 seed 里已存在
-- 使用 ON CONFLICT 保持幂等
insert into public.products (code, name_zh, name_en, type, base_price, commission_model) values
  ('EW', '拓展工签', 'Expansion Worker Visa', 'self_operated', 40000, '{"converter":0.50,"planner":0.30,"executor":0.20}'),
  ('GT', '全球人才签', 'Global Talent Visa',   'self_operated', 40000, '{"converter":0.50,"planner":0.30,"executor":0.20}')
on conflict (code) do nothing;
