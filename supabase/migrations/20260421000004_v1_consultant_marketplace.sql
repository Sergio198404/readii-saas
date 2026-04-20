-- v1 Migration 4: Consultant marketplace tables

CREATE TABLE IF NOT EXISTS consultant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  headline TEXT NOT NULL,
  bio TEXT NOT NULL,
  avatar_url TEXT,
  uk_city TEXT NOT NULL,
  years_in_uk INT,
  visa_types_experienced TEXT[],
  industries TEXT[],
  languages TEXT[] DEFAULT ARRAY['zh-CN', 'en-GB'],
  hourly_rate_pence INT DEFAULT 19900,
  min_booking_duration_minutes INT DEFAULT 60,
  max_bookings_per_week INT DEFAULT 5,
  stripe_connect_account_id TEXT,
  status TEXT DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'active', 'paused', 'suspended'
  )),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  total_bookings INT DEFAULT 0,
  total_revenue_earned_pence INT DEFAULT 0,
  average_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultant_status ON consultant_profiles(status);
CREATE INDEX IF NOT EXISTS idx_consultant_city ON consultant_profiles(uk_city);

CREATE TABLE IF NOT EXISTS consultation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES consultation_categories(id),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Initial categories
INSERT INTO consultation_categories (code, name, description, sort_order) VALUES
  ('visa_experience', '签证亲历', '过来人讲自己办签证的真实经历', 1),
  ('entrepreneurship', '创业经验', '在英国创立和运营公司的一手经验', 2),
  ('industry_specific', '行业经验', '特定行业在英国的创业和运营', 3),
  ('local_life', '当地生活', '在特定城市的落地和生活经验', 4)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS consultant_categories (
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES consultation_categories(id),
  PRIMARY KEY (consultant_id, category_id)
);

CREATE TABLE IF NOT EXISTS consultant_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT DEFAULT 'Europe/London',
  is_recurring BOOLEAN DEFAULT true,
  specific_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultation_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE NOT NULL,
  customer_user_id UUID NOT NULL REFERENCES profiles(id),
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id),
  category_id UUID REFERENCES consultation_categories(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  meeting_link TEXT,
  customer_questions TEXT,
  consultant_notes TEXT,
  price_pence INT NOT NULL,
  readii_fee_pence INT NOT NULL,
  consultant_earnings_pence INT NOT NULL,
  referred_by_partner_id UUID REFERENCES partner_profiles(id),
  partner_commission_pence INT DEFAULT 0,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'paid', 'refunded', 'failed'
  )),
  booking_status TEXT DEFAULT 'pending_payment' CHECK (booking_status IN (
    'pending_payment', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
  )),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer ON consultation_bookings(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_consultant ON consultation_bookings(consultant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON consultation_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON consultation_bookings(booking_status);

CREATE TABLE IF NOT EXISTS consultation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES consultation_bookings(id),
  reviewer_user_id UUID NOT NULL REFERENCES profiles(id),
  consultant_id UUID NOT NULL REFERENCES consultant_profiles(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_consultant ON consultation_reviews(consultant_id);
