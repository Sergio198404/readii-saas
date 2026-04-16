-- v0.9.0: Stripe 支付集成所需字段
alter table public.proposals
  add column if not exists client_email text,
  add column if not exists stripe_session_id text,
  add column if not exists stripe_subscription_id text;
