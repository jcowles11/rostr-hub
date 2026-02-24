
-- Create seasons table
CREATE TABLE public.seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Coaches can view seasons for their program
CREATE POLICY "Coaches can view seasons"
ON public.seasons FOR SELECT
USING (is_program_coach(auth.uid(), program_id));

-- Head coach can insert seasons
CREATE POLICY "Head coach can insert seasons"
ON public.seasons FOR INSERT
WITH CHECK (is_head_coach(auth.uid(), program_id));

-- Head coach can update seasons
CREATE POLICY "Head coach can update seasons"
ON public.seasons FOR UPDATE
USING (is_head_coach(auth.uid(), program_id));

-- Head coach can delete seasons
CREATE POLICY "Head coach can delete seasons"
ON public.seasons FOR DELETE
USING (is_head_coach(auth.uid(), program_id));

-- Add season_id to evaluations (nullable, null = unassigned)
ALTER TABLE public.evaluations ADD COLUMN season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL;

-- Add season_id to tryout_sessions (nullable)
ALTER TABLE public.tryout_sessions ADD COLUMN season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL;
