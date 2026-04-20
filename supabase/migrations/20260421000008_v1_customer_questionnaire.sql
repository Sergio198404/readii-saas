-- v1 Task 3: Customer profile questionnaire fields + variant selection
-- Extends customer_profiles with 10-question answers and computed fields.
-- Adds selected_variant column to customer_journey_progress (per-stage variant).

ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS questionnaire_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS questionnaire_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS questionnaire_completed_by UUID REFERENCES profiles(id),
  -- Q1
  ADD COLUMN IF NOT EXISTS employee_location TEXT CHECK (employee_location IN (
    'uk_psw', 'uk_other', 'overseas'
  )),
  -- Q2
  ADD COLUMN IF NOT EXISTS employee_nationality TEXT CHECK (employee_nationality IN (
    'cn_mainland', 'cn_hk_mo', 'tw', 'english_native', 'other'
  )),
  -- Q3
  ADD COLUMN IF NOT EXISTS current_visa_remaining_months TEXT CHECK (current_visa_remaining_months IN (
    'lt_6', '6_to_12', 'gt_12', 'na'
  )),
  -- Q4
  ADD COLUMN IF NOT EXISTS employee_english_status TEXT CHECK (employee_english_status IN (
    'uk_degree', 'english_native', 'ecctis', 'has_valid_score', 'need_exam'
  )),
  -- Q5
  ADD COLUMN IF NOT EXISTS target_soc_code TEXT,
  ADD COLUMN IF NOT EXISTS requires_criminal_record BOOLEAN DEFAULT false,
  -- Q6
  ADD COLUMN IF NOT EXISTS countries_lived TEXT[],
  -- Q7
  ADD COLUMN IF NOT EXISTS startup_capital TEXT CHECK (startup_capital IN (
    'lt_50k', '50k_to_100k', 'gt_100k'
  )),
  -- Q8
  ADD COLUMN IF NOT EXISTS company_structure TEXT CHECK (company_structure IN (
    'investor_only', 'investor_plus_employee'
  )),
  -- Q9
  ADD COLUMN IF NOT EXISTS ao_candidate TEXT CHECK (ao_candidate IN (
    'investor', 'employee', 'third_party', 'undecided'
  )),
  -- Q10
  ADD COLUMN IF NOT EXISTS needs_mentoring BOOLEAN DEFAULT false,
  -- Computed by rule engine
  ADD COLUMN IF NOT EXISTS visa_path TEXT CHECK (visa_path IN ('a_inside_uk', 'b_outside_uk')),
  ADD COLUMN IF NOT EXISTS requires_tb_test BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS timeline_hints JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]'::jsonb;

ALTER TABLE customer_journey_progress
  ADD COLUMN IF NOT EXISTS selected_variant TEXT;
