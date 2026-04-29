-- Saved-search "new matches" diffing
--
-- A saved search is only sticky if the recruiter has a reason to come
-- back to it. We store a snapshot of the player_ids that matched the
-- last time the recruiter ran it — that lets us compute a `new_matches`
-- count every time they load the searches list.
--
-- The flow:
--   1. Recruiter runs the search (or creates it). We compute results
--      and write the player_id array into last_run_player_ids.
--   2. Later, the recruiter visits /scout/searches. The server re-runs
--      each search and compares current matches against the stored
--      baseline.
--   3. Recruiter clicks "Run" on a search → view renders with new
--      matches highlighted, and the baseline updates on render.
--
-- This is pull-based (no cron needed). Email/push alerts can layer on
-- top later by running this same diff in a scheduled function and
-- firing messages when `new_matches` > 0.

ALTER TABLE public.recruiter_saved_searches
  ADD COLUMN IF NOT EXISTS last_run_player_ids uuid[] DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

-- Backfill existing rows with an empty baseline so the first "new
-- matches" count is meaningful — everyone currently matching shows
-- as "new" on the first post-migration run, which is honest.
UPDATE public.recruiter_saved_searches
  SET last_run_player_ids = COALESCE(last_run_player_ids, ARRAY[]::uuid[]);

COMMENT ON COLUMN public.recruiter_saved_searches.last_run_player_ids IS
  'Snapshot of player_ids that matched this search at last_run_at. '
  'Used to compute "N new matches since last run" on the searches list.';

COMMENT ON COLUMN public.recruiter_saved_searches.last_viewed_at IS
  'When the recruiter last ran (viewed) this search. Separate from '
  'last_run_at to allow background alert jobs without changing the '
  'recruiter''s perceived "new matches" count.';
