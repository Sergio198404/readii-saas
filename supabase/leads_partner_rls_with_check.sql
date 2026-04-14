-- v0.5.1: partner 角色 INSERT/UPDATE leads 时必须保证 partner_id 是自己
-- 原策略只有 using，对 INSERT 的新行校验不明确，补一条 with check
drop policy if exists "leads_partner" on public.leads;

create policy "leads_partner" on public.leads
  for all
  using (
    partner_id in (
      select id from public.partners where user_id = auth.uid()
    )
  )
  with check (
    partner_id in (
      select id from public.partners where user_id = auth.uid()
    )
  );
