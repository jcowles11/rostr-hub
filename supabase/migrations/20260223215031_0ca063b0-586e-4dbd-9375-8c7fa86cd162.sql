
-- New evaluators table
CREATE TABLE public.evaluators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  organization_name text NOT NULL DEFAULT '',
  title text,
  sport text NOT NULL DEFAULT 'baseball',
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.evaluators ENABLE ROW LEVEL SECURITY;

-- New evaluator_entries table
CREATE TABLE public.evaluator_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluator_id uuid NOT NULL REFERENCES public.evaluators(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text NOT NULL DEFAULT '',
  metric_type text NOT NULL DEFAULT 'measured',
  event_name text,
  event_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.evaluator_entries ENABLE ROW LEVEL SECURITY;

-- RLS for evaluators
CREATE POLICY "Evaluators can view own profile" ON public.evaluators
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Evaluators can update own profile" ON public.evaluators
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Evaluators can insert own profile" ON public.evaluators
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view evaluators" ON public.evaluators
  FOR SELECT USING (true);

-- RLS for evaluator_entries
CREATE POLICY "Evaluators can insert entries" ON public.evaluator_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.evaluators e WHERE e.id = evaluator_id AND e.user_id = auth.uid())
  );
CREATE POLICY "Evaluators can update own entries" ON public.evaluator_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.evaluators e WHERE e.id = evaluator_id AND e.user_id = auth.uid())
  );
CREATE POLICY "Evaluators can delete own entries" ON public.evaluator_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.evaluators e WHERE e.id = evaluator_id AND e.user_id = auth.uid())
  );
CREATE POLICY "Public can view entries" ON public.evaluator_entries
  FOR SELECT USING (true);

-- Update get_public_profile to include evaluator entries
CREATE OR REPLACE FUNCTION public.get_public_profile(_slug text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'player', json_build_object(
      'first_name', p.first_name, 'last_name', p.last_name,
      'positions', p.positions, 'photo_url', p.photo_url,
      'graduation_year', p.graduation_year, 'height', p.height,
      'weight', p.weight, 'gpa', CASE WHEN p.show_contact_info THEN p.gpa ELSE NULL END,
      'social_twitter', CASE WHEN p.show_contact_info THEN p.social_twitter ELSE NULL END,
      'social_instagram', CASE WHEN p.show_contact_info THEN p.social_instagram ELSE NULL END,
      'highlight_video_url', p.highlight_video_url,
      'profile_slug', p.profile_slug
    ),
    'program', json_build_object(
      'name', pr.name, 'school_name', pr.school_name,
      'sport', pr.sport, 'logo_url', pr.logo_url
    ),
    'metrics', (
      SELECT COALESCE(json_agg(json_build_object(
        'name', m.name, 'unit', m.unit, 'metric_type', m.metric_type,
        'value', sub.agg_value, 'verified', true,
        'source_type', 'program',
        'source_name', pr.name
      )), '[]'::json)
      FROM metrics m
      INNER JOIN (
        SELECT e.metric_id, 
          CASE WHEN m2.metric_type = 'timed' THEN MIN(e.value) ELSE MAX(e.value) END as agg_value
        FROM evaluations e
        JOIN metrics m2 ON m2.id = e.metric_id
        WHERE e.player_id = p.id AND m2.visible_to_players = true
        GROUP BY e.metric_id, m2.metric_type
      ) sub ON sub.metric_id = m.id
      WHERE m.program_id = p.program_id AND m.visible_to_players = true
    ),
    'evaluator_metrics', (
      SELECT COALESCE(json_agg(json_build_object(
        'name', ee.metric_name, 'unit', ee.metric_unit, 'metric_type', ee.metric_type,
        'value', ee.metric_value, 'verified', true,
        'source_type', 'evaluator',
        'source_name', ev.full_name,
        'source_org', ev.organization_name,
        'event_name', ee.event_name,
        'event_date', ee.event_date,
        'created_at', ee.created_at
      )), '[]'::json)
      FROM evaluator_entries ee
      JOIN evaluators ev ON ev.id = ee.evaluator_id
      WHERE ee.player_id = p.id
    )
  ) INTO result
  FROM players p
  JOIN programs pr ON pr.id = p.program_id
  WHERE p.profile_slug = _slug AND p.profile_public = true;

  RETURN result;
END;
$function$;
