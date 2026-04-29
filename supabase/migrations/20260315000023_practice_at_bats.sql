-- Practice at-bats: indoor live ABs, intrasquad scrimmages, and any other
-- preseason / pen / cage at-bat tracking that ISN'T an official game.
--
-- Why a separate table from game_events:
--   Coaches asked specifically for preseason data to drive ROSTER
--   decisions but NOT pollute official season stats. So practice ABs
--   live in their own table with their own aggregate views. The shape
--   mirrors game_events at_bat payloads so the UX feels identical.
--
-- Two tables:
--   practice_sessions — a named container ("Wed Jan 8 indoor session",
--                       "Fall scrimmage A vs B"). Provides a date,
--                       location, and an end-time so the coach can
--                       close the session and "lock" it.
--   practice_at_bats   — one row per at-bat. Pitcher + hitter required;
--                       outcome from the same vocabulary as game_events.
--
-- Views aggregate per-pitcher and per-hitter so /app/practice/live-abs
-- can show roster-decision leaderboards.

-- ── practice_sessions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'live_abs'
    CHECK (kind IN ('live_abs', 'intrasquad', 'live_bp', 'pen_session', 'general')),
  name text NOT NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  location text,                          -- "Indoor cage", "Field 2", "Bullpen"
  notes text,
  /** When the session was started + closed. open sessions show the
      live-record interface; closed sessions are read-only summaries. */
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_program
  ON public.practice_sessions(program_id, session_date DESC);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'practice_sessions' AND policyname = 'Coaches manage own sessions') THEN
    CREATE POLICY "Coaches manage own sessions"
      ON public.practice_sessions FOR ALL
      USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()))
      WITH CHECK (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ── practice_at_bats ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.practice_at_bats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,

  /** Monotonically increasing per session — preserves chronological
      order even when records are inserted from multiple devices. */
  sequence integer NOT NULL,

  pitcher_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  hitter_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,

  /** Same outcome vocabulary as game_events at_bat payloads so the
      same scoring UI components can be reused. */
  outcome text NOT NULL CHECK (outcome IN (
    '1B', '2B', '3B', 'HR', 'BB', 'K', 'HBP', 'GO', 'FO', 'E', 'FC', 'SAC'
  )),
  rbi integer NOT NULL DEFAULT 0,

  /** Optional measurables — coaches with a Hit Trax / Rapsodo can log
      exit velo and launch angle alongside the outcome. */
  exit_velocity numeric(4,1),
  launch_angle numeric(4,1),
  pitch_velocity numeric(4,1),
  pitch_type text,                        -- "FB", "CB", "SL", "CH", etc.

  notes text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_abs_seq
  ON public.practice_at_bats(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_practice_abs_pitcher
  ON public.practice_at_bats(pitcher_id);
CREATE INDEX IF NOT EXISTS idx_practice_abs_hitter
  ON public.practice_at_bats(hitter_id);

ALTER TABLE public.practice_at_bats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'practice_at_bats' AND policyname = 'Coaches manage own practice ABs') THEN
    CREATE POLICY "Coaches manage own practice ABs"
      ON public.practice_at_bats FOR ALL
      USING (
        session_id IN (
          SELECT s.id FROM practice_sessions s
          JOIN coaches c ON c.program_id = s.program_id
          WHERE c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        session_id IN (
          SELECT s.id FROM practice_sessions s
          JOIN coaches c ON c.program_id = s.program_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── Aggregate views ─────────────────────────────────────────────

-- Per-hitter aggregate across ALL sessions for a program.
-- AVG, K%, BB%, HR — the metrics coaches care about for roster decisions.
CREATE OR REPLACE VIEW public.practice_hitter_stats AS
WITH totals AS (
  SELECT
    pab.hitter_id AS player_id,
    s.program_id,
    COUNT(*) AS pa,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR','K','GO','FO','E','FC')) AS ab,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR')) AS h,
    COUNT(*) FILTER (WHERE pab.outcome = '1B') AS singles,
    COUNT(*) FILTER (WHERE pab.outcome = '2B') AS doubles,
    COUNT(*) FILTER (WHERE pab.outcome = '3B') AS triples,
    COUNT(*) FILTER (WHERE pab.outcome = 'HR') AS hr,
    COUNT(*) FILTER (WHERE pab.outcome = 'BB') AS bb,
    COUNT(*) FILTER (WHERE pab.outcome = 'HBP') AS hbp,
    COUNT(*) FILTER (WHERE pab.outcome = 'K') AS k,
    COUNT(*) FILTER (WHERE pab.outcome = 'SAC') AS sac,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR','E')) AS hard_contact,
    COUNT(DISTINCT pab.session_id) AS sessions,
    SUM(pab.rbi) AS rbi,
    AVG(pab.exit_velocity) FILTER (WHERE pab.exit_velocity IS NOT NULL) AS avg_ev,
    MAX(pab.exit_velocity) FILTER (WHERE pab.exit_velocity IS NOT NULL) AS max_ev
  FROM public.practice_at_bats pab
  JOIN public.practice_sessions s ON s.id = pab.session_id
  GROUP BY pab.hitter_id, s.program_id
)
SELECT
  player_id,
  program_id,
  sessions::int,
  pa::int,
  ab::int,
  h::int,
  singles::int, doubles::int, triples::int, hr::int,
  bb::int, hbp::int, k::int, sac::int,
  hard_contact::int,
  COALESCE(rbi, 0)::int AS rbi,
  ROUND(avg_ev, 1) AS avg_ev,
  ROUND(max_ev, 1) AS max_ev,
  CASE WHEN ab > 0 THEN ROUND(h::numeric / ab, 3) ELSE 0 END AS avg,
  CASE WHEN pa > 0 THEN ROUND(k::numeric / pa, 3) ELSE 0 END AS k_pct,
  CASE WHEN pa > 0 THEN ROUND(bb::numeric / pa, 3) ELSE 0 END AS bb_pct,
  CASE WHEN pa > 0 THEN ROUND(hard_contact::numeric / pa, 3) ELSE 0 END AS hard_pct
FROM totals;

ALTER VIEW public.practice_hitter_stats SET (security_invoker = off);
GRANT SELECT ON public.practice_hitter_stats TO authenticated;

-- Per-pitcher aggregate. Same vocabulary, focused on pitcher rates.
CREATE OR REPLACE VIEW public.practice_pitcher_stats AS
WITH totals AS (
  SELECT
    pab.pitcher_id AS player_id,
    s.program_id,
    COUNT(*) AS bf,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR','K','GO','FO','E','FC')) AS ab,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR')) AS h,
    COUNT(*) FILTER (WHERE pab.outcome = 'HR') AS hr,
    COUNT(*) FILTER (WHERE pab.outcome = 'BB') AS bb,
    COUNT(*) FILTER (WHERE pab.outcome = 'HBP') AS hbp,
    COUNT(*) FILTER (WHERE pab.outcome = 'K') AS k,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR','E')) AS hard_contact,
    COUNT(DISTINCT pab.session_id) AS sessions,
    AVG(pab.exit_velocity) FILTER (WHERE pab.exit_velocity IS NOT NULL) AS opp_avg_ev,
    AVG(pab.pitch_velocity) FILTER (WHERE pab.pitch_velocity IS NOT NULL) AS avg_pitch_velo,
    MAX(pab.pitch_velocity) FILTER (WHERE pab.pitch_velocity IS NOT NULL) AS max_pitch_velo
  FROM public.practice_at_bats pab
  JOIN public.practice_sessions s ON s.id = pab.session_id
  GROUP BY pab.pitcher_id, s.program_id
)
SELECT
  player_id,
  program_id,
  sessions::int,
  bf::int,
  ab::int,
  h::int, hr::int,
  bb::int, hbp::int, k::int,
  hard_contact::int,
  ROUND(opp_avg_ev, 1) AS opp_avg_ev,
  ROUND(avg_pitch_velo, 1) AS avg_pitch_velo,
  ROUND(max_pitch_velo, 1) AS max_pitch_velo,
  CASE WHEN ab > 0 THEN ROUND(h::numeric / ab, 3) ELSE 0 END AS baa,
  CASE WHEN bf > 0 THEN ROUND(k::numeric / bf, 3) ELSE 0 END AS k_pct,
  CASE WHEN bf > 0 THEN ROUND(bb::numeric / bf, 3) ELSE 0 END AS bb_pct,
  CASE WHEN bf > 0 THEN ROUND(hard_contact::numeric / bf, 3) ELSE 0 END AS hard_pct
FROM totals;

ALTER VIEW public.practice_pitcher_stats SET (security_invoker = off);
GRANT SELECT ON public.practice_pitcher_stats TO authenticated;
