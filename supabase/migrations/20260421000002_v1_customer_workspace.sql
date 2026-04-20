-- v1 Migration 2: Customer workspace tables

CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN (
    'sw_self_sponsored', 'innovator_founder', 'expansion_worker', 'general_consulting'
  )),
  signed_date DATE NOT NULL,
  total_contract_value_pence INT,
  paid_amount_pence INT DEFAULT 0,
  current_stage_id UUID,
  expected_completion_date DATE,
  primary_consultant_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_user ON customer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_status ON customer_profiles(status);

CREATE TABLE IF NOT EXISTS journey_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  name TEXT NOT NULL,
  total_stages INT NOT NULL,
  estimated_weeks INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journey_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES journey_templates(id) ON DELETE CASCADE,
  stage_number INT NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  description_why TEXT NOT NULL,
  description_customer_action TEXT NOT NULL,
  description_readii_action TEXT NOT NULL,
  estimated_duration_days INT,
  deliverables TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, stage_number)
);

CREATE TABLE IF NOT EXISTS customer_journey_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES journey_stages(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'blocked_on_customer', 'blocked_on_readii', 'completed', 'skipped'
  )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  blocker_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_cjp_customer ON customer_journey_progress(customer_id);
CREATE INDEX IF NOT EXISTS idx_cjp_status ON customer_journey_progress(status);

CREATE TABLE IF NOT EXISTS customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES journey_stages(id),
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes BIGINT,
  category TEXT CHECK (category IN (
    'contract', 'visa_application', 'company_documents', 'financial',
    'identity', 'correspondence', 'review_report', 'other'
  )),
  description TEXT,
  is_visible_to_customer BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_docs_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_docs_stage ON customer_documents(stage_id);

CREATE TABLE IF NOT EXISTS customer_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES profiles(id),
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES profiles(id),
  answered_at TIMESTAMPTZ,
  related_stage_id UUID REFERENCES journey_stages(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'archived')),
  is_reusable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_qa_customer ON customer_qa(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_qa_status ON customer_qa(status);

CREATE TABLE IF NOT EXISTS customer_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  scheduled_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  meeting_link TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  timezone TEXT,
  agenda TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'
  )),
  notes_before TEXT,
  notes_after TEXT,
  related_stage_id UUID REFERENCES journey_stages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_customer ON customer_meetings(customer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON customer_meetings(scheduled_at);
