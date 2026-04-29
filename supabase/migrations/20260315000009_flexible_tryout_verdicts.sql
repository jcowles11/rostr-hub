-- Flexible tryout verdicts (v1)
--
-- The original tryouts migration (000008) hardcoded verdict values for
-- specific team names: 'lock', 'keep_varsity', 'keep_jv', 'keep_freshman',
-- 'bubble', 'cut'. That broke programs with team names other than those three
-- (e.g. "Sophomore", "C Team", "JV2"), which is a required feature per product
-- direction: a coach should be able to configure any number of teams with any
-- names.
--
-- This migration drops the CHECK constraint and redefines the verdict model:
--   verdict = NULL or 'bubble' → undecided
--   verdict = 'cut'            → player is cut
--   verdict = 'lock'           → locked onto top team (same team as index 0
--                                 in programs.levels)
--   verdict = <any other>      → assigned to that level (TEXT, case-insensitive
--                                 match against programs.levels)
--
-- Existing rows with the old enum values are preserved — the translation
-- layer in src/app/app/tryouts/actions.ts handles mapping legacy values to
-- the new model for backward compatibility during the transition.

-- Drop the restrictive CHECK.
ALTER TABLE public.tryout_attendees
  DROP CONSTRAINT IF EXISTS tryout_attendees_verdict_check;

-- Leave the column as plain TEXT with no CHECK — the application owns the
-- vocabulary (keywords 'bubble', 'cut', 'lock' + any configured team name).
-- Null stays valid.
