-- Tryouts Module (v1)
--
-- Four tables:
--   tryouts           — header: name, date window, status, varsity target
--   tryout_stations   — scoring stations within a tryout (60-yd, EV, etc.)
--   tryout_attendees  — roster of players registered for this tryout + verdict
--   tryout_scores     — one row per (tryout, station, player) — latest replaces
--
-- Follows existing patterns: UUID PKs, ON DELETE CASCADE, RLS with coach
-- program access. Station scoring is the most-used mobile flow — indexed for
-- fast per-station + per-player lookup.

-- ── tryouts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tryouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'complete')),
  varsity_target integer,                   -- roster cutoff for varsity keeps
  jv_target integer,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tryouts_program
  ON public.tryouts(program_id, start_date DESC);

ALTER TABLE public.tryouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view tryouts"
  ON public.tryouts FOR SELECT
  USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));

CREATE POLICY "Coaches can create tryouts"
  ON public.tryouts FOR INSERT
  WITH CHECK (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));

CREATE POLICY "Coaches can update tryouts"
  ON public.tryouts FOR UPDATE
  USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));

CREATE POLICY "Head coaches can delete tryouts"
  ON public.tryouts FOR DELETE
  USING (program_id IN (
    SELECT program_id FROM coaches
    WHERE user_id = auth.uid() AND role = 'head_coach'
  ));

-- ── tryout_stations ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tryout_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tryout_id uuid NOT NULL REFERENCES public.tryouts(id) ON DELETE CASCADE,
  name text NOT NULL,                        -- "60-yard dash"
  short_code text NOT NULL,                  -- "60yd" (column header)
  unit text,                                 -- "s" | "mph" | "score" | null
  score_type text NOT NULL DEFAULT 'higher_better'
    CHECK (score_type IN ('lower_better', 'higher_better', 'rating')),
  -- lower_better: time-based (60yd, pop time)
  -- higher_better: velocity/distance (EV, vert jump)
  -- rating: 1-5 subjective (fielding, mechanics)
  min_value numeric,                         -- optional validation bound
  max_value numeric,
  assigned_coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tryout_stations_tryout
  ON public.tryout_stations(tryout_id, sort_order);

ALTER TABLE public.tryout_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view tryout stations"
  ON public.tryout_stations FOR SELECT
  USING (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY "Coaches can manage tryout stations"
  ON public.tryout_stations FOR ALL
  USING (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ));

-- ── tryout_attendees ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tryout_attendees (
  tryout_id uuid NOT NULL REFERENCES public.tryouts(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  attended boolean NOT NULL DEFAULT true,
  verdict text
    CHECK (verdict IN ('lock', 'keep_varsity', 'keep_jv', 'keep_freshman', 'bubble', 'cut') OR verdict IS NULL),
  decided_by uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tryout_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tryout_attendees_tryout
  ON public.tryout_attendees(tryout_id);

CREATE INDEX IF NOT EXISTS idx_tryout_attendees_player
  ON public.tryout_attendees(player_id);

ALTER TABLE public.tryout_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view tryout attendees"
  ON public.tryout_attendees FOR SELECT
  USING (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY "Coaches can manage tryout attendees"
  ON public.tryout_attendees FOR ALL
  USING (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ));

-- ── tryout_scores ───────────────────────────────────────────────────
-- One row per (tryout, station, player). New scores overwrite old via upsert.
-- Keep history by writing to a separate tryout_score_attempts table later if
-- needed; v1 keeps it simple.

CREATE TABLE IF NOT EXISTS public.tryout_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tryout_id uuid NOT NULL REFERENCES public.tryouts(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.tryout_stations(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  note text,
  flag text                                 -- 'attention' | 'standout' | null
    CHECK (flag IN ('attention', 'standout') OR flag IS NULL),
  scored_by uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tryout_id, station_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tryout_scores_tryout
  ON public.tryout_scores(tryout_id);

CREATE INDEX IF NOT EXISTS idx_tryout_scores_station
  ON public.tryout_scores(tryout_id, station_id);

CREATE INDEX IF NOT EXISTS idx_tryout_scores_player
  ON public.tryout_scores(player_id, tryout_id);

ALTER TABLE public.tryout_scores ENABLE ROW LEVEL SECURITY;

-- Public SELECT: tryout scores flow into the public profile's verified
-- measurables section. We only expose aggregated "best" scores on the
-- public profile itself; raw access here is restricted to program coaches.
CREATE POLICY "Coaches can view tryout scores"
  ON public.tryout_scores FOR SELECT
  USING (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY "Coaches can write tryout scores"
  ON public.tryout_scores FOR ALL
  USING (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (tryout_id IN (
    SELECT t.id FROM tryouts t
    JOIN coaches c ON c.program_id = t.program_id
    WHERE c.user_id = auth.uid()
  ));

-- ── player_best_measurables (view) ──────────────────────────────────
-- Surfaces each player's best value per station short_code across all
-- tryouts, plus the most recent verifying coach — for the public profile
-- "Combine & measurables" panel.

CREATE OR REPLACE VIEW public.player_best_measurables AS
SELECT
  s.player_id,
  st.short_code,
  st.name AS station_name,
  st.unit,
  st.score_type,
  -- "best" = MIN for lower_better (time), MAX otherwise
  CASE
    WHEN st.score_type = 'lower_better' THEN
      MIN(s.value) FILTER (WHERE s.value IS NOT NULL)
    ELSE
      MAX(s.value) FILTER (WHERE s.value IS NOT NULL)
  END AS best_value,
  (ARRAY_AGG(s.created_at ORDER BY s.created_at DESC))[1] AS latest_at,
  (ARRAY_AGG(s.scored_by ORDER BY s.created_at DESC))[1] AS verified_by_coach_id
FROM public.tryout_scores s
JOIN public.tryout_stations st ON st.id = s.station_id
GROUP BY s.player_id, st.short_code, st.name, st.unit, st.score_type;
