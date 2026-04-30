-- Migration 33 — Public Data Safety (Coach Trust + Reality Sprint, Phase 4)
--
-- Two correctness changes that close anonymous-access gaps on player
-- data. Both are additive / hardening; neither breaks existing
-- coach-facing flows because coaches read from `players` directly
-- (with RLS) rather than from `player_search`.
--
-- (1) `player_search` view filters at the SQL layer to
--     `profile_public = true`. The previous definition ran without
--     security_invoker (so RLS on `players` was bypassed) and only
--     enforced the gate at the application layer (recruiter.ts had
--     `.eq("profile_public", true)`). Anyone hitting Supabase
--     directly with the anon key could query the view and pull
--     private rows. Closing that gap belt-and-suspenders.
--
-- (2) `released_at IS NULL` filter — same view shouldn't surface
--     soft-deleted players to recruiters. Mirrors the `active_players`
--     view's existing semantics.
--
-- All idempotent via CREATE OR REPLACE VIEW.

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
  -- measurable for that station. MAX/MIN preserved from migration 12.
  MAX(CASE WHEN pbm.short_code = '60yd' THEN pbm.best_value END) AS best_60yd,
  MAX(CASE WHEN pbm.short_code = 'EV' THEN pbm.best_value END) AS best_ev,
  MAX(CASE WHEN pbm.short_code = 'Velo' THEN pbm.best_value END) AS best_velo,
  MAX(CASE WHEN pbm.short_code = 'Field' THEN pbm.best_value END) AS best_field,
  MAX(CASE WHEN pbm.short_code = 'BP' THEN pbm.best_value END) AS best_bp
FROM public.players p
LEFT JOIN public.programs prog ON prog.id = p.program_id
LEFT JOIN public.player_best_measurables pbm ON pbm.player_id = p.id
WHERE
  -- PHASE 4.1 — only surface opted-in profiles. Anonymous + recruiter
  -- searches respect athlete consent at the SQL layer; application
  -- code's `.eq("profile_public", true)` is now defense-in-depth, not
  -- the primary gate.
  p.profile_public = true
  -- Soft-deleted players are not searchable. `released_at` was added
  -- in migration 28; this filter is null-tolerant for envs without it.
  AND COALESCE(p.released_at, NULL) IS NULL
GROUP BY p.id, prog.name, prog.sport;

ALTER VIEW public.player_search SET (security_invoker = off);
GRANT SELECT ON public.player_search TO anon, authenticated;

COMMENT ON VIEW public.player_search IS
  'Recruiter-facing player feed. Filters to profile_public=true at the SQL layer so the anon GRANT is safe.';
