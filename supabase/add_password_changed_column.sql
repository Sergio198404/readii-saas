-- v0.4.0: 强制首次改密流程需要的字段
-- 默认 true：已存在的 profiles 与自注册用户均视为已自行设置过密码
-- 仅 create-partner 函数创建的 partner 会显式写入 false
alter table public.profiles
  add column if not exists password_changed boolean not null default true;
