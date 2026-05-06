-- Migration 40 — Legal Review Fixes (post-counsel review).
--
-- Implements the launch-blocker items from the privacy review:
--
--   Part A — Data minimization
--     Drops medical_notes, emergency_contact_name, emergency_contact_phone
--     from players. None are surfaced in the app today; their presence
--     creates state-law conflicts (IL SOPPA, NY Ed Law 2-d both
--     restrict ed-tech health-info collection) without product value.
--     Existing pilot data nulled before drop.
--
--   Part B — Geographic compliance scoping
--     Adds programs.operating_state (US state code) so we can route
--     compliance posture per program. Programs in CA + NY are excluded
--     from scout discovery features at the application layer (SOPIPA +
--     NY Ed Law 2-d don't permit our recruiting use case without
--     significant additional infrastructure).
--     Adds programs.is_school_district_customer for FERPA scoping —
--     when true, the program operates under a school DPA and the
--     "school official" exception applies; when false, individual
--     coach use under COPPA + state laws.
--
--   Part C — Hard age floor
--     CHECK constraint enforcing players.grade IS NULL OR grade >= 9
--     for new inserts. We do NOT collect/process under-13 data; the
--     hard floor at grade 9 (presumed age 14) cleanly avoids COPPA's
--     verifiable-parental-consent requirements that we don't yet have
--     the operational infrastructure to satisfy.
--     Existing rows grandfathered (constraint NOT VALID then no validate;
--     prevents future inserts but keeps any existing pilot rows).
--
--   Part D — Helper function for scout eligibility
--     program_eligible_for_scout_discovery(program_id) — returns false
--     when the program's operating_state is in the geo-restricted list
--     (CA, NY). Called from searchPlayersForScout to filter the scout
--     discovery results.
--
-- Idempotent. Safe against any environment.

-- ── Part A: drop sensitive fields not used in product ─────────────

-- Defensively null any pilot data first so the drop doesn't surprise
-- anyone reviewing the diff.
UPDATE public.players
SET
  medical_notes = NULL,
  emergency_contact_name = NULL,
  emergency_contact_phone = NULL
WHERE
  medical_notes IS NOT NULL
  OR emergency_contact_name IS NOT NULL
  OR emergency_contact_phone IS NOT NULL;

-- The active_players view (migration 28) is SELECT * — it depends on
-- every column. Drop it first so the column DROPs succeed, then
-- recreate it with the same shape minus the dropped columns.
DROP VIEW IF EXISTS public.active_players;

ALTER TABLE public.players
  DROP COLUMN IF EXISTS medical_notes,
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_phone;

-- Recreate active_players against the new column set (still SELECT *).
CREATE OR REPLACE VIEW public.active_players AS
  SELECT *
  FROM public.players
  WHERE released_at IS NULL;
GRANT SELECT ON public.active_players TO authenticated;

-- ── Part B: program-level compliance metadata ─────────────────────

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS operating_state text
    CHECK (
      operating_state IS NULL
      OR operating_state ~ '^[A-Z]{2}$'
    ),
  ADD COLUMN IF NOT EXISTS is_school_district_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_protection_addendum_signed_at timestamptz;

COMMENT ON COLUMN public.programs.operating_state IS
  'Two-letter US state code (e.g. CO, TX). Set by head coach during onboarding. Used for compliance routing — programs in CA and NY are excluded from scout discovery (SOPIPA + NY Ed Law 2-d).';

COMMENT ON COLUMN public.programs.is_school_district_customer IS
  'True when the program is operated under a signed school district DPA — FERPA "school official" framework applies. False = individual coach as customer, COPPA + state law direct application.';

-- ── Part C: hard age floor on new inserts ────────────────────────

-- NOT VALID + NO VALIDATE: applies to new inserts only, doesn't error
-- on any existing pilot rows that may have grade < 9 (rare; possible
-- in 8th-grade feeder programs). Future migration can backfill if needed.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND constraint_name = 'players_grade_age_floor'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_grade_age_floor
      CHECK (grade IS NULL OR grade >= 9)
      NOT VALID;
  END IF;
END $$;

COMMENT ON CONSTRAINT players_grade_age_floor ON public.players IS
  'Hard floor enforcing grade >= 9 (presumed age >= 14). Rostr does not knowingly collect data on users under 13 (COPPA). The floor is applied to new inserts only; pre-existing rows below grade 9 are grandfathered and should be reviewed individually.';

-- ── Part D: scout-eligibility helper ──────────────────────────────

CREATE OR REPLACE FUNCTION public.program_eligible_for_scout_discovery(_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Program must exist
    EXISTS (SELECT 1 FROM public.programs WHERE id = _program_id)
    AND
    -- Program must NOT be in a geo-restricted state
    NOT EXISTS (
      SELECT 1 FROM public.programs
      WHERE id = _program_id
        AND operating_state IN ('CA', 'NY')
    );
$$;

COMMENT ON FUNCTION public.program_eligible_for_scout_discovery(uuid) IS
  'Returns false when a program is in a geo-restricted state (currently CA + NY). Application-layer filter on scout discovery results. Restrictions can be lifted per-state when the corresponding compliance work is done (CA SOPIPA carve-out / NY Ed Law 2-d compliance package).';

-- ── Public scout-eligible view used by the discovery service ──────

CREATE OR REPLACE VIEW public.scout_eligible_player_search AS
SELECT ps.*
FROM public.player_search ps
JOIN public.programs p ON p.id = ps.program_id
WHERE
  -- Re-enforce profile_public at the view level (defense in depth;
  -- player_search already filters this).
  ps.profile_public = true
  -- Geo gate: programs in CA + NY are not scout-eligible.
  AND (p.operating_state IS NULL OR p.operating_state NOT IN ('CA', 'NY'));

ALTER VIEW public.scout_eligible_player_search SET (security_invoker = off);
GRANT SELECT ON public.scout_eligible_player_search TO authenticated;

COMMENT ON VIEW public.scout_eligible_player_search IS
  'Subset of player_search excluding programs in geo-restricted states. The /scout/discover surface reads from this view, not directly from player_search, so the geo policy is enforced at the SQL layer not just app code.';
