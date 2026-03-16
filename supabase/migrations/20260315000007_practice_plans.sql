-- Practice Plans Module (v1)
--
-- Two tables:
--   practice_plans — header with date, team level, notes, sharing flag
--   practice_blocks — time blocks within a plan (activity, group, coach assignment)
--
-- Follows existing patterns: UUID PKs, ON DELETE CASCADE, RLS with coach program access.
-- Time stored as TEXT "HH:MM" for simplicity (no timezone complexity for practice schedules).

-- ── practice_plans ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.practice_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  practice_date date NOT NULL,
  team_level text,                          -- matches programs.levels entries
  title text NOT NULL DEFAULT 'Practice',
  notes text,
  shared_with_players boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_plans_program
  ON public.practice_plans(program_id, practice_date DESC);

ALTER TABLE public.practice_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: any coach in the program can view
CREATE POLICY "Coaches can view practice plans"
  ON public.practice_plans FOR SELECT
  USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));

-- INSERT: any coach in the program can create
CREATE POLICY "Coaches can create practice plans"
  ON public.practice_plans FOR INSERT
  WITH CHECK (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));

-- UPDATE: any coach in the program can update
CREATE POLICY "Coaches can update practice plans"
  ON public.practice_plans FOR UPDATE
  USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));

-- DELETE: head coaches only
CREATE POLICY "Head coaches can delete practice plans"
  ON public.practice_plans FOR DELETE
  USING (program_id IN (
    SELECT program_id FROM coaches
    WHERE user_id = auth.uid() AND role = 'head_coach'
  ));

-- ── practice_blocks ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.practice_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_plan_id uuid NOT NULL REFERENCES public.practice_plans(id) ON DELETE CASCADE,
  start_time text NOT NULL,                 -- "HH:MM" format, e.g. "15:00"
  end_time text NOT NULL,                   -- "HH:MM" format, e.g. "15:10"
  activity_name text NOT NULL,
  player_group text,                        -- optional: "IF", "OF", "Catchers", etc.
  assigned_coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_blocks_plan
  ON public.practice_blocks(practice_plan_id, sort_order);

ALTER TABLE public.practice_blocks ENABLE ROW LEVEL SECURITY;

-- SELECT: any coach whose program owns the parent plan
CREATE POLICY "Coaches can view practice blocks"
  ON public.practice_blocks FOR SELECT
  USING (practice_plan_id IN (
    SELECT pp.id FROM practice_plans pp
    JOIN coaches c ON c.program_id = pp.program_id
    WHERE c.user_id = auth.uid()
  ));

-- INSERT: any coach whose program owns the parent plan
CREATE POLICY "Coaches can create practice blocks"
  ON public.practice_blocks FOR INSERT
  WITH CHECK (practice_plan_id IN (
    SELECT pp.id FROM practice_plans pp
    JOIN coaches c ON c.program_id = pp.program_id
    WHERE c.user_id = auth.uid()
  ));

-- UPDATE: any coach whose program owns the parent plan
CREATE POLICY "Coaches can update practice blocks"
  ON public.practice_blocks FOR UPDATE
  USING (practice_plan_id IN (
    SELECT pp.id FROM practice_plans pp
    JOIN coaches c ON c.program_id = pp.program_id
    WHERE c.user_id = auth.uid()
  ));

-- DELETE: any coach whose program owns the parent plan
CREATE POLICY "Coaches can delete practice blocks"
  ON public.practice_blocks FOR DELETE
  USING (practice_plan_id IN (
    SELECT pp.id FROM practice_plans pp
    JOIN coaches c ON c.program_id = pp.program_id
    WHERE c.user_id = auth.uid()
  ));
