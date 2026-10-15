-- =====================================================================
-- SLAA National Register — migration 006
-- Make coach phone optional for all coach requests (current and past).
-- =====================================================================

SET search_path = slaa, public;

ALTER TABLE coach_request DROP CONSTRAINT IF EXISTS coach_request_phone_for_current;
