-- Soft delete for players.
--
-- Why: a coach who hard-deletes a player mid-season loses every stat
-- line, every announcement, every recruiter view that ever pointed at
-- that kid. That's wrong — released players still belong to the team's
-- historical record, and the public profile / college coach links
-- recruiters already saved should not 404 the day after a roster cut.
--
-- This migration:
--   1. Adds `released_at` (nullable timestamptz) to the players table.
--   2. Backfills NULL — every existing player is treated as still on
--      the active roster.
--   3. Provides a tiny helper view `active_players` for callers that
--      explicitly want only the active roster (the default in the UI).
--
-- Reads stay simple: the service layer filters `released_at IS NULL`
-- in the active-roster code paths, and exposes a separate "released"
-- view for season recap and historical lookups.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS release_note text;

-- Index on (program_id, released_at) so the active-roster query stays
-- fast even on a roster history of 200+ across multiple seasons.
CREATE INDEX IF NOT EXISTS idx_players_program_released
  ON public.players(program_id, released_at);

-- Convenience view for callers that want the active roster only.
-- Equivalent to `WHERE released_at IS NULL`. Optional sugar — the
-- service layer doesn't depend on it.
CREATE OR REPLACE VIEW public.active_players AS
  SELECT *
  FROM public.players
  WHERE released_at IS NULL;

GRANT SELECT ON public.active_players TO authenticated;
