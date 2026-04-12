-- Readii 长远架构：用户/伙伴/产品/成交/分成
-- 不改动既有 leads / experts / content_topics / daily_brief / settings 表结构
-- 仅对 leads 做新增列（ADD COLUMN IF NOT EXISTS）

-- 1. 用户档案表（扩展 Supabase Auth）
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'partner' check (role in ('admin', 'partner', 'client')),
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. 渠道伙伴表
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  level int not null default 1 check (level between 1 and 10),
  multiplier numeric(3,1) generated always as (1.0 + (level - 1) * (1.0 / 9.0)) stored,
  referral_code text unique not null,
  referral_url text,
  commission_rate numeric(4,3) not null default 0.05,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now()
);

-- 3. 产品表
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_zh text not null,
  name_en text,
  type text not null check (type in ('self_operated', 'referral', 'standard')),
  base_price numeric(10,2),
  platform_rate numeric(4,3) not null default 0.30,
  commission_model jsonb not null default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 预置产品数据
insert into public.products (code, name_zh, name_en, type, base_price, commission_model) values
('IFV', '创新签', 'Innovator Founder Visa', 'self_operated', 60000, '{"converter":0.50,"planner":0.30,"executor":0.20}'),
('SW', '自担保工签', 'Self-Sponsored Work Visa', 'self_operated', 35000, '{"converter":0.50,"planner":0.30,"executor":0.20}'),
('GT', '全球人才签', 'Global Talent Visa', 'self_operated', 40000, '{"converter":0.50,"planner":0.30,"executor":0.20}'),
('Student', '学签/陪读', 'Student/Dependent Visa', 'self_operated', 8000, '{"converter":0.50,"planner":0.30,"executor":0.20}'),
('PlanB', '路线图评估', 'Route Assessment', 'standard', 500, '{"fixed_commission":50}'),
('Property', '英国房产', 'UK Property', 'referral', null, '{"converter":1.0}');

-- 4. 成交记录表
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  product_id uuid references public.products(id),
  contract_amount numeric(10,2) not null,
  paid_amount numeric(10,2) default 0,
  platform_amount numeric(10,2) generated always as (contract_amount * 0.30) stored,
  distributable_amount numeric(10,2) generated always as (contract_amount * 0.70) stored,
  status text not null default 'pending' check (status in ('pending','active','completed','cancelled')),
  signed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- 5. 分成角色表（每单参与者）
create table public.deal_roles (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  user_id uuid references public.profiles(id),
  role text not null check (role in (
    'lead_recorder','first_consult','converter',
    'plan_assessor','plan_designer','plan_finalizer',
    'exec_material','exec_submitter','exec_follower'
  )),
  share_rate numeric(5,4),
  amount numeric(10,2),
  status text not null default 'pending' check (status in ('pending','confirmed','paid')),
  confirmed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- 6. leads 表扩展（加归属字段）
alter table public.leads
  add column if not exists partner_id uuid references public.partners(id),
  add column if not exists product_id uuid references public.products(id),
  add column if not exists recorder_id uuid references public.profiles(id),
  add column if not exists first_consult_id uuid references public.profiles(id),
  add column if not exists converter_id uuid references public.profiles(id);

-- 7. RLS 策略
alter table public.profiles enable row level security;
alter table public.partners enable row level security;
alter table public.products enable row level security;
alter table public.deals enable row level security;
alter table public.deal_roles enable row level security;

-- profiles: 自己看自己，admin 看全部
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id);

-- partners: admin 看全部，partner 看自己
create policy "partners_admin" on public.partners
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "partners_self" on public.partners
  for select using (user_id = auth.uid());

-- products: 所有登录用户可读
create policy "products_read" on public.products
  for select using (auth.role() = 'authenticated');

-- deals: admin 看全部，partner 看自己参与的
create policy "deals_admin" on public.deals
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "deals_partner" on public.deals
  for select using (
    exists (
      select 1 from public.deal_roles
      where deal_id = deals.id and user_id = auth.uid()
    )
  );

-- leads: admin 看全部，partner 只看自己录入的
create policy "leads_admin" on public.leads
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "leads_partner" on public.leads
  for all using (
    partner_id in (
      select id from public.partners where user_id = auth.uid()
    )
  );
