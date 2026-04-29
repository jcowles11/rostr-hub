-- Per-player pitching stats views (v1)
--
-- Mirror of batting-stats migration 000018, for pitchers. Everything
-- derives from the same append-only game_events log — no snapshots, no
-- refresh triggers. Writing a pitcher_change event or an at-bat during
-- live scoring updates these views instantly.
--
-- Attribution model:
--   • `pitcher_change` events carry `payload.new_pitcher_id` — the
--     Rostr player_id who just came on to pitch.
--   • Each at_bat is attributed to the most-recent pitcher_change
--     (by sequence) in the same game + same logged_by_side, before
--     this at_bat.
--   • We only attribute at_bats where the BATTER is not on our
--     roster (i.e. player_id IS NULL with an ad-hoc opponent name)
--     — those are the at_bats where OUR pitcher is on the mound.
--   • For cross-team linked games (both programs on Rostr), v2 will
--     need to resolve batter-roster vs pitcher-roster. v1 skips this.
--
-- Outs-per-at-bat approximation:
--   K, GO, FO, SAC → 1 out (ignoring double plays for pilot)
--   FC → 1 out (fielder's choice retires the lead runner)
--   Everything else → 0 outs
--
-- ERA/WHIP/K9 constants:
--   IP  = outs / 3.0 (stored as numeric; display as X.Y later)
--   ERA = (ER * 9) / IP  — pilot: ER == R (we don't distinguish yet)
--   WHIP = (H + BB) / IP
--   K/9 = (K * 9) / IP
--   BB/9 = (BB * 9) / IP

-- ── Per-game pitching line ───────────────────────────────────────

CREATE OR REPLACE VIEW public.player_game_pitching AS
WITH at_bats_with_pitcher AS (
  SELECT
    ge.id AS event_id,
    ge.game_id,
    ge.sequence,
    ge.payload,
    ge.outs_after,
    ge.home_score,
    ge.away_score,
    ge.created_at,
    ge.logged_by_side,
    ge.top_bottom,
    -- Most recent pitcher_change (with a valid new_pitcher_id) before
    -- this at_bat in the same game+side. NULL when no pitcher_change
    -- has happened yet (first-inning at_bats before the coach logs
    -- their starter — the seed emits one right after game_start).
    (
      SELECT (pc.payload->>'new_pitcher_id')::uuid
      FROM public.game_events pc
      WHERE pc.game_id = ge.game_id
        AND pc.event_type = 'pitcher_change'
        AND pc.logged_by_side = ge.logged_by_side
        AND pc.sequence < ge.sequence
        AND (pc.payload->>'new_pitcher_id') IS NOT NULL
      ORDER BY pc.sequence DESC
      LIMIT 1
    ) AS pitcher_id,
    -- Previous home/away score for run-allowed deltas
    LAG(ge.home_score) OVER (
      PARTITION BY ge.game_id, ge.logged_by_side ORDER BY ge.sequence
    ) AS prev_home_score,
    LAG(ge.away_score) OVER (
      PARTITION BY ge.game_id, ge.logged_by_side ORDER BY ge.sequence
    ) AS prev_away_score
  FROM public.game_events ge
  WHERE ge.event_type = 'at_bat'
    AND ge.logged_by_side = 'home'
    -- Opponent at_bat (our pitcher is on the mound). Ad-hoc name
    -- indicates the batter isn't on a Rostr roster.
    AND ge.player_id IS NULL
    AND ge.player_ad_hoc_name IS NOT NULL
),
attributed AS (
  SELECT
    pitcher_id,
    game_id,
    payload,
    top_bottom,
    created_at,
    -- Runs allowed on this at_bat = score delta for the OPPOSING
    -- batting side. Top half → away team bats → away_score delta.
    -- Bottom half → home team bats → home_score delta.
    CASE
      WHEN top_bottom = 'top' THEN COALESCE(away_score - prev_away_score, 0)
      WHEN top_bottom = 'bottom' THEN COALESCE(home_score - prev_home_score, 0)
      ELSE 0
    END AS runs_on_play
  FROM at_bats_with_pitcher
  WHERE pitcher_id IS NOT NULL
)
SELECT
  pitcher_id AS player_id,
  game_id,
  -- Batters faced = total at_bats attributed
  COUNT(*)::int AS bf,
  -- Outs recorded (approximation — see header comment)
  COUNT(*) FILTER (WHERE (payload->>'outcome') IN ('K','GO','FO','SAC','FC'))::int AS outs,
  -- Innings pitched as numeric thirds. 1 IP = 3 outs.
  ROUND(
    (COUNT(*) FILTER (WHERE (payload->>'outcome') IN ('K','GO','FO','SAC','FC')))::numeric / 3.0,
    2
  ) AS ip,
  -- Hits allowed
  COUNT(*) FILTER (WHERE (payload->>'outcome') IN ('1B','2B','3B','HR'))::int AS h,
  COUNT(*) FILTER (WHERE (payload->>'outcome') = 'HR')::int AS hr,
  COUNT(*) FILTER (WHERE (payload->>'outcome') = 'BB')::int AS bb,
  COUNT(*) FILTER (WHERE (payload->>'outcome') = 'HBP')::int AS hbp,
  COUNT(*) FILTER (WHERE (payload->>'outcome') = 'K')::int AS k,
  COALESCE(SUM(runs_on_play), 0)::int AS r,
  -- ER == R for v1 (we don't distinguish errors yet)
  COALESCE(SUM(runs_on_play), 0)::int AS er,
  MIN(created_at) AS first_bf_at,
  MAX(created_at) AS last_bf_at
FROM attributed
GROUP BY pitcher_id, game_id;

ALTER VIEW public.player_game_pitching SET (security_invoker = off);
GRANT SELECT ON public.player_game_pitching TO anon, authenticated;

-- ── Career pitching line ─────────────────────────────────────────

CREATE OR REPLACE VIEW public.player_career_pitching AS
WITH totals AS (
  SELECT
    player_id,
    COUNT(DISTINCT game_id)::int AS games,
    SUM(bf)::int AS bf,
    SUM(outs)::int AS outs,
    SUM(h)::int AS h,
    SUM(hr)::int AS hr,
    SUM(bb)::int AS bb,
    SUM(hbp)::int AS hbp,
    SUM(k)::int AS k,
    SUM(r)::int AS r,
    SUM(er)::int AS er
  FROM public.player_game_pitching
  GROUP BY player_id
)
SELECT
  player_id,
  games,
  bf,
  outs,
  ROUND(outs::numeric / 3.0, 2) AS ip,
  h, hr, bb, hbp, k, r, er,
  -- ERA
  CASE
    WHEN outs > 0
    THEN ROUND((er * 9.0 * 3.0) / outs, 2)
    ELSE 0
  END AS era,
  -- WHIP
  CASE
    WHEN outs > 0
    THEN ROUND(((h + bb) * 3.0) / outs, 3)
    ELSE 0
  END AS whip,
  -- K/9
  CASE
    WHEN outs > 0
    THEN ROUND((k * 9.0 * 3.0) / outs, 2)
    ELSE 0
  END AS k9,
  -- BB/9
  CASE
    WHEN outs > 0
    THEN ROUND((bb * 9.0 * 3.0) / outs, 2)
    ELSE 0
  END AS bb9,
  -- K/BB ratio (Infinity-safe — 0 walks returns just K as the "ratio")
  CASE
    WHEN bb > 0 THEN ROUND(k::numeric / bb, 2)
    ELSE k::numeric
  END AS k_bb
FROM totals;

ALTER VIEW public.player_career_pitching SET (security_invoker = off);
GRANT SELECT ON public.player_career_pitching TO anon, authenticated;

-- ── Season pitching line (current calendar year) ─────────────────

CREATE OR REPLACE VIEW public.player_season_pitching AS
WITH season_games AS (
  SELECT pgp.*, g.program_id, g.team_level, g.game_date
  FROM public.player_game_pitching pgp
  JOIN public.games g ON g.id = pgp.game_id
  WHERE EXTRACT(YEAR FROM g.game_date) = EXTRACT(YEAR FROM CURRENT_DATE)
),
totals AS (
  SELECT
    player_id,
    program_id,
    EXTRACT(YEAR FROM CURRENT_DATE)::int AS season_year,
    COUNT(DISTINCT game_id)::int AS games,
    SUM(bf)::int AS bf,
    SUM(outs)::int AS outs,
    SUM(h)::int AS h,
    SUM(hr)::int AS hr,
    SUM(bb)::int AS bb,
    SUM(hbp)::int AS hbp,
    SUM(k)::int AS k,
    SUM(r)::int AS r,
    SUM(er)::int AS er
  FROM season_games
  GROUP BY player_id, program_id
)
SELECT
  player_id,
  program_id,
  season_year,
  games,
  bf,
  outs,
  ROUND(outs::numeric / 3.0, 2) AS ip,
  h, hr, bb, hbp, k, r, er,
  CASE WHEN outs > 0 THEN ROUND((er * 9.0 * 3.0) / outs, 2) ELSE 0 END AS era,
  CASE WHEN outs > 0 THEN ROUND(((h + bb) * 3.0) / outs, 3) ELSE 0 END AS whip,
  CASE WHEN outs > 0 THEN ROUND((k * 9.0 * 3.0) / outs, 2) ELSE 0 END AS k9,
  CASE WHEN outs > 0 THEN ROUND((bb * 9.0 * 3.0) / outs, 2) ELSE 0 END AS bb9,
  CASE WHEN bb > 0 THEN ROUND(k::numeric / bb, 2) ELSE k::numeric END AS k_bb
FROM totals;

ALTER VIEW public.player_season_pitching SET (security_invoker = off);
GRANT SELECT ON public.player_season_pitching TO anon, authenticated;

-- ── Program pitching leaders ─────────────────────────────────────
-- Min 3 IP (9 outs) to qualify — one cameo inning doesn't crown
-- someone the ERA leader.

CREATE OR REPLACE VIEW public.program_pitching_leaders AS
SELECT
  psp.*,
  p.first_name,
  p.last_name,
  p.player_number,
  p.profile_slug
FROM public.player_season_pitching psp
JOIN public.players p ON p.id = psp.player_id
WHERE psp.outs >= 9;

ALTER VIEW public.program_pitching_leaders SET (security_invoker = off);
GRANT SELECT ON public.program_pitching_leaders TO anon, authenticated;
