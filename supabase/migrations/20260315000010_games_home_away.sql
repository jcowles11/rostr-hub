-- Add home_away column to games (v1)
--
-- The rostr-next app and its service layer both expect a games.home_away
-- column ('home' | 'away' | 'neutral') to render matchup prefixes like
-- "vs Central Hawks" vs "@ Central Hawks" on the schedule + hub + game
-- detail views. The original migration (000005_team_management) omitted
-- it. Adding now so the scheduling flow works end-to-end.
--
-- Default 'home' matches the app's create-game form default.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS home_away text NOT NULL DEFAULT 'home'
    CHECK (home_away IN ('home', 'away', 'neutral'));
