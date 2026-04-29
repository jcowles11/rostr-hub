-- Add K-L (strikeout looking) as a distinct AB outcome alongside K
-- (strikeout swinging). Standard baseball scoring uses backwards K (ꓘ)
-- for looking; we store as 'K-L' for portability.
--
-- Touches both practice_at_bats (Live ABs) and game_events at_bat
-- payloads for consistency. game_events stores outcome inside the
-- payload jsonb so no constraint to alter there — UI just needs to
-- handle the new value.

-- ── practice_at_bats.outcome ────────────────────────────────

ALTER TABLE public.practice_at_bats
  DROP CONSTRAINT IF EXISTS practice_at_bats_outcome_check;

ALTER TABLE public.practice_at_bats
  ADD CONSTRAINT practice_at_bats_outcome_check
  CHECK (outcome IN (
    '1B', '2B', '3B', 'HR',
    'BB', 'K', 'K-L', 'HBP',
    'GO', 'FO', 'E', 'FC', 'SAC'
  ));

-- Update aggregate views to count K + K-L together as "k" since
-- both are strikeouts for batting average / K% purposes. The
-- per-pitch detail still preserves looking-vs-swinging via
-- practice_pitches.result. Adding the k_looking column requires
-- DROP since CREATE OR REPLACE can't reorder columns.

DROP VIEW IF EXISTS public.practice_hitter_stats;
DROP VIEW IF EXISTS public.practice_pitcher_stats;

CREATE OR REPLACE VIEW public.practice_hitter_stats AS
WITH totals AS (
  SELECT
    pab.hitter_id AS player_id,
    s.program_id,
    COUNT(*) AS pa,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR','K','K-L','GO','FO','E','FC')) AS ab,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR')) AS h,
    COUNT(*) FILTER (WHERE pab.outcome = '1B') AS singles,
    COUNT(*) FILTER (WHERE pab.outcome = '2B') AS doubles,
    COUNT(*) FILTER (WHERE pab.outcome = '3B') AS triples,
    COUNT(*) FILTER (WHERE pab.outcome = 'HR') AS hr,
    COUNT(*) FILTER (WHERE pab.outcome = 'BB') AS bb,
    COUNT(*) FILTER (WHERE pab.outcome = 'HBP') AS hbp,
    COUNT(*) FILTER (WHERE pab.outcome IN ('K','K-L')) AS k,
    COUNT(*) FILTER (WHERE pab.outcome = 'K-L') AS k_looking,
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
  player_id, program_id, sessions::int, pa::int, ab::int, h::int,
  singles::int, doubles::int, triples::int, hr::int,
  bb::int, hbp::int, k::int, k_looking::int, sac::int, hard_contact::int,
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

CREATE OR REPLACE VIEW public.practice_pitcher_stats AS
WITH totals AS (
  SELECT
    pab.pitcher_id AS player_id,
    s.program_id,
    COUNT(*) AS bf,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR','K','K-L','GO','FO','E','FC')) AS ab,
    COUNT(*) FILTER (WHERE pab.outcome IN ('1B','2B','3B','HR')) AS h,
    COUNT(*) FILTER (WHERE pab.outcome = 'HR') AS hr,
    COUNT(*) FILTER (WHERE pab.outcome = 'BB') AS bb,
    COUNT(*) FILTER (WHERE pab.outcome = 'HBP') AS hbp,
    COUNT(*) FILTER (WHERE pab.outcome IN ('K','K-L')) AS k,
    COUNT(*) FILTER (WHERE pab.outcome = 'K-L') AS k_looking,
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
  player_id, program_id, sessions::int, bf::int, ab::int,
  h::int, hr::int, bb::int, hbp::int, k::int, k_looking::int, hard_contact::int,
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
