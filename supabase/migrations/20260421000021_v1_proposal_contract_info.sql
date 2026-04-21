-- v1 Proposal: capture full contract info from client on confirmation
-- (name already in confirmed_client_phone companion; add the rest).
-- confirmed_is_uk_tax_resident is added for future use even though the
-- current UI does not collect it — keep the column reserved.

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS confirmed_client_email TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_client_address TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_is_uk_tax_resident BOOLEAN DEFAULT false;
