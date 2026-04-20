-- v1 Task 4a: HR compliance sub-module (26 items across 4 phases)
-- Also creates generated_reports table and Storage buckets for evidence + reports.

CREATE TABLE IF NOT EXISTS hr_compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT UNIQUE NOT NULL,
  phase_number INT NOT NULL CHECK (phase_number BETWEEN 1 AND 4),
  item_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  compliance_basis TEXT,
  template_url TEXT,
  evidence_type TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'path_a', 'path_b', 'conditional')),
  is_signoff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_hr_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES hr_compliance_items(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'waived')),
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  evidence_url TEXT,
  evidence_file_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_chc_customer ON customer_hr_compliance(customer_id);
CREATE INDEX IF NOT EXISTS idx_chc_status ON customer_hr_compliance(status);

CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  generated_by UUID REFERENCES profiles(id),
  is_latest BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_customer ON generated_reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON generated_reports(report_type);

-- Storage buckets (Supabase)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-compliance-docs', 'hr-compliance-docs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies: admin can read/write; customers can read/write their own dir
-- (Policies rely on profiles.role_admin from task 2 and customer_profiles.user_id)
CREATE POLICY "admin full access hr docs" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'hr-compliance-docs' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND (role_admin = true OR role = 'admin')
  ))
  WITH CHECK (bucket_id = 'hr-compliance-docs' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND (role_admin = true OR role = 'admin')
  ));

CREATE POLICY "customer own hr docs" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'hr-compliance-docs'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM customer_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'hr-compliance-docs'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM customer_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admin full access reports" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'reports' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND (role_admin = true OR role = 'admin')
  ))
  WITH CHECK (bucket_id = 'reports' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND (role_admin = true OR role = 'admin')
  ));

CREATE POLICY "customer read own reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM customer_profiles WHERE user_id = auth.uid()
    )
  );
