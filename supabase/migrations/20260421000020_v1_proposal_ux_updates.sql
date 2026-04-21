-- v1 Proposal UX updates:
--   * Extend decision window from 48h to 120h (5 days)
--   * Add original_price_pence + promo_price_pence columns for urgency display
--   * Default payment_1_pence to £1,000 (100000 pence), down from £1,500

-- 1. Replace the default-setter trigger function to use 120 hours
CREATE OR REPLACE FUNCTION set_proposal_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token IS NULL THEN
    LOOP
      NEW.token := generate_proposal_token();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM proposals WHERE token = NEW.token);
    END LOOP;
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '120 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Promo pricing columns (both nullable; UI only renders when set)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS original_price_pence INT,
  ADD COLUMN IF NOT EXISTS promo_price_pence INT;

-- 3. Lower first payment default to £1,000
ALTER TABLE proposals
  ALTER COLUMN payment_1_pence SET DEFAULT 100000;
