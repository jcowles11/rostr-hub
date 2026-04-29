-- Practice planning persistence — extends the existing practice_plans
-- and practice_blocks tables (migration 000007) with the columns the
-- new planner UI requires, and creates a coach-customizable drill library.
--
-- Why extension vs new tables:
--   The original 000007 schema is time-window based (start_time/end_time
--   text) and is already queried by /me + /app/today + /app/schedule for
--   "upcoming practices." Replacing it would break those reads. The new
--   planner is duration-based (duration_min integer), but both models
--   coexist on the same table — old rows keep their start/end_time, new
--   rows use duration_min.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS
-- + DO blocks that check pg_policies / pg_trigger before creating.

-- ── practice_plans: add planner-era columns ────────────────────

ALTER TABLE public.practice_plans
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS field_constraint text
    CHECK (field_constraint IS NULL OR field_constraint IN (
      'full_field', 'cages_only', 'generic_grass', 'indoor_gym', 'parking_lot'
    )),
  ADD COLUMN IF NOT EXISTS ai_brief_text text;

-- ── practice_blocks: relax start/end + add planner columns ─────

-- Existing rows have start_time/end_time strings; new rows from the
-- planner use duration_min. Drop NOT NULL on the time columns so the
-- planner can write rows without them.
ALTER TABLE public.practice_blocks
  ALTER COLUMN start_time DROP NOT NULL,
  ALTER COLUMN end_time DROP NOT NULL;

ALTER TABLE public.practice_blocks
  ADD COLUMN IF NOT EXISTS duration_min integer
    CHECK (duration_min IS NULL OR (duration_min > 0 AND duration_min <= 180)),
  ADD COLUMN IF NOT EXISTS lane text NOT NULL DEFAULT 'main'
    CHECK (lane IN ('main', 'secondary')),
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IS NULL OR category IN (
      'hit', 'def', 'bases', 'pitch', 'cond', 'warm', 'cool'
    )),
  ADD COLUMN IF NOT EXISTS focus_text text,
  ADD COLUMN IF NOT EXISTS drill_id uuid;

-- Backfill: existing rows get a sensible default category so the new UI
-- can still display them. NULL category means "uncategorized" — UI shows
-- as gray. Skip the backfill; existing rows from 000007 are demo data.

-- ── practice_drills (new) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.practice_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_duration integer NOT NULL DEFAULT 15
    CHECK (default_duration > 0 AND default_duration <= 180),
  focus text,
  category text NOT NULL CHECK (category IN (
    'hit', 'def', 'bases', 'pitch', 'cond', 'warm', 'cool'
  )),
  source text NOT NULL DEFAULT 'custom'
    CHECK (source IN ('library', 'custom')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Library drills are unique per program by name; coach can rename or
  -- delete a library drill, and a fresh seed won't re-add it.
  -- Custom drills can repeat names if the coach really wants to.
  UNIQUE (program_id, name, source)
);

CREATE INDEX IF NOT EXISTS idx_practice_drills_program
  ON public.practice_drills(program_id, category);

ALTER TABLE public.practice_drills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'practice_drills' AND policyname = 'Coaches manage own drills') THEN
    CREATE POLICY "Coaches manage own drills"
      ON public.practice_drills FOR ALL
      USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()))
      WITH CHECK (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Now that practice_drills exists, attach the FK from practice_blocks.drill_id.
-- Done in a separate ALTER so the column add above didn't fail when the
-- drills table didn't yet exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'practice_blocks'
      AND constraint_name = 'practice_blocks_drill_id_fkey'
  ) THEN
    ALTER TABLE public.practice_blocks
      ADD CONSTRAINT practice_blocks_drill_id_fkey
      FOREIGN KEY (drill_id) REFERENCES public.practice_drills(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ── updated_at touch trigger on practice_plans ─────────────────

CREATE OR REPLACE FUNCTION public.touch_practice_plan_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_practice_plans_touch') THEN
    CREATE TRIGGER trg_practice_plans_touch
      BEFORE UPDATE ON public.practice_plans
      FOR EACH ROW EXECUTE FUNCTION public.touch_practice_plan_updated_at();
  END IF;
END $$;

-- Touch parent plan when blocks are inserted/updated/deleted so the
-- "last edited" timestamp on the plan is always accurate.
CREATE OR REPLACE FUNCTION public.touch_parent_plan_on_block_change()
RETURNS trigger AS $$
BEGIN
  UPDATE public.practice_plans
  SET updated_at = now()
  WHERE id = COALESCE(NEW.practice_plan_id, OLD.practice_plan_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_practice_blocks_touch_parent') THEN
    CREATE TRIGGER trg_practice_blocks_touch_parent
      AFTER INSERT OR UPDATE OR DELETE ON public.practice_blocks
      FOR EACH ROW EXECUTE FUNCTION public.touch_parent_plan_on_block_change();
  END IF;
END $$;

-- ── Default drill seed ────────────────────────────────────────
--
-- Mirrors the hardcoded library that ships in app/practice/page.tsx so
-- existing programs see no library change. New programs get the same
-- seed lazily via the service layer's getDrillLibrary() helper.

CREATE OR REPLACE FUNCTION public.seed_default_practice_drills(p_program_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.practice_drills (program_id, name, default_duration, focus, category, source)
  VALUES
    -- Hitting
    (p_program_id, 'Tee work — inside/outside', 15, '3 stations · 30 reps each', 'hit', 'library'),
    (p_program_id, 'Front toss — two strikes', 20, 'Shorten up, battle approach', 'hit', 'library'),
    (p_program_id, 'Machine BP — offspeed', 25, '60 mph · slider', 'hit', 'library'),
    (p_program_id, 'Live BP — game speed', 30, 'Coach throws, full count situations', 'hit', 'library'),
    (p_program_id, 'Soft toss — opposite field', 10, 'Stay back, drive the other way', 'hit', 'library'),
    -- Defense (includes live/situational defensive drills)
    (p_program_id, 'Infield groundballs', 20, 'Short hop, backhand, slow roller', 'def', 'library'),
    (p_program_id, 'Double play turn — 6 to 4', 15, 'Footwork + exchange', 'def', 'library'),
    (p_program_id, 'Outfield crossover + read', 15, 'Fly ball reads, tracking', 'def', 'library'),
    (p_program_id, 'Catcher blocking', 15, 'Inside / outside / direct', 'def', 'library'),
    (p_program_id, 'Bunt defense', 12, 'Wheel, rotation, communicate', 'def', 'library'),
    (p_program_id, '1st & 3rd live', 22, 'Cutoffs + relay reads · live runners', 'def', 'library'),
    (p_program_id, 'Cutoffs + relays', 18, 'Outfield → cutoff → tag · all situations', 'def', 'library'),
    (p_program_id, 'Inning simulation — bottom 9', 25, 'Coach plays GM · all defensive situations rotate', 'def', 'library'),
    (p_program_id, 'Run-down (pickle) work', 12, '1st-2nd, 2nd-3rd, 3rd-home · two-throw rule', 'def', 'library'),
    -- Pitching (mound work / live-arm — long toss is warm-up)
    (p_program_id, 'Bullpen — 25 pitch', 15, 'FB/CH/SL mix', 'pitch', 'library'),
    (p_program_id, 'PFP — pitcher fielding', 15, 'Comebackers, covers, bunts', 'pitch', 'library'),
    (p_program_id, 'Live ABs vs hitters', 25, 'Game-like pitch sequence', 'pitch', 'library'),
    (p_program_id, 'Flat ground — pitch design', 15, 'Spin work, tunnel drills', 'pitch', 'library'),
    -- Baserunning
    (p_program_id, 'Secondary leads + read', 10, '1st → 2nd on contact', 'bases', 'library'),
    (p_program_id, 'First-to-third reads', 12, 'Aggressive turns, pickup the coach', 'bases', 'library'),
    (p_program_id, 'Stealing 2nd — jump work', 15, 'Lead, primary, secondary, dive', 'bases', 'library'),
    -- Conditioning
    (p_program_id, 'Pole to pole x 4', 8, '50 / 75 / 90 / 100% intent', 'cond', 'library'),
    (p_program_id, 'Agility ladder', 10, 'First-step quickness', 'cond', 'library'),
    -- Warm-up
    (p_program_id, 'Dynamic warm + bands', 15, 'J-bands, hip openers, leg swings', 'warm', 'library'),
    (p_program_id, 'Long toss progression', 12, '45 → 90 → 120 ft · arm-care progression', 'warm', 'library'),
    (p_program_id, 'Throwing program (partner)', 10, '10 → 20 → 30 → 45 ft buildup', 'warm', 'library'),
    (p_program_id, 'Pre-practice run / jog', 8, '3 laps at 60% · loose hips', 'warm', 'library'),
    -- Cool-down
    (p_program_id, 'Team stretch + huddle', 8, 'Static stretch, message of the day', 'cool', 'library'),
    (p_program_id, 'Recovery jog + foam roll', 10, 'Lower-body flush, message of the day', 'cool', 'library')
  ON CONFLICT (program_id, name, source) DO NOTHING;
END;
$$;

-- Backfill: seed every existing program so coaches with existing
-- accounts open the planner and find the library populated.
DO $$
DECLARE
  prog_id uuid;
BEGIN
  FOR prog_id IN SELECT id FROM public.programs LOOP
    PERFORM public.seed_default_practice_drills(prog_id);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.seed_default_practice_drills(uuid) TO authenticated;
