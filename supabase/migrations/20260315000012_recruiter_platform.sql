-- Recruiter Platform (v1)
--
-- Introduces the "other side" of the marketplace — college coaches,
-- scouts, and pro evaluators. A recruiter builds their own view of the
-- prospect universe: saved searches, custom lists, tracked views.
--
-- Five tables:
--   recruiters                  — identity + organization context
--   recruiter_lists             — custom groupings ("Watch list 2027")
--   recruiter_list_players      — junction (list ↔ player)
--   recruiter_saved_searches    — filter presets w/ optional email alerts
--   recruiter_views             — audit trail for "who viewed my profile"
--
-- RLS scopes each recruiter's data to themselves. Coach visibility of
-- who viewed their players happens through aggregate queries / RPC
-- (not granted here to keep viewer identity private for v1).

-- ── recruiters ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name text NOT NULL,
  organization_name text NOT NULL,        -- "University of Texas"
  organization_short text,                -- "TEX" (for the avatar)
  organization_division text
    CHECK (organization_division IN ('d1','d2','d3','naia','juco','pro','club','other')),
  title text,                             -- "Head Coach", "Recruiting Coordinator"
  sport text NOT NULL DEFAULT 'Baseball',
  region text,                            -- "Southwest" / "TX" / "All US"
  contact_email text,
  avatar_color text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiters_user ON public.recruiters(user_id);

ALTER TABLE public.recruiters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiter can view self"
  ON public.recruiters FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Recruiter can insert self"
  ON public.recruiters FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Recruiter can update self"
  ON public.recruiters FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── recruiter_lists ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiter_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES public.recruiters(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#c83a3a',
  emoji text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_lists_by_recruiter
  ON public.recruiter_lists(recruiter_id, created_at DESC);

ALTER TABLE public.recruiter_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiter manages own lists"
  ON public.recruiter_lists FOR ALL
  USING (recruiter_id IN (SELECT id FROM recruiters WHERE user_id = auth.uid()))
  WITH CHECK (recruiter_id IN (SELECT id FROM recruiters WHERE user_id = auth.uid()));

-- ── recruiter_list_players ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiter_list_players (
  list_id uuid NOT NULL REFERENCES public.recruiter_lists(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  notes text,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_rlp_by_list
  ON public.recruiter_list_players(list_id, added_at DESC);

CREATE INDEX IF NOT EXISTS idx_rlp_by_player
  ON public.recruiter_list_players(player_id);

ALTER TABLE public.recruiter_list_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiter manages own list-players"
  ON public.recruiter_list_players FOR ALL
  USING (list_id IN (
    SELECT rl.id FROM recruiter_lists rl
    JOIN recruiters r ON r.id = rl.recruiter_id
    WHERE r.user_id = auth.uid()
  ))
  WITH CHECK (list_id IN (
    SELECT rl.id FROM recruiter_lists rl
    JOIN recruiters r ON r.id = rl.recruiter_id
    WHERE r.user_id = auth.uid()
  ));

-- ── recruiter_saved_searches ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiter_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES public.recruiters(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL,                 -- serialized filter state
  alert_email boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  last_result_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_by_recruiter
  ON public.recruiter_saved_searches(recruiter_id, created_at DESC);

ALTER TABLE public.recruiter_saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiter manages own searches"
  ON public.recruiter_saved_searches FOR ALL
  USING (recruiter_id IN (SELECT id FROM recruiters WHERE user_id = auth.uid()))
  WITH CHECK (recruiter_id IN (SELECT id FROM recruiters WHERE user_id = auth.uid()));

-- ── recruiter_views ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiter_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES public.recruiters(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_views_by_player
  ON public.recruiter_views(player_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_recruiter_views_by_recruiter
  ON public.recruiter_views(recruiter_id, viewed_at DESC);

ALTER TABLE public.recruiter_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiter can log own views"
  ON public.recruiter_views FOR INSERT
  WITH CHECK (recruiter_id IN (SELECT id FROM recruiters WHERE user_id = auth.uid()));

CREATE POLICY "Recruiter views own history"
  ON public.recruiter_views FOR SELECT
  USING (recruiter_id IN (SELECT id FROM recruiters WHERE user_id = auth.uid()));

-- ── Extend players SELECT for recruiters ──────────────────────────
-- Recruiters can read public-profile players across all programs.
-- This does NOT expose private fields (availability_note is not on the
-- public profile page) — it just allows the base row read for the
-- profile + measurables queries.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'players' AND policyname = 'Recruiters can view public players'
  ) THEN
    CREATE POLICY "Recruiters can view public players"
      ON public.players FOR SELECT
      USING (
        profile_public = true
        AND EXISTS (SELECT 1 FROM recruiters WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── player_search view ───────────────────────────────────────────
-- Convenience view that joins players with their program + best
-- measurables so the recruiter search page can hit a single query.

CREATE OR REPLACE VIEW public.player_search AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.grade,
  p.positions,
  p.player_number,
  p.profile_slug,
  p.profile_public,
  p.bats,
  p.throws,
  p.program_id,
  prog.name AS school_name,
  prog.sport,
  -- best values per common station codes — NULL if player has no
  -- measurable for that station. Use the MIN/MAX logic baked into the
  -- base view so scoring-type is respected.
  MAX(CASE WHEN pbm.short_code = '60yd' THEN pbm.best_value END) AS best_60yd,
  MAX(CASE WHEN pbm.short_code = 'EV' THEN pbm.best_value END) AS best_ev,
  MAX(CASE WHEN pbm.short_code = 'Velo' THEN pbm.best_value END) AS best_velo,
  MAX(CASE WHEN pbm.short_code = 'Field' THEN pbm.best_value END) AS best_field,
  MAX(CASE WHEN pbm.short_code = 'BP' THEN pbm.best_value END) AS best_bp
FROM public.players p
LEFT JOIN public.programs prog ON prog.id = p.program_id
LEFT JOIN public.player_best_measurables pbm ON pbm.player_id = p.id
GROUP BY p.id, prog.name, prog.sport;

GRANT SELECT ON public.player_search TO anon, authenticated;

-- ── profile_views_for_coach (aggregate, privacy-preserving) ───────
-- So a coach can see "7 college coaches viewed this player in the
-- last 30d" without learning which recruiters exactly.

CREATE OR REPLACE FUNCTION public.player_recruiter_view_stats(_player_id uuid)
RETURNS TABLE (viewers_30d int, views_30d int, viewers_7d int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT recruiter_id) FILTER (WHERE viewed_at >= now() - interval '30 days')::int,
    COUNT(*) FILTER (WHERE viewed_at >= now() - interval '30 days')::int,
    COUNT(DISTINCT recruiter_id) FILTER (WHERE viewed_at >= now() - interval '7 days')::int
  FROM public.recruiter_views
  WHERE player_id = _player_id;
$$;

GRANT EXECUTE ON FUNCTION public.player_recruiter_view_stats(uuid) TO anon, authenticated;
