
-- Add user_id to players for account linking
ALTER TABLE public.players ADD COLUMN user_id uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX idx_players_user_id ON public.players(user_id) WHERE user_id IS NOT NULL;

-- Program-level visibility master toggle
ALTER TABLE public.programs ADD COLUMN results_public boolean NOT NULL DEFAULT false;

-- Per-metric visibility (visible to players or not)
ALTER TABLE public.metrics ADD COLUMN visible_to_players boolean NOT NULL DEFAULT true;

-- Per-player visibility override (null = follow program default, true/false = override)
ALTER TABLE public.players ADD COLUMN results_visible boolean;

-- Allow players to view their own data when logged in
CREATE POLICY "Players can view own record"
ON public.players FOR SELECT
USING (auth.uid() = user_id);

-- Allow players to update their own profile fields
CREATE POLICY "Players can update own profile"
ON public.players FOR UPDATE
USING (auth.uid() = user_id);

-- Players can view evaluations for themselves if results are visible
CREATE POLICY "Players can view own evaluations"
ON public.evaluations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.programs pr ON pr.id = p.program_id
    WHERE p.id = evaluations.player_id
      AND p.user_id = auth.uid()
      AND (
        p.results_visible = true
        OR (p.results_visible IS NULL AND pr.results_public = true)
      )
  )
);

-- Players can view metrics for programs they belong to (to display names)
CREATE POLICY "Players can view program metrics"
ON public.metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.program_id = metrics.program_id
      AND p.user_id = auth.uid()
  )
);

-- Players can view the program they belong to
CREATE POLICY "Players can view own program"
ON public.programs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.program_id = programs.id
      AND p.user_id = auth.uid()
  )
);
