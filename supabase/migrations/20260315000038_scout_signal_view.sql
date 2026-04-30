-- Migration 38 — Scout Signal view.
--
-- Powers the flag-gated /scout/discover ranking (Scout Signal +
-- Ranking Sprint). Exposes per-player counts of verified data points
-- so the application layer can compute a single `signal_score` per
-- player without N+1 lookups during search.
--
-- The view aggregates four sources into one row per player:
--
--   1. Verified highlights — count + max(verified_at) from
--      player_highlights where verified_by_coach = true.
--      Migration 35 added the columns.
--
--   2. Verified prior-season stats — count + max(verified_at) from
--      the per-row entries in players.prior_stats JSONB (migration 37
--      backfilled stable ids, so verified_at fields are reliable).
--      Done via LATERAL jsonb_array_elements + FILTER aggregates.
--
--   3. Tryout measurable presence — booleans (0/1) for whether the
--      player has any best_velo, best_ev, best_60yd, best_field,
--      best_bp from player_best_measurables (migration 8). These
--      are coach-recorded measurements, verified by definition.
--
--   4. latest_signal_at — GREATEST of (verified_highlights_at,
--      verified_prior_stats_at, latest_measurable_at). Powers a
--      recency component in the application-layer score formula.
--
-- The view DOES NOT compute a score itself — that lives in TypeScript
-- where the formula can be tweaked without an ALTER VIEW. SQL handles
-- the heavy aggregation in one pass.
--
-- security_invoker = OFF, GRANT SELECT to anon + authenticated. The
-- view doesn't filter on profile_public itself; callers join with
-- player_search (which does enforce that) when surfacing to scouts.
-- Coach-facing flows can read from the view directly via RLS on the
-- underlying tables.
--
-- Idempotent via CREATE OR REPLACE VIEW.

CREATE OR REPLACE VIEW public.player_scout_signal AS
WITH
  -- Per-player verified highlight aggregates.
  vh AS (
    SELECT
      player_id,
      COUNT(*)::int AS verified_highlights_count,
      MAX(verified_at) AS latest_highlight_at
    FROM public.player_highlights
    WHERE verified_by_coach = true
    GROUP BY player_id
  ),
  -- Per-player verified prior-stat aggregates. We unroll the JSONB
  -- array via LATERAL so each verified entry contributes one row;
  -- COUNT() with a FILTER on verified_by_coach gives us the count
  -- per player without separately filtering the lateral result.
  --
  -- Defensive: jsonb_typeof guard so a malformed prior_stats column
  -- (missing / null / non-array) doesn't error the view. Empty array
  -- yields zero rows — LEFT JOIN below gives a 0/null row for those
  -- players.
  vps AS (
    SELECT
      p.id AS player_id,
      COUNT(*) FILTER (
        WHERE COALESCE((e.value->>'verified_by_coach')::boolean, false) = true
      )::int AS verified_prior_stats_count,
      -- The verified_at field is a string in the JSONB shape; cast
      -- guarded with NULLIF so an empty string doesn't error.
      MAX(
        NULLIF(e.value->>'verified_at', '')::timestamptz
      ) FILTER (
        WHERE COALESCE((e.value->>'verified_by_coach')::boolean, false) = true
      ) AS latest_prior_stat_at
    FROM public.players p
    LEFT JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p.prior_stats) = 'array' THEN p.prior_stats
        ELSE '[]'::jsonb
      END
    ) AS e ON true
    GROUP BY p.id
  ),
  -- Per-player measurable presence + most-recent measurable update.
  -- Tryout scores ARE coach-recorded so each one counts as a verified
  -- data point. We surface presence flags (one per common station)
  -- so the application can score "has velo + 60yd" higher than
  -- "has only field score".
  bm AS (
    SELECT
      player_id,
      MAX(CASE WHEN short_code = 'Velo' THEN best_value END) AS best_velo,
      MAX(CASE WHEN short_code = 'EV' THEN best_value END) AS best_ev,
      MAX(CASE WHEN short_code = '60yd' THEN best_value END) AS best_60yd,
      MAX(CASE WHEN short_code = 'Field' THEN best_value END) AS best_field,
      MAX(CASE WHEN short_code = 'BP' THEN best_value END) AS best_bp,
      MAX(latest_at) AS latest_measurable_at
    FROM public.player_best_measurables
    GROUP BY player_id
  )
SELECT
  p.id AS player_id,
  COALESCE(vh.verified_highlights_count, 0) AS verified_highlights_count,
  COALESCE(vps.verified_prior_stats_count, 0) AS verified_prior_stats_count,
  -- Presence as 0/1 ints so the application can sum them up directly.
  (CASE WHEN bm.best_velo IS NOT NULL THEN 1 ELSE 0 END)::int AS has_velo,
  (CASE WHEN bm.best_ev IS NOT NULL THEN 1 ELSE 0 END)::int AS has_ev,
  (CASE WHEN bm.best_60yd IS NOT NULL THEN 1 ELSE 0 END)::int AS has_60yd,
  (CASE WHEN bm.best_field IS NOT NULL THEN 1 ELSE 0 END)::int AS has_field,
  (CASE WHEN bm.best_bp IS NOT NULL THEN 1 ELSE 0 END)::int AS has_bp,
  GREATEST(
    COALESCE(vh.latest_highlight_at, '-infinity'::timestamptz),
    COALESCE(vps.latest_prior_stat_at, '-infinity'::timestamptz),
    COALESCE(bm.latest_measurable_at, '-infinity'::timestamptz)
  ) AS latest_signal_at
FROM public.players p
LEFT JOIN vh ON vh.player_id = p.id
LEFT JOIN vps ON vps.player_id = p.id
LEFT JOIN bm ON bm.player_id = p.id;

ALTER VIEW public.player_scout_signal SET (security_invoker = off);
GRANT SELECT ON public.player_scout_signal TO anon, authenticated;

COMMENT ON VIEW public.player_scout_signal IS
  'Per-player aggregates for /scout/discover ranking (flag NEXT_PUBLIC_ENABLE_SCOUT_MODE). Joins verified highlight + prior-stat counts with measurable presence flags and a latest_signal_at timestamp. Application layer computes the final score.';
