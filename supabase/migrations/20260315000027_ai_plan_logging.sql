-- AI Assistant Coach observability tables.
--
-- Two tables: one row per generation+apply (ai_plan_generations) and
-- one row per coach 👍/👎 reaction (ai_plan_feedback). The generations
-- table stores the full input context + output blocks as JSON so we
-- can audit "what did we ask, what did the model say" without needing
-- to re-run inference.
--
-- These tables exist to:
--   1. Drive the basic feedback loop (Phase 4 — recent up/down trends
--      get injected into the system prompt for future generations).
--   2. Give us an audit trail when a coach reports a bad plan.
--   3. Make it possible to compute usage metrics later (no dashboard
--      this sprint — additive only).
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, DO blocks for policies).

-- ── ai_plan_generations ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_plan_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  -- Plan the AI was applied to. SET NULL on delete so generations
  -- survive the plan being deleted (so feedback signal isn't lost).
  plan_id uuid REFERENCES public.practice_plans(id) ON DELETE SET NULL,
  -- The full input that produced this output. Includes field constraint,
  -- available minutes, focus text, team level, and the trimmed roster
  -- summary the model saw. Stored as jsonb for queryability.
  input_context jsonb NOT NULL,
  -- The structured blocks returned by Claude (post-validation).
  output_blocks jsonb NOT NULL,
  -- How the coach applied the proposal: append, replace, or "discarded"
  -- (proposal viewed but not applied — set if we ever wire that path).
  mode text NOT NULL CHECK (mode IN ('append', 'replace', 'discarded')),
  -- Convenience field for queryability without parsing input_context.
  field_constraint text,
  total_blocks integer,
  total_minutes integer,
  model text,
  tokens_in integer,
  tokens_out integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_plan_generations_program_recent
  ON public.ai_plan_generations(program_id, created_at DESC);

ALTER TABLE public.ai_plan_generations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_plan_generations' AND policyname = 'Coaches read own AI generations') THEN
    CREATE POLICY "Coaches read own AI generations"
      ON public.ai_plan_generations FOR SELECT
      USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_plan_generations' AND policyname = 'Coaches insert own AI generations') THEN
    CREATE POLICY "Coaches insert own AI generations"
      ON public.ai_plan_generations FOR INSERT
      WITH CHECK (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ── ai_plan_feedback ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_plan_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES public.ai_plan_generations(id) ON DELETE CASCADE,
  -- Denormalized for RLS + cheap aggregation queries.
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  -- 1 = thumbs up, -1 = thumbs down. Single coach can change their mind:
  -- UNIQUE (generation_id, created_by) and the action UPSERTs against it.
  rating smallint NOT NULL CHECK (rating IN (1, -1)),
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (generation_id, created_by)
);

CREATE INDEX IF NOT EXISTS idx_ai_plan_feedback_program_recent
  ON public.ai_plan_feedback(program_id, created_at DESC);

ALTER TABLE public.ai_plan_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_plan_feedback' AND policyname = 'Coaches manage own AI feedback') THEN
    CREATE POLICY "Coaches manage own AI feedback"
      ON public.ai_plan_feedback FOR ALL
      USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()))
      WITH CHECK (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Touch updated_at on rating change (when a coach flips their vote).
CREATE OR REPLACE FUNCTION public.touch_ai_plan_feedback_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_plan_feedback_touch') THEN
    CREATE TRIGGER trg_ai_plan_feedback_touch
      BEFORE UPDATE ON public.ai_plan_feedback
      FOR EACH ROW EXECUTE FUNCTION public.touch_ai_plan_feedback_updated_at();
  END IF;
END $$;
