-- v0.6.0: 补 deal_roles 的 RLS 策略（之前只 enable 了 RLS 但没写策略，partner 完全读不到自己的分成记录）
-- 同时副作用：deals_partner 策略里的 exists 子查询原本也跑不通，partner 连自己参与的 deals 都看不见

create policy "deal_roles_admin" on public.deal_roles
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "deal_roles_self" on public.deal_roles
  for select using (user_id = auth.uid());
