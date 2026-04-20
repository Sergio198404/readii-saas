-- v1 Migration 6: Helper functions and triggers

CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  seq_num INT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO seq_num
    FROM consultation_bookings
    WHERE booking_number LIKE 'RC-' || date_part || '%';
  RETURN 'RC-' || date_part || '-' || LPAD(seq_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_referral_code(name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  seq_num INT := 0;
BEGIN
  base_code := 'READII-' || UPPER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) || '-' || TO_CHAR(NOW(), 'YYYY');
  final_code := base_code;
  WHILE EXISTS (SELECT 1 FROM partner_profiles WHERE referral_code = final_code) LOOP
    seq_num := seq_num + 1;
    final_code := base_code || '-' || seq_num;
  END LOOP;
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_consultant_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_status = 'completed' AND OLD.booking_status != 'completed' THEN
    UPDATE consultant_profiles
    SET total_bookings = total_bookings + 1,
        total_revenue_earned_pence = total_revenue_earned_pence + NEW.consultant_earnings_pence
    WHERE id = NEW.consultant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_consultant_stats ON consultation_bookings;
CREATE TRIGGER tr_update_consultant_stats
  AFTER UPDATE ON consultation_bookings
  FOR EACH ROW EXECUTE FUNCTION update_consultant_stats();
