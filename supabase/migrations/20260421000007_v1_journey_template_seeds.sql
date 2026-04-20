-- v1 Task 4: Seed journey templates (stages to be filled via admin UI)
INSERT INTO journey_templates (service_type, name, total_stages, estimated_weeks)
VALUES
  ('sw_self_sponsored', '自雇工签全流程', 0, 24),
  ('innovator_founder', '创新签全流程', 0, 36)
ON CONFLICT DO NOTHING;
