-- ============================================================
-- Readii Sales — experts 专家库
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

create table if not exists public.experts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  style_prompt  text not null,
  use_cases     text[] not null default '{}',
  sample_input  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.experts enable row level security;

create policy "Allow anon full access" on public.experts
  for all
  using (true)
  with check (true);

-- 预置两个专家
insert into public.experts (name, description, style_prompt, use_cases) values
(
  'Dan Koe',
  '一人企业理论提出者，擅长将复杂商业概念转化为简洁有力的个人品牌内容',
  '你的写作风格模仿Dan Koe：开头用一个反直觉的断言或提问作为钩子，一句话一段，节奏短促有力。多用"你"直接对话读者，句式简短，不超过15字一句。语气自信、直接、略带挑衅，像一个成功的朋友在点醒你。结尾用一个行动号召或反问收束，不用"总结一下"这类表达。避免：长段落、被动语态、官方腔调、emoji堆砌。',
  ARRAY['口播稿', '文章', '朋友圈']
),
(
  'Readii默认',
  'Readii创始人Xiaoyu的真实风格，7年中英跨境咨询经验',
  '直接、真实、有温度，像一个有7年经验的从业者在跟朋友说话，不用专业术语堆砌，每段不超过3句，结尾不说教。',
  ARRAY['朋友圈', '口播稿', '文章', '销售策略']
);
