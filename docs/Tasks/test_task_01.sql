-- 验证表创建
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'customer_profiles', 'journey_templates', 'journey_stages',
    'customer_journey_progress', 'customer_documents', 'customer_qa',
    'customer_meetings',
    'partner_profiles', 'marketing_assets', 'partner_leads',
    'lead_conversations', 'faq_knowledge', 'partner_commissions',
    'consultant_profiles', 'consultation_categories', 'consultant_categories',
    'consultant_availability', 'consultation_bookings', 'consultation_reviews'
  )
  ORDER BY table_name;

-- 验证 RLS 启用
SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('customer_profiles', 'customer_qa', 'partner_leads',
    'consultant_profiles', 'consultation_bookings');

-- 验证 consultation_categories 初始数据
SELECT * FROM consultation_categories ORDER BY sort_order;

-- 验证函数
SELECT generate_referral_code('TestName');
SELECT generate_booking_number();

-- 验证 profiles 扩展字段
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'profiles'
  AND column_name IN ('role_customer', 'role_partner', 'role_consultant', 'role_admin', 'wechat_id')
  ORDER BY column_name;
