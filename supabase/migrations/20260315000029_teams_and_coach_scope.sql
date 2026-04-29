-- Multi-team coach assignment + organization-level scope.
--
-- Background:
--   - `programs.levels` (text[]) was the original way to express "this
--     program has Varsity, JV, C-Team, Freshman" — but it doesn't let
--     you assign coaches to a specific level.
--   - `organizations` + `teams` tables already exist in stub form.
--     `programs` already has `organization_id`. But coaches still can
--     only join a `program_id`; there's no team-scoped coach concept.
--
-- This migration:
--   1. Extends `organizations` with `kind` (school/club/district) +
--      city/state for the directory display.
--   2. Extends `teams` with `short_code`, `sort_order`, `archived_at` so
--      the UI has enough metadata to render a real team picker.
--   3. Extends `coaches` with `team_id` (nullable) + `organization_id`
--      (nullable) + `scope` so a coach row can be:
--         scope='team'         → manages one team within a program
--         scope='program'      → program-wide head coach (legacy
--                                default; existing rows stay this way)
--         scope='organization' → AD-style oversight across the whole
--                                org (program_id null, org_id set)
--   4. Adds `roster_assignments.team_id` so player→team is a real FK
--      (the `assignment` text column stays as a fallback during
--      migration; new code reads team_id when present).
--   5. Backfills `teams` rows for every existing (program, level) combo
--      so the UI has something to show on day one.
--   6. Backfills `roster_assignments.team_id` by matching the existing
--      `assignment` text to the new team's name.
--
-- Idempotent: every change uses IF NOT EXISTS / DO blocks. Safe to
-- re-run.

-- ── 1. Extend organizations ──────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'school'
    CHECK (kind IN ('school', 'club', 'district', 'other')),
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS website text;

-- ── 2. Extend teams ─────────────────────────────────────────────

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS short_code text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- One team per program with the same name (case-insensitive). Avoids
-- accidentally creating duplicate "Varsity" rows during backfill.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'teams_program_name_unique'
  ) THEN
    CREATE UNIQUE INDEX teams_program_name_unique
      ON public.teams (program_id, lower(name));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teams_program_active
  ON public.teams (program_id) WHERE archived_at IS NULL;

-- ── 3. Extend coaches with scope ────────────────────────────────

ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'program'
    CHECK (scope IN ('organization', 'program', 'team'));

-- Backfill coaches.organization_id from the program's org so AD-level
-- queries can JOIN through coaches without a 3-table dance.
UPDATE public.coaches c
SET organization_id = p.organization_id
FROM public.programs p
WHERE c.program_id = p.id
  AND c.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coaches_team
  ON public.coaches (team_id) WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coaches_org
  ON public.coaches (organization_id) WHERE organization_id IS NOT NULL;

-- A coach can be at most one record per (user, scope, target). Without
-- this, an "Add coach" UI bug could insert duplicates. The constraint
-- is loose on purpose — a single user can hold multiple roles (e.g.
-- AD at the org + assistant at one team) but each combo is unique.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'coaches_user_scope_target_unique'
  ) THEN
    CREATE UNIQUE INDEX coaches_user_scope_target_unique
      ON public.coaches (
        user_id,
        scope,
        coalesce(team_id::text, ''),
        coalesce(program_id::text, ''),
        coalesce(organization_id::text, '')
      );
  END IF;
END $$;

-- ── 4. Extend roster_assignments with team_id ───────────────────

ALTER TABLE public.roster_assignments
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roster_assignments_team
  ON public.roster_assignments (team_id) WHERE team_id IS NOT NULL;

-- ── 5. Backfill teams from programs.levels ──────────────────────
--
-- For every (program, level) in programs.levels, ensure a teams row
-- exists. Skip 'cut' — that's not a team, it's a roster status. Order
-- the teams in the same order they appear in the levels array.

DO $$
DECLARE
  prog RECORD;
  level_name text;
  idx int;
BEGIN
  FOR prog IN SELECT id, levels FROM public.programs WHERE levels IS NOT NULL LOOP
    idx := 0;
    FOREACH level_name IN ARRAY prog.levels LOOP
      idx := idx + 1;
      -- Skip 'cut' — that's a status, not a team.
      IF lower(level_name) = 'cut' THEN
        CONTINUE;
      END IF;
      INSERT INTO public.teams (program_id, name, short_code, sort_order)
      VALUES (
        prog.id,
        level_name,
        substring(upper(level_name), 1, 2),
        idx
      )
      ON CONFLICT (program_id, lower(name)) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ── 6. Backfill roster_assignments.team_id ──────────────────────
--
-- Match assignment text (case-insensitive) to a team within the same
-- program. Skip 'cut' rows — those are status rows, not team
-- assignments.

UPDATE public.roster_assignments ra
SET team_id = t.id
FROM public.teams t
WHERE ra.team_id IS NULL
  AND ra.program_id = t.program_id
  AND lower(ra.assignment) = lower(t.name)
  AND lower(ra.assignment) <> 'cut';

-- ── 7. updated_at touch trigger on teams ────────────────────────

CREATE OR REPLACE FUNCTION public.touch_team_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_teams_touch') THEN
    CREATE TRIGGER trg_teams_touch
      BEFORE UPDATE ON public.teams
      FOR EACH ROW EXECUTE FUNCTION public.touch_team_updated_at();
  END IF;
END $$;

-- ── 8. RLS policies on the new shape ────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Coaches read their organization (any coach role) — needed for the
-- org switcher / staff list / AD oversight. Org admins can write.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organizations' AND policyname='Coaches read own org') THEN
    CREATE POLICY "Coaches read own org"
      ON public.organizations FOR SELECT
      USING (id IN (
        SELECT organization_id FROM public.coaches
        WHERE user_id = auth.uid() AND organization_id IS NOT NULL
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organizations' AND policyname='Org admins update org') THEN
    CREATE POLICY "Org admins update org"
      ON public.organizations FOR UPDATE
      USING (id IN (
        SELECT organization_id FROM public.coaches
        WHERE user_id = auth.uid() AND scope = 'organization'
      ));
  END IF;
END $$;

-- Coaches read teams in their program(s); head coaches can manage them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teams' AND policyname='Coaches read own teams') THEN
    CREATE POLICY "Coaches read own teams"
      ON public.teams FOR SELECT
      USING (program_id IN (
        SELECT program_id FROM public.coaches WHERE user_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teams' AND policyname='Head coaches manage teams') THEN
    CREATE POLICY "Head coaches manage teams"
      ON public.teams FOR ALL
      USING (program_id IN (
        SELECT program_id FROM public.coaches
        WHERE user_id = auth.uid()
          AND role = 'head_coach'
          AND scope IN ('program', 'organization')
      ))
      WITH CHECK (program_id IN (
        SELECT program_id FROM public.coaches
        WHERE user_id = auth.uid()
          AND role = 'head_coach'
          AND scope IN ('program', 'organization')
      ));
  END IF;
END $$;
