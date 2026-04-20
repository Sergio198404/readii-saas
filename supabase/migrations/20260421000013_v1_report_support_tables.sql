-- v1 Task 4b: Support tables for 6 additional report types
-- Adds: customer_appendix_a, key_personnel_reviews, ao_interview_scores,
--       applicant_interview_scores, customer_profiles.monthly_operations_data

-- ═══ Appendix A document checklist (per customer) ═══
CREATE TABLE IF NOT EXISTS customer_appendix_a (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  doc_code TEXT NOT NULL,
  doc_name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'verified', 'rejected')),
  file_url TEXT,
  file_name TEXT,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  expiry_date DATE,
  notes TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, doc_code)
);
CREATE INDEX IF NOT EXISTS idx_appx_customer ON customer_appendix_a(customer_id);

-- ═══ Key Personnel reviews ═══
CREATE TABLE IF NOT EXISTS key_personnel_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  roles TEXT[] NOT NULL,
  uk_settled_status TEXT CHECK (uk_settled_status IN ('british_citizen', 'ilr', 'eu_settled', 'innovator_visa', 'other')),
  uk_settled_evidence_url TEXT,
  dbs_check_completed BOOLEAN DEFAULT false,
  dbs_check_date DATE,
  dbs_check_result TEXT CHECK (dbs_check_result IN ('clear', 'has_record', 'pending')),
  bankruptcy_check_clear BOOLEAN,
  bankruptcy_check_date DATE,
  debt_relief_check_clear BOOLEAN,
  director_disqualified_check_clear BOOLEAN,
  historic_sponsor_check_clear BOOLEAN,
  employment_verified BOOLEAN,
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'passed', 'failed', 'action_required')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kp_customer ON key_personnel_reviews(customer_id);

-- ═══ AO interview scores (1 row per customer, up to 3 sessions) ═══
CREATE TABLE IF NOT EXISTS ao_interview_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  ao_name TEXT,
  session1_date DATE, session1_mode TEXT, session1_duration_minutes INT,
  session1_business_score INT, session1_role_score INT, session1_compliance_score INT, session1_english_score INT, session1_composure_score INT,
  session2_date DATE, session2_mode TEXT, session2_duration_minutes INT,
  session2_business_score INT, session2_role_score INT, session2_compliance_score INT, session2_english_score INT, session2_composure_score INT,
  session3_date DATE, session3_mode TEXT, session3_duration_minutes INT,
  session3_business_score INT, session3_role_score INT, session3_compliance_score INT, session3_english_score INT, session3_composure_score INT,
  weaknesses_notes TEXT,
  final_verdict TEXT CHECK (final_verdict IN ('pass', 'fail', 'needs_more')),
  consultant_name TEXT,
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id)
);

-- ═══ Applicant interview scores (1 row per customer, up to 2 sessions) ═══
CREATE TABLE IF NOT EXISTS applicant_interview_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  applicant_name TEXT,
  session1_date DATE, session1_mode TEXT, session1_duration_minutes INT,
  session1_consistency_score INT, session1_job_score INT, session1_employer_score INT, session1_lifestyle_score INT, session1_english_score INT,
  session2_date DATE, session2_mode TEXT, session2_duration_minutes INT,
  session2_consistency_score INT, session2_job_score INT, session2_employer_score INT, session2_lifestyle_score INT, session2_english_score INT,
  special_notes TEXT,
  final_verdict TEXT CHECK (final_verdict IN ('pass', 'fail', 'needs_more')),
  consultant_name TEXT,
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id)
);

-- ═══ Monthly operations data (for Report 7) ═══
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS monthly_operations_data JSONB DEFAULT '[]'::jsonb;
