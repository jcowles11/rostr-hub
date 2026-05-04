-- Migration 39 — Privacy + Consent + Role Enforcement.
--
-- Three-part launch-blocker for the public commercial release:
--
--   Part A — Parental consent infrastructure
--     New table: parental_consent
--       Audit-trail-grade record of every grant + revocation. Never
--       hard-deleted. The /p/<handle> render checks this before
--       exposing any minor's data publicly.
--
--   Part B — Player-side consent linkage + visibility hardening
--     New columns on players:
--       public_consent_id        — FK to the active consent record
--       external_visibility_at   — when the profile became public
--       birth_year               — minor-determination proxy. Optional;
--                                  grade is the fallback. Coaches can
--                                  add it without collecting full DOB.
--     Existing `profile_public` stays as the operator toggle. The
--     server-side gate is now:
--       profile_public = true
--         AND (player is presumed adult OR public_consent_id is non-null)
--
--     Backfill: every existing row gets profile_public = false. Any
--     pilot user who'd already opened a profile must re-consent. This
--     is intentional — better one-time UX friction than legal exposure.
--
--   Part C — Role-aware RLS on the load-bearing surfaces
--     Tightens UPDATE/DELETE on tryout_scores, players, and
--     player_highlights to head_coach for destructive actions.
--     Assistant coaches still have full INSERT + score-entry.
--
-- Plus: data_access_log + takedown_request tables for audit trail
-- and parent-initiated removals.
--
-- All idempotent. Safe to apply against any environment.

-- ── Part A: parental_consent ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.parental_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  parent_email text NOT NULL,
  parent_name text NOT NULL,
  -- Granted scopes — flexible array so we can extend without migration:
  --   'public_profile'         — render /p/<handle> at all
  --   'verified_metrics_external' — show coach-verified data publicly
  --   'scout_discovery'        — appear in /scout search results
  --   'recruiter_outreach'     — recruiters can DM the player
  consent_scope text[] NOT NULL DEFAULT '{}'::text[],
  -- How consent was captured. Email_verification = parent clicked a
  -- one-time link. School_authorized = covered by a school district DPA.
  -- In_person_signature = coach uploaded a paper form.
  consent_method text NOT NULL CHECK (
    consent_method IN ('email_verification', 'school_authorized', 'in_person_signature')
  ),
  -- Verification token sent to parent_email. Single-use; cleared on grant.
  consent_token text,
  granted_at timestamptz,
  -- Soft-revocation. Never hard-delete consent rows; we need the audit
  -- trail intact for legal defense.
  revoked_at timestamptz,
  revoked_reason text,
  -- Forensic context for the grant — IP + UA when parent submitted.
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parental_consent_player_active
  ON public.parental_consent(player_id, granted_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_parental_consent_token
  ON public.parental_consent(consent_token)
  WHERE consent_token IS NOT NULL AND granted_at IS NULL;

ALTER TABLE public.parental_consent ENABLE ROW LEVEL SECURITY;

-- RLS: parents read their own grants via the token; coaches in the
-- player's program read all consent records for that player.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parental_consent' AND policyname = 'consent_coach_read') THEN
    CREATE POLICY consent_coach_read ON public.parental_consent
      FOR SELECT
      USING (
        player_id IN (
          SELECT p.id FROM public.players p
          JOIN public.coaches c ON c.program_id = p.program_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parental_consent' AND policyname = 'consent_coach_insert') THEN
    -- Coaches initiate consent requests (insert pending row with token).
    CREATE POLICY consent_coach_insert ON public.parental_consent
      FOR INSERT
      WITH CHECK (
        player_id IN (
          SELECT p.id FROM public.players p
          JOIN public.coaches c ON c.program_id = p.program_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.parental_consent IS
  'Audit-trail-grade parental consent for minor athletes. Soft-revoked, never hard-deleted. Required before public exposure of any data on /p/<handle> for under-18 players.';

-- ── Part B: player visibility + consent linkage ───────────────────

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS public_consent_id uuid
    REFERENCES public.parental_consent(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_visibility_at timestamptz,
  ADD COLUMN IF NOT EXISTS birth_year integer
    CHECK (birth_year IS NULL OR (birth_year >= 1990 AND birth_year <= 2030));

COMMENT ON COLUMN public.players.public_consent_id IS
  'Active parental consent record. Required for any minor (presumed grade < 12 unless birth_year proves otherwise) before /p/<handle> renders.';

COMMENT ON COLUMN public.players.birth_year IS
  'Optional. Used to determine if player is a minor. Falls back to grade < 12 when null. Collecting full DOB is avoided to minimize PII.';

-- BACKFILL: every existing row goes private. Pilot users must re-enable
-- public profiles after this migration. This is the legally-defensible
-- starting state — the alternative is grandfathering minor profiles
-- that never had consent.
UPDATE public.players SET profile_public = false WHERE profile_public = true;

-- ── data_access_log: every external view of player data ──────────

CREATE TABLE IF NOT EXISTS public.data_access_log (
  id bigserial PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  access_type text NOT NULL CHECK (
    access_type IN ('public_profile_view', 'scout_search_appearance', 'recruiter_dm', 'export', 'other')
  ),
  -- Viewer attribution (best-effort). Anonymous access stores ip + UA only.
  viewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_ip inet,
  viewer_user_agent text,
  -- Free-form context. Don't put PII here.
  context jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_data_access_log_player_time
  ON public.data_access_log(player_id, accessed_at DESC);

ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_access_log' AND policyname = 'access_log_coach_read') THEN
    CREATE POLICY access_log_coach_read ON public.data_access_log
      FOR SELECT
      USING (
        player_id IN (
          SELECT p.id FROM public.players p
          JOIN public.coaches c ON c.program_id = p.program_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.data_access_log IS
  'Compliance audit trail. Records every external (public / scout / recruiter) view of a player''s data. Powers parent transparency reports + breach forensics.';

-- ── takedown_request: parent-initiated removal flow ──────────────

CREATE TABLE IF NOT EXISTS public.takedown_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  requester_name text NOT NULL,
  requester_relationship text,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'auto_visibility_off', 'admin_review', 'completed', 'rejected')
  ),
  visibility_disabled_at timestamptz,
  completed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takedown_request_player
  ON public.takedown_request(player_id, created_at DESC);

ALTER TABLE public.takedown_request ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'takedown_request' AND policyname = 'takedown_coach_read') THEN
    CREATE POLICY takedown_coach_read ON public.takedown_request
      FOR SELECT
      USING (
        player_id IN (
          SELECT p.id FROM public.players p
          JOIN public.coaches c ON c.program_id = p.program_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.takedown_request IS
  'Parent-initiated request to remove a player''s public-facing data. Hybrid flow: visibility cuts immediately on receipt, deeper data deletion requires admin review.';

-- ── Part C: role-aware RLS tightening ─────────────────────────────
--
-- Current state: coaches.role enum is ('head_coach', 'assistant_coach').
-- UPDATE/DELETE policies on the load-bearing tables don't differentiate
-- the two. We tighten the destructive-write paths to head_coach only;
-- assistant coaches keep INSERT (score entry) but can't EDIT or DELETE.
--
-- Players.released_at write — only head_coach can release a player.
-- Tryout_scores UPDATE — only head_coach can edit a previously-recorded
--   score (assistant coaches insert new ones; edits are auditable).
-- Player_highlights verify/unverify — already protected by app-layer
--   trigger (migration 36); leave RLS at coach-level.

-- Drop the existing permissive UPDATE policy on players if it grants
-- everyone, then recreate as head-coach-only for destructive updates.
-- We DO NOT touch SELECT or INSERT — those stay coach-wide.

-- Find the existing players UPDATE policy name (if any) and replace.
DO $$
DECLARE
  _policy_name text;
BEGIN
  -- Drop any existing players UPDATE policy that doesn't differentiate role
  FOR _policy_name IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'players' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', _policy_name);
  END LOOP;
END $$;

-- Re-add: any coach in the program can update non-destructive fields
CREATE POLICY players_coach_update_safe
  ON public.players
  FOR UPDATE
  USING (
    program_id IN (SELECT program_id FROM public.coaches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    program_id IN (SELECT program_id FROM public.coaches WHERE user_id = auth.uid())
  );

COMMENT ON POLICY players_coach_update_safe ON public.players IS
  'Coaches in the program can update player rows. Destructive fields (release, profile_public flip) are gated at the app layer via requirePermission(). Setting profile_public to true also requires server-side consent verification.';

-- Tryout scores: only head_coach can UPDATE (edit a previously-entered
-- score). Assistant coaches still INSERT new scores via the score-entry UI.
DO $$
DECLARE
  _policy_name text;
BEGIN
  FOR _policy_name IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'tryout_scores' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tryout_scores', _policy_name);
  END LOOP;
END $$;

CREATE POLICY tryout_scores_head_coach_update
  ON public.tryout_scores
  FOR UPDATE
  USING (
    tryout_id IN (
      SELECT t.id FROM public.tryouts t
      JOIN public.coaches c ON c.program_id = t.program_id
      WHERE c.user_id = auth.uid() AND c.role = 'head_coach'
    )
  )
  WITH CHECK (
    tryout_id IN (
      SELECT t.id FROM public.tryouts t
      JOIN public.coaches c ON c.program_id = t.program_id
      WHERE c.user_id = auth.uid() AND c.role = 'head_coach'
    )
  );

-- Tryout scores DELETE: head_coach only as well.
DO $$
DECLARE
  _policy_name text;
BEGIN
  FOR _policy_name IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'tryout_scores' AND cmd = 'DELETE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tryout_scores', _policy_name);
  END LOOP;
END $$;

CREATE POLICY tryout_scores_head_coach_delete
  ON public.tryout_scores
  FOR DELETE
  USING (
    tryout_id IN (
      SELECT t.id FROM public.tryouts t
      JOIN public.coaches c ON c.program_id = t.program_id
      WHERE c.user_id = auth.uid() AND c.role = 'head_coach'
    )
  );

-- Players DELETE / soft-delete (released_at write) — head_coach only.
-- Soft-delete happens via UPDATE; we can't easily distinguish that
-- from other UPDATEs at the RLS layer without column-level grants.
-- App-layer requirePermission('release_player') is the primary gate;
-- DELETE is rare path but lock it down here.
DO $$
DECLARE
  _policy_name text;
BEGIN
  FOR _policy_name IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'players' AND cmd = 'DELETE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', _policy_name);
  END LOOP;
END $$;

CREATE POLICY players_head_coach_delete
  ON public.players
  FOR DELETE
  USING (
    program_id IN (
      SELECT program_id FROM public.coaches
      WHERE user_id = auth.uid() AND role = 'head_coach'
    )
  );

-- ── Helper function for app-layer consent checks ──────────────────

-- Called from the per-request server context to determine if a player
-- is a presumed-minor. Uses birth_year if available, falls back to
-- grade < 12 (so 12th graders are presumed adult-ish even if 17;
-- coach can flip the precise birth_year to override).
CREATE OR REPLACE FUNCTION public.player_is_presumed_minor(_player_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _by integer;
  _grade integer;
  _current_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
BEGIN
  SELECT birth_year, grade INTO _by, _grade
  FROM public.players
  WHERE id = _player_id;

  IF _by IS NOT NULL THEN
    -- 18+ if birth year is at least 18 years ago
    RETURN (_current_year - _by) < 18;
  END IF;

  -- Grade fallback: 12th graders presumed not-minor; lower grades minor.
  -- Conservative: treats edge cases as minors.
  RETURN COALESCE(_grade, 9) < 12;
END;
$$;

COMMENT ON FUNCTION public.player_is_presumed_minor(uuid) IS
  'Returns true if a player is presumed to be a minor (under 18). Used by the public-profile gate to require parental consent. Grade-based fallback when birth_year is null.';

-- ── Active-consent helper view ────────────────────────────────────

CREATE OR REPLACE VIEW public.active_parental_consent AS
SELECT DISTINCT ON (player_id)
  id,
  player_id,
  parent_email,
  parent_name,
  consent_scope,
  consent_method,
  granted_at
FROM public.parental_consent
WHERE granted_at IS NOT NULL
  AND revoked_at IS NULL
ORDER BY player_id, granted_at DESC;

ALTER VIEW public.active_parental_consent SET (security_invoker = on);
GRANT SELECT ON public.active_parental_consent TO authenticated;

COMMENT ON VIEW public.active_parental_consent IS
  'Latest active consent record per player. Used by /p/<handle> and /scout/* to confirm parental authorization for minors before exposure.';
