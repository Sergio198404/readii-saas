-- v1 Task 4: Variant system + stage content extensions
-- Adds stage_code/applies_to/SKU/sub_module fields on journey_stages,
-- creates stage_variants table, and extends customer_journey_progress
-- with selected_variant_id (UUID FK) + service_mode (self/delegate).

ALTER TABLE journey_stages
  ADD COLUMN IF NOT EXISTS stage_code TEXT,
  ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'always' CHECK (
    applies_to IN ('always', 'path_a', 'path_b', 'conditional')
  ),
  ADD COLUMN IF NOT EXISTS has_sku BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sku_self_serve_label TEXT,
  ADD COLUMN IF NOT EXISTS sku_delegate_label TEXT,
  ADD COLUMN IF NOT EXISTS sku_price_pence INT,
  ADD COLUMN IF NOT EXISTS sku_member_price_pence INT,
  ADD COLUMN IF NOT EXISTS sku_self_serve_content TEXT,
  ADD COLUMN IF NOT EXISTS has_sub_module BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_module_type TEXT;

-- stage_code is unique within a template (not global) so admins can clone
-- templates in future without collision. Enforce with a partial unique index
-- per template.
CREATE UNIQUE INDEX IF NOT EXISTS idx_journey_stages_tpl_code
  ON journey_stages(template_id, stage_code)
  WHERE stage_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS stage_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
  variant_code TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  trigger_field TEXT NOT NULL,
  trigger_value TEXT NOT NULL,
  title TEXT NOT NULL,
  description_why TEXT NOT NULL DEFAULT '',
  description_customer_action TEXT NOT NULL DEFAULT '',
  description_readii_action TEXT NOT NULL DEFAULT '',
  estimated_duration_days INT,
  deliverables TEXT[],
  warnings TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stage_id, variant_code)
);

CREATE INDEX IF NOT EXISTS idx_variants_stage ON stage_variants(stage_id);

ALTER TABLE customer_journey_progress
  ADD COLUMN IF NOT EXISTS selected_variant_id UUID REFERENCES stage_variants(id),
  ADD COLUMN IF NOT EXISTS service_mode TEXT DEFAULT 'self' CHECK (
    service_mode IN ('self', 'delegate', 'not_applicable')
  ),
  ADD COLUMN IF NOT EXISTS service_mode_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_mode_confirmed_at TIMESTAMPTZ;

-- Ensure sw_self_sponsored template exists with 24 stages planned
UPDATE journey_templates
  SET total_stages = 24, estimated_weeks = 60
  WHERE service_type = 'sw_self_sponsored';
