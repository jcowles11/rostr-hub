-- Per-player batting stats views (v1)
--
-- Computes career + season batting lines from the append-only game_events
-- log. Nothing stored — everything derives on read. For pilot scale
-- (hundreds of games per program) this is plenty fast. If we hit
-- performance issues later, swap to a materialized view refreshed
-- every N minutes.
--
-- Vocabulary follows standard baseball:
--   AB    = at-bats (excludes BB, HBP, SAC)
--   H     = hits (1B + 2B + 3B + HR)
--   PA    = plate appearances (everything)
--   BB    = walks
--   K     = strikeouts
--   HBP   = hit by pitch
--   SAC   = sacrifice
--   RBI   = runs batted in (pulled from payload.rbi)
--   BA    = H / AB
--   OBP   = (H + BB + HBP) / (AB + BB + HBP + SAC)
--   SLG   = (1B + 2·2B + 3·3B + 4·HR) / AB
--   OPS   = OBP + SLG

-- ── Per-game batting line ────────────────────────────────────────
-- Granular — used for game-by-game box scores on player profiles.

CREATE OR REPLACE VIEW public.player_game_batting AS
SELECT
  ge.player_id,
  ge.game_id,
  -- Plate appearances = all at-bat events
  COUNT(*)::int AS pa,
  -- Official at-bats exclude BB, HBP, SAC
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') IN ('1B','2B','3B','HR','K','GO','FO','E','FC'))::int AS ab,
  -- Hits
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') IN ('1B','2B','3B','HR'))::int AS h,
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') = '1B')::int AS singles,
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') = '2B')::int AS doubles,
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') = '3B')::int AS triples,
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') = 'HR')::int AS hr,
  -- Walks + HBP
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') = 'BB')::int AS bb,
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') = 'HBP')::int AS hbp,
  -- Strikeouts
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') = 'K')::int AS k,
  -- Sacrifices
  COUNT(*) FILTER (WHERE (ge.payload->>'outcome') = 'SAC')::int AS sac,
  -- RBI (from payload; default 0)
  COALESCE(SUM((ge.payload->>'rbi')::int), 0)::int AS rbi,
  MIN(ge.created_at) AS first_ab_at,
  MAX(ge.created_at) AS last_ab_at
FROM public.game_events ge
WHERE ge.event_type = 'at_bat'
  AND ge.logged_by_side = 'home'
  AND ge.player_id IS NOT NULL
GROUP BY ge.player_id, ge.game_id;

ALTER VIEW public.player_game_batting SET (security_invoker = off);
GRANT SELECT ON public.player_game_batting TO anon, authenticated;

-- ── Career batting line (all games ever) ─────────────────────────

CREATE OR REPLACE VIEW public.player_career_batting AS
WITH totals AS (
  SELECT
    player_id,
    COUNT(DISTINCT game_id)::int AS games,
    SUM(pa)::int AS pa,
    SUM(ab)::int AS ab,
    SUM(h)::int AS h,
    SUM(singles)::int AS singles,
    SUM(doubles)::int AS doubles,
    SUM(triples)::int AS triples,
    SUM(hr)::int AS hr,
    SUM(bb)::int AS bb,
    SUM(hbp)::int AS hbp,
    SUM(k)::int AS k,
    SUM(sac)::int AS sac,
    SUM(rbi)::int AS rbi
  FROM public.player_game_batting
  GROUP BY player_id
)
SELECT
  player_id,
  games,
  pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, rbi,
  -- BA
  CASE WHEN ab > 0 THEN ROUND(h::numeric / ab, 3) ELSE 0 END AS ba,
  -- OBP
  CASE
    WHEN (ab + bb + hbp + sac) > 0
    THEN ROUND((h + bb + hbp)::numeric / (ab + bb + hbp + sac), 3)
    ELSE 0
  END AS obp,
  -- SLG
  CASE
    WHEN ab > 0
    THEN ROUND((singles + 2 * doubles + 3 * triples + 4 * hr)::numeric / ab, 3)
    ELSE 0
  END AS slg,
  -- OPS = OBP + SLG
  CASE
    WHEN ab > 0 AND (ab + bb + hbp + sac) > 0
    THEN ROUND(
      ((h + bb + hbp)::numeric / (ab + bb + hbp + sac)) +
      ((singles + 2 * doubles + 3 * triples + 4 * hr)::numeric / ab),
      3
    )
    ELSE 0
  END AS ops
FROM totals;

ALTER VIEW public.player_career_batting SET (security_invoker = off);
GRANT SELECT ON public.player_career_batting TO anon, authenticated;

-- ── Season batting line (current calendar year) ──────────────────
-- "Season" = current year for now. Long-term, program.season_year +
-- games.season_id defines the boundary.

CREATE OR REPLACE VIEW public.player_season_batting AS
WITH season_games AS (
  SELECT pgb.*, g.program_id, g.team_level, g.game_date
  FROM public.player_game_batting pgb
  JOIN public.games g ON g.id = pgb.game_id
  WHERE EXTRACT(YEAR FROM g.game_date) = EXTRACT(YEAR FROM CURRENT_DATE)
),
totals AS (
  SELECT
    player_id,
    program_id,
    EXTRACT(YEAR FROM CURRENT_DATE)::int AS season_year,
    COUNT(DISTINCT game_id)::int AS games,
    SUM(pa)::int AS pa,
    SUM(ab)::int AS ab,
    SUM(h)::int AS h,
    SUM(singles)::int AS singles,
    SUM(doubles)::int AS doubles,
    SUM(triples)::int AS triples,
    SUM(hr)::int AS hr,
    SUM(bb)::int AS bb,
    SUM(hbp)::int AS hbp,
    SUM(k)::int AS k,
    SUM(sac)::int AS sac,
    SUM(rbi)::int AS rbi
  FROM season_games
  GROUP BY player_id, program_id
)
SELECT
  player_id,
  program_id,
  season_year,
  games,
  pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, rbi,
  CASE WHEN ab > 0 THEN ROUND(h::numeric / ab, 3) ELSE 0 END AS ba,
  CASE
    WHEN (ab + bb + hbp + sac) > 0
    THEN ROUND((h + bb + hbp)::numeric / (ab + bb + hbp + sac), 3)
    ELSE 0
  END AS obp,
  CASE
    WHEN ab > 0
    THEN ROUND((singles + 2 * doubles + 3 * triples + 4 * hr)::numeric / ab, 3)
    ELSE 0
  END AS slg,
  CASE
    WHEN ab > 0 AND (ab + bb + hbp + sac) > 0
    THEN ROUND(
      ((h + bb + hbp)::numeric / (ab + bb + hbp + sac)) +
      ((singles + 2 * doubles + 3 * triples + 4 * hr)::numeric / ab),
      3
    )
    ELSE 0
  END AS ops
FROM totals;

ALTER VIEW public.player_season_batting SET (security_invoker = off);
GRANT SELECT ON public.player_season_batting TO anon, authenticated;

-- ── Program batting leaders view ─────────────────────────────────
-- For the Coach Hub "team stats" panel + recruiter leaderboard.
-- Ranks players by OPS within a program. Requires a min-PA threshold
-- so a 1-for-1 season doesn't top the leaderboard.

CREATE OR REPLACE VIEW public.program_batting_leaders AS
SELECT
  psb.*,
  p.first_name,
  p.last_name,
  p.player_number,
  p.profile_slug
FROM public.player_season_batting psb
JOIN public.players p ON p.id = psb.player_id
WHERE psb.pa >= 5;  -- minimum qualifying PA

ALTER VIEW public.program_batting_leaders SET (security_invoker = off);
GRANT SELECT ON public.program_batting_leaders TO anon, authenticated;
