-- Migration 31 — Game-day polish.
--
-- Three additive columns on `games` that unlock features on the
-- Game Detail page:
--
--   share_lineup            boolean   default false
--     Replaces the previous free-text `lineup_preview` field with a
--     toggle: when ON, the saved batting lineup (from the Lineup tab)
--     becomes visible to players on /me. When OFF, players see "Lineup
--     coming soon — coach is finalizing." Cleaner than asking the
--     coach to maintain two parallel sources of truth (preview text
--     vs. final lineup). Existing rows default OFF — coach has to
--     opt in to share.
--
--   scorekeeper_name        text
--     Free-text designation for a player or parent the coach trusts to
--     run live scoring. Shown on the prep sheet + visible to the
--     scorekeeper as "you're scoring this game" once we ship the
--     invite flow. Application-layer validation only.
--
--   scorekeeper_user_id     uuid
--     Foreign key to auth.users. When the designated person signs in,
--     they get scoped permission to insert game_events for THIS game
--     only. RLS policy update is in a follow-up migration once we
--     ship the actual scoring-share flow — for now the column is
--     just metadata so the UI can render "delegated to: <name>".
--
-- All idempotent; safe to apply against any environment.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS share_lineup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scorekeeper_name text,
  ADD COLUMN IF NOT EXISTS scorekeeper_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Comment columns so the schema is self-documenting.
COMMENT ON COLUMN public.games.share_lineup IS
  'When true, the saved batting lineup is visible to players on /me. When false, hidden until the coach toggles it on. Defaults false so a draft lineup never leaks before the coach intends to share.';

COMMENT ON COLUMN public.games.scorekeeper_name IS
  'Free-text name of the player or parent designated to run live scoring (e.g. "Tyler Smith — #12"). Presence enables the "Share scoring link" UI.';

COMMENT ON COLUMN public.games.scorekeeper_user_id IS
  'Optional auth user the scorekeeper-name points to. When non-null, that user gets game-scoped scoring permissions (RLS policy added in a follow-up migration).';
