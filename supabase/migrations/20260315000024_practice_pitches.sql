-- Practice pitches: per-pitch detail attached to a practice_at_bats row.
--
-- Coaches who want to scout pitchers (vs just track AB outcomes) can
-- log every pitch — ball, strike (called/swinging), foul, in play, HBP
-- — with optional velocity + pitch type. The AB still terminates with
-- an `outcome` value on practice_at_bats (BB/K/1B/.../etc.) so all the
-- existing aggregate views still work; pitches add granularity for
-- coaches who want it.
--
-- Auto-termination rules in the app:
--   - 4 balls → AB outcome = BB
--   - 3 strikes → AB outcome = K
--   - 'in_play' pitch → coach picks the in-play outcome (1B/2B/3B/HR/GO/FO/FC/E/SAC)
--   - 'hbp' pitch → AB outcome = HBP
--
-- v1 doesn't store zone/location data. Schema reserves space for it
-- (zone_x / zone_y) so heat maps drop in later without a migration.

CREATE TABLE IF NOT EXISTS public.practice_pitches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at_bat_id uuid NOT NULL REFERENCES public.practice_at_bats(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  result text NOT NULL CHECK (result IN (
    'ball',
    'strike_called',
    'strike_swinging',
    'foul',
    'foul_tip',
    'in_play',
    'hbp'
  )),
  pitch_type text,                              -- 'FB','CB','SL','CH','CT','OS', etc.
  pitch_velocity numeric(4,1),
  zone_x numeric(3,2),                          -- reserved for heat maps
  zone_y numeric(3,2),                          -- reserved for heat maps
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (at_bat_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_practice_pitches_ab
  ON public.practice_pitches(at_bat_id, sequence);

ALTER TABLE public.practice_pitches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'practice_pitches' AND policyname = 'Coaches manage own practice pitches') THEN
    CREATE POLICY "Coaches manage own practice pitches"
      ON public.practice_pitches FOR ALL
      USING (
        at_bat_id IN (
          SELECT pab.id FROM practice_at_bats pab
          JOIN practice_sessions s ON s.id = pab.session_id
          JOIN coaches c ON c.program_id = s.program_id
          WHERE c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        at_bat_id IN (
          SELECT pab.id FROM practice_at_bats pab
          JOIN practice_sessions s ON s.id = pab.session_id
          JOIN coaches c ON c.program_id = s.program_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Convenience view: per-pitcher pitch-level aggregates (strikes,
-- whiffs, in-play %, avg velo by pitch type). Used in "deep dive"
-- views on coach roster decisions.
CREATE OR REPLACE VIEW public.practice_pitcher_pitches AS
WITH p AS (
  SELECT
    pab.pitcher_id AS player_id,
    s.program_id,
    pp.result,
    pp.pitch_velocity
  FROM public.practice_pitches pp
  JOIN public.practice_at_bats pab ON pab.id = pp.at_bat_id
  JOIN public.practice_sessions s ON s.id = pab.session_id
)
SELECT
  player_id,
  program_id,
  COUNT(*)::int AS total_pitches,
  COUNT(*) FILTER (WHERE result IN ('strike_called','strike_swinging','foul','foul_tip','in_play'))::int AS strikes,
  COUNT(*) FILTER (WHERE result = 'ball')::int AS balls,
  COUNT(*) FILTER (WHERE result = 'strike_swinging')::int AS swinging_strikes,
  COUNT(*) FILTER (WHERE result = 'strike_called')::int AS called_strikes,
  COUNT(*) FILTER (WHERE result = 'foul')::int AS fouls,
  COUNT(*) FILTER (WHERE result = 'in_play')::int AS in_play,
  ROUND(AVG(pitch_velocity) FILTER (WHERE pitch_velocity IS NOT NULL), 1) AS avg_velo,
  MAX(pitch_velocity) FILTER (WHERE pitch_velocity IS NOT NULL) AS max_velo,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(
      (COUNT(*) FILTER (WHERE result IN ('strike_called','strike_swinging','foul','foul_tip','in_play')))::numeric
      / COUNT(*),
    3) ELSE 0 END AS strike_pct,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(
      (COUNT(*) FILTER (WHERE result = 'strike_swinging'))::numeric / COUNT(*),
    3) ELSE 0 END AS whiff_pct
FROM p
GROUP BY player_id, program_id;

ALTER VIEW public.practice_pitcher_pitches SET (security_invoker = off);
GRANT SELECT ON public.practice_pitcher_pitches TO authenticated;
