-- Migration 32 — Game State Integrity Sprint
--
-- Three correctness fixes:
--
-- (1) New RPC `log_inning_change` so the client can persist a half /
--     inning advancement after the 3rd out. Previously the client
--     computed nextHalf / nextInning then discarded them — `lastEvent`
--     stayed pinned to the same half, so subsequent at-bats were
--     logged in the wrong half. Mirrors `log_at_bat`'s pattern:
--     atomic sequence allocation, side detection from caller's
--     coach record. Inserts a row of event_type='inning_change' with
--     the new (inning, top_bottom) and outs_after=0.
--
-- (2) Batting view filter — `player_game_batting` was counting every
--     at_bat row with a player_id, which inflated PA for runners
--     who got picked off (pickoffs are stored as 'at_bat' events with
--     payload.pickoff=true for schema-compat reasons). Same for
--     midGame (SB/CS/WP/PB/BK) and substitution sub-events. Filter
--     them out at the view level so PA / box-score counts align
--     with the application's `isNonAtBatEvent()` filter.
--
-- (3) Pitching view filter — `player_game_pitching` identified
--     "opponent at-bat" via `player_id IS NULL AND player_ad_hoc_name
--     IS NOT NULL`. That breaks the moment the opposing program is
--     LINKED (cross-team scoring) — the opponent's batter has a real
--     player_id, so the row is excluded and the pitcher gets credit
--     for nothing. Switched to `payload->>'pitcherId' IS NOT NULL`,
--     which is the actual signal: pitcherId is only stamped when WE'RE
--     pitching. Also COALESCE-falls-back to the latest pitcher_change
--     event for legacy at-bats that predate per-AB pitcherId stamping.
--     Same Phase 3 sub-event exclusions.
--
-- Idempotent: CREATE OR REPLACE VIEW + CREATE OR REPLACE FUNCTION.

-- ── (1) inning_change RPC ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_inning_change(
  _game_id uuid,
  _new_inning integer,
  _new_half text,
  _home_score integer,
  _away_score integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  next_seq integer;
  user_side text;
  game_row games%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  IF _new_half NOT IN ('top', 'bottom') THEN
    RAISE EXCEPTION 'invalid_half';
  END IF;
  IF _new_inning < 1 OR _new_inning > 30 THEN
    RAISE EXCEPTION 'invalid_inning';
  END IF;

  SELECT * INTO game_row FROM games WHERE id = _game_id;
  IF game_row.id IS NULL THEN
    RAISE EXCEPTION 'game_not_found';
  END IF;

  -- Same side detection as log_at_bat — the caller must be a coach
  -- on either the home program or the linked opponent program.
  IF EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = auth.uid() AND program_id = game_row.program_id
  ) THEN
    user_side := 'home';
  ELSIF game_row.opponent_program_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = auth.uid() AND program_id = game_row.opponent_program_id
  ) THEN
    user_side := 'away';
  ELSE
    RAISE EXCEPTION 'not_a_coach_on_this_game';
  END IF;

  -- Atomic sequence allocation per (game, side).
  SELECT COALESCE(MAX(sequence), 0) + 1 INTO next_seq
  FROM game_events
  WHERE game_id = _game_id AND logged_by_side = user_side;

  INSERT INTO game_events (
    game_id, sequence, event_type, inning, top_bottom, outs_after,
    home_score, away_score, payload, logged_by, logged_by_side
  )
  VALUES (
    _game_id, next_seq, 'inning_change', _new_inning, _new_half, 0,
    _home_score, _away_score,
    jsonb_build_object('new_inning', _new_inning, 'new_half', _new_half),
    auth.uid(), user_side
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_inning_change(uuid, integer, text, integer, integer)
  TO authenticated;

-- ── (2) Batting view: exclude non-AB sub-events ──────────────────

CREATE OR REPLACE VIEW public.player_game_batting AS
SELECT
  ge.player_id,
  ge.game_id,
  -- Plate appearances = at-bat events that are actually plate appearances
  -- (excludes pickoffs / SB-CS-WP-PB-BK / substitution sub-events that
  -- ride on the at_bat event_type for schema compat).
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
  -- Phase 3: exclude sub-events that share the at_bat row but aren't
  -- plate appearances. Each flag is a payload boolean set by its
  -- respective server action (recordRunnerPickoffAction,
  -- recordMidGameEventAction, the substitution path).
  AND COALESCE((ge.payload->>'pickoff')::boolean, false) IS NOT TRUE
  AND COALESCE((ge.payload->>'midGame')::boolean, false) IS NOT TRUE
  AND COALESCE((ge.payload->>'substitution')::boolean, false) IS NOT TRUE
GROUP BY ge.player_id, ge.game_id;

ALTER VIEW public.player_game_batting SET (security_invoker = off);
GRANT SELECT ON public.player_game_batting TO anon, authenticated;

-- ── (3) Pitching view: identify opponent at-bats by payload.pitcherId ──

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
    -- Prefer payload.pitcherId (per-AB stamp; survives mid-AB
    -- pitcher subs cleanly). Fall back to the latest pitcher_change
    -- event for legacy events that predate per-AB stamping.
    COALESCE(
      (ge.payload->>'pitcherId')::uuid,
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
      )
    ) AS pitcher_id,
    LAG(ge.home_score) OVER (
      PARTITION BY ge.game_id, ge.logged_by_side ORDER BY ge.sequence
    ) AS prev_home_score,
    LAG(ge.away_score) OVER (
      PARTITION BY ge.game_id, ge.logged_by_side ORDER BY ge.sequence
    ) AS prev_away_score
  FROM public.game_events ge
  WHERE ge.event_type = 'at_bat'
    AND ge.logged_by_side = 'home'
    -- Phase 4: identify "our pitcher on the mound" via payload.pitcherId
    -- presence rather than `player_id IS NULL` (which broke whenever the
    -- opposing program was linked — their batters had real player_ids).
    AND (ge.payload->>'pitcherId') IS NOT NULL
    -- Phase 3: exclude sub-events tagged on at_bat rows.
    AND COALESCE((ge.payload->>'pickoff')::boolean, false) IS NOT TRUE
    AND COALESCE((ge.payload->>'midGame')::boolean, false) IS NOT TRUE
    AND COALESCE((ge.payload->>'substitution')::boolean, false) IS NOT TRUE
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
-- Column names must match the original view definition (migration 19)
-- so CREATE OR REPLACE succeeds and dependent views (player_career_pitching,
-- player_season_pitching) keep working without a re-create chain.
SELECT
  pitcher_id AS player_id,
  game_id,
  COUNT(*)::int AS bf,
  COUNT(*) FILTER (WHERE (payload->>'outcome') IN ('K','GO','FO','SAC','FC'))::int AS outs,
  ROUND(
    (COUNT(*) FILTER (WHERE (payload->>'outcome') IN ('K','GO','FO','SAC','FC')))::numeric / 3.0,
    2
  ) AS ip,
  COUNT(*) FILTER (WHERE (payload->>'outcome') IN ('1B','2B','3B','HR'))::int AS h,
  COUNT(*) FILTER (WHERE (payload->>'outcome') = 'HR')::int AS hr,
  COUNT(*) FILTER (WHERE (payload->>'outcome') = 'BB')::int AS bb,
  COUNT(*) FILTER (WHERE (payload->>'outcome') = 'HBP')::int AS hbp,
  COUNT(*) FILTER (WHERE (payload->>'outcome') = 'K')::int AS k,
  COALESCE(SUM(runs_on_play), 0)::int AS r,
  -- ER == R for v1 (earned-run distinction lives in the application
  -- layer's box-score.ts; view-level ER is a safe upper bound).
  COALESCE(SUM(runs_on_play), 0)::int AS er,
  MIN(created_at) AS first_bf_at,
  MAX(created_at) AS last_bf_at
FROM attributed
GROUP BY pitcher_id, game_id;

ALTER VIEW public.player_game_pitching SET (security_invoker = off);
GRANT SELECT ON public.player_game_pitching TO anon, authenticated;
