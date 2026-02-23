-- Add attempt tracking to evaluations
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1;

-- Add max attempts config to metrics
ALTER TABLE public.metrics ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 1;