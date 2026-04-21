-- Fix: proposals.token generating 40-char hash instead of 8-char code.
--
-- Root cause: the legacy v0.8/v0.11 proposals table defined token with a
-- column-level DEFAULT (likely `encode(gen_random_bytes(20),'hex')` → 40 chars).
-- Migration 000018's `ADD COLUMN IF NOT EXISTS token TEXT UNIQUE` was a no-op
-- on the existing column, so the old DEFAULT stayed active.
-- At INSERT time the column DEFAULT fires first and fills NEW.token, so the
-- BEFORE-INSERT trigger set_proposal_defaults() (which only populates when
-- NEW.token IS NULL) skips — the 8-char generator never runs.
--
-- Fix: drop the legacy DEFAULT so the trigger is the only code path that
-- writes token. Reinstall the trigger defensively in case it was lost.

ALTER TABLE proposals ALTER COLUMN token DROP DEFAULT;

DROP TRIGGER IF EXISTS proposals_set_defaults ON proposals;
CREATE TRIGGER proposals_set_defaults
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION set_proposal_defaults();
