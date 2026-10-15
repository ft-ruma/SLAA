-- =====================================================================
-- Athlete details from the data-collection plan:
--   1. events with personal bests (3 main events + optional extras)
--   2. coaches who are not in the list, for current AND past coaches
-- Apply after 003. Does not change 001_schema.sql; coach_request gains
-- columns here so "not in the list" coaches keep using the existing
-- admin follow-up page.
-- =====================================================================

SET search_path = slaa, public;

-- ---------------------------------------------------------------------
-- 1. Events and personal bests
--    rank 1-3 = main events, 4+ = additional events.
--    personal_best is kept as typed digits: 10.85 (s), 1:52.30 (min:s),
--    6.45 (m) or 5200 (points); the event says which unit applies.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlete_event (
  athlete_id     text NOT NULL REFERENCES athlete(slaa_id) ON DELETE CASCADE,
  event_code     text NOT NULL REFERENCES event(code),
  rank           smallint NOT NULL CHECK (rank BETWEEN 1 AND 20),
  personal_best  text,
  pb_year        smallint CHECK (pb_year BETWEEN 1950 AND 2100),
  pb_competition text CHECK (length(pb_competition) <= 120),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (athlete_id, event_code),
  CONSTRAINT athlete_event_rank_uq UNIQUE (athlete_id, rank),
  CONSTRAINT athlete_event_pb_format CHECK (
    personal_best IS NULL OR personal_best ~ '^[0-9]{1,5}([:.][0-9]{1,2}){0,2}$')
);

-- ---------------------------------------------------------------------
-- 2. Coaches not in the list: current or past, with years.
--    A current coach needs a phone number so SLAA can invite them;
--    for a past coach it is optional.
-- ---------------------------------------------------------------------
ALTER TABLE coach_request ADD COLUMN IF NOT EXISTS relationship_type text NOT NULL DEFAULT 'CURRENT';
ALTER TABLE coach_request ADD COLUMN IF NOT EXISTS start_year smallint;
ALTER TABLE coach_request ADD COLUMN IF NOT EXISTS end_year smallint;
ALTER TABLE coach_request ALTER COLUMN coach_phone DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE coach_request ADD CONSTRAINT coach_request_relationship_ck
    CHECK (relationship_type IN ('CURRENT', 'PAST'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE coach_request ADD CONSTRAINT coach_request_years_ck CHECK (
    (start_year IS NULL OR start_year BETWEEN 1950 AND 2100)
    AND (end_year IS NULL OR end_year BETWEEN 1950 AND 2100)
    AND (end_year IS NULL OR start_year IS NULL OR end_year >= start_year)
    AND (relationship_type = 'PAST' OR end_year IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE coach_request ADD CONSTRAINT coach_request_phone_for_current
    CHECK (relationship_type = 'PAST' OR coach_phone IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 3. App role: same rules as 002 (no DELETE). Deleting an athlete
--    removes their events through ON DELETE CASCADE above.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON athlete_event TO slaa_app;
