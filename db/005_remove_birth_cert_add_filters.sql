-- =====================================================================
-- SLAA National Register — migration 005
-- 1. Remove birth certificate columns from member (NIC or Postal ID only).
-- 2. Copy school_or_club from athlete up to member so the admin dashboard
--    can filter by it without joining the athlete table every time.
-- Apply after 004.
-- =====================================================================

SET search_path = slaa, public;

-- ---------------------------------------------------------------------
-- 1. Drop birth certificate columns and their unique index
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS member_birth_cert_uq;

ALTER TABLE member
  DROP COLUMN IF EXISTS birth_cert_no,
  DROP COLUMN IF EXISTS birth_cert_division;

-- Tighten the identity check: now only NIC or Postal ID is accepted.
DO $$ BEGIN
  ALTER TABLE member DROP CONSTRAINT IF EXISTS has_identity;
  ALTER TABLE member ADD CONSTRAINT has_identity
    CHECK (nic IS NOT NULL OR postal_id IS NOT NULL);
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 2. Re-create find_existing_member without birth certificate params
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS find_existing_member_public(text, text, text, text);
DROP FUNCTION IF EXISTS find_existing_member(text, text, text, text);

CREATE OR REPLACE FUNCTION find_existing_member(
  p_nic text DEFAULT NULL,
  p_postal_id text DEFAULT NULL)
RETURNS TABLE (slaa_id text, name_with_initials text, district text, match_on text)
LANGUAGE sql STABLE AS $$
  SELECT m.slaa_id, m.name_with_initials, m.district, 'nic'
  FROM member m
  WHERE p_nic IS NOT NULL AND m.nic = normalize_nic(p_nic) AND m.status <> 'merged'
  UNION ALL
  SELECT m.slaa_id, m.name_with_initials, m.district, 'postal_id'
  FROM member m
  WHERE p_postal_id IS NOT NULL AND m.postal_id = p_postal_id AND m.status <> 'merged';
$$;

CREATE OR REPLACE FUNCTION find_existing_member_public(
  p_nic text DEFAULT NULL,
  p_postal_id text DEFAULT NULL)
RETURNS TABLE (slaa_id text, masked_name text, district text)
LANGUAGE sql STABLE
SET search_path = slaa, public AS $$
  SELECT DISTINCT f.slaa_id,
         mask_name(coalesce(nullif(m.name_with_initials, ''), m.full_name)),
         f.district
  FROM find_existing_member(p_nic, p_postal_id) f
  JOIN member m ON m.slaa_id = f.slaa_id;
$$;

-- ---------------------------------------------------------------------
-- 3. Add school_or_club to member for fast admin filtering
--    (kept in sync with athlete.school_or_club via trigger)
-- ---------------------------------------------------------------------
ALTER TABLE member ADD COLUMN IF NOT EXISTS school_or_club text;

-- Populate from existing athlete rows
UPDATE member m
SET school_or_club = a.school_or_club
FROM athlete a
WHERE a.slaa_id = m.slaa_id
  AND a.school_or_club IS NOT NULL
  AND a.school_or_club <> '';

-- Index for the ILIKE search used in the admin filter
CREATE INDEX IF NOT EXISTS member_school_or_club_idx
  ON member (lower(school_or_club))
  WHERE school_or_club IS NOT NULL;

-- Keep member.school_or_club in sync when athlete row is updated
CREATE OR REPLACE FUNCTION sync_member_school_or_club()
RETURNS trigger LANGUAGE plpgsql
SET search_path = slaa, public AS $$
BEGIN
  UPDATE member SET school_or_club = NEW.school_or_club
  WHERE slaa_id = NEW.slaa_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS athlete_sync_school ON athlete;
CREATE TRIGGER athlete_sync_school
  AFTER INSERT OR UPDATE OF school_or_club ON athlete
  FOR EACH ROW EXECUTE FUNCTION sync_member_school_or_club();

-- Grant to app role
GRANT UPDATE (school_or_club) ON member TO slaa_app;
