-- Add unique constraint to prevent duplicate evaluation rows.
-- Without this, rapid score entry can create duplicate (player_id, metric_id, coach_id, attempt_number, session_id) rows.
-- The application layer now guards against this with a synchronous ref lock, but this provides DB-level safety.
--
-- NOTE: Before running this migration, check for existing duplicates:
--   SELECT player_id, metric_id, coach_id, attempt_number, session_id, COUNT(*)
--   FROM evaluations
--   WHERE session_id IS NOT NULL
--   GROUP BY player_id, metric_id, coach_id, attempt_number, session_id
--   HAVING COUNT(*) > 1;
--
-- If duplicates exist, resolve them first (keep the latest by updated_at, delete others).

CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluations_unique_score
ON public.evaluations (player_id, metric_id, coach_id, attempt_number, session_id)
WHERE session_id IS NOT NULL;
