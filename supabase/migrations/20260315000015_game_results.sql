-- Game results (v1)
--
-- Lets a coach record the final of a game. Two ints (our score,
-- opponent score) + auto-computed result. The `games.status` column
-- flips from 'scheduled' → 'completed' when a result is recorded.
--
-- Full box scores (per-player batting/pitching lines) land later —
-- this migration is just the headline number so the Hub's record
-- stat tile and the game detail Recap tab have real content.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS our_score integer,
  ADD COLUMN IF NOT EXISTS opponent_score integer,
  ADD COLUMN IF NOT EXISTS recap_notes text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.coaches(id) ON DELETE SET NULL;

-- Derived result: 'W' | 'L' | 'T' | null. Stored as a generated column
-- so every query gets consistent W/L calculations without joining.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS result text
    GENERATED ALWAYS AS (
      CASE
        WHEN our_score IS NULL OR opponent_score IS NULL THEN NULL
        WHEN our_score > opponent_score THEN 'W'
        WHEN our_score < opponent_score THEN 'L'
        ELSE 'T'
      END
    ) STORED;

-- Useful index for fetching completed games by program + date desc
CREATE INDEX IF NOT EXISTS idx_games_completed_by_program
  ON public.games(program_id, game_date DESC)
  WHERE status = 'completed';

-- View: per-team-level W/L summary for the Coach Hub stat row.
CREATE OR REPLACE VIEW public.program_record_by_level AS
SELECT
  program_id,
  team_level,
  COUNT(*) FILTER (WHERE result = 'W')::int AS wins,
  COUNT(*) FILTER (WHERE result = 'L')::int AS losses,
  COUNT(*) FILTER (WHERE result = 'T')::int AS ties,
  COUNT(*)::int AS games_completed,
  SUM(our_score)::int AS runs_for,
  SUM(opponent_score)::int AS runs_against
FROM public.games
WHERE status = 'completed'
  AND our_score IS NOT NULL
  AND opponent_score IS NOT NULL
GROUP BY program_id, team_level;

GRANT SELECT ON public.program_record_by_level TO authenticated;

-- View: program-wide W/L record (all team levels combined)
CREATE OR REPLACE VIEW public.program_record_total AS
SELECT
  program_id,
  COUNT(*) FILTER (WHERE result = 'W')::int AS wins,
  COUNT(*) FILTER (WHERE result = 'L')::int AS losses,
  COUNT(*) FILTER (WHERE result = 'T')::int AS ties,
  COUNT(*)::int AS games_completed
FROM public.games
WHERE status = 'completed'
  AND our_score IS NOT NULL
  AND opponent_score IS NOT NULL
GROUP BY program_id;

GRANT SELECT ON public.program_record_total TO authenticated;
