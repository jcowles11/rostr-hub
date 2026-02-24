
-- 1. Make program_id nullable on players (allows standalone profiles)
ALTER TABLE public.players ALTER COLUMN program_id DROP NOT NULL;

-- 2. Add birthday and high_school columns
ALTER TABLE public.players ADD COLUMN birthday date;
ALTER TABLE public.players ADD COLUMN high_school text;

-- 3. Create player_club_teams table
CREATE TABLE public.player_club_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.player_club_teams ENABLE ROW LEVEL SECURITY;

-- Players can manage their own club teams
CREATE POLICY "Players can view own club teams"
  ON public.player_club_teams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = player_club_teams.player_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Players can insert own club teams"
  ON public.player_club_teams FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = player_club_teams.player_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Players can update own club teams"
  ON public.player_club_teams FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = player_club_teams.player_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Players can delete own club teams"
  ON public.player_club_teams FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = player_club_teams.player_id AND p.user_id = auth.uid()
  ));

-- Coaches can view club teams for their program players
CREATE POLICY "Coaches can view player club teams"
  ON public.player_club_teams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = player_club_teams.player_id AND is_program_coach(auth.uid(), p.program_id)
  ));

-- Public can view club teams for public profiles
CREATE POLICY "Public can view public player club teams"
  ON public.player_club_teams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = player_club_teams.player_id AND p.profile_public = true
  ));

-- 4. Add RLS policy so standalone players can insert their own record
CREATE POLICY "Standalone player self-registration"
  ON public.players FOR INSERT
  WITH CHECK (auth.uid() = user_id AND program_id IS NULL);

-- 5. Update the get_public_profile function to include birthday, high_school, and handle null program_id
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
      'profile_slug', p.profile_slug,
      'bats', p.bats, 'throws', p.throws,
      'recruiting_status', p.recruiting_status,
      'committed_school_name', p.committed_school_name,
      'committed_school_logo_url', p.committed_school_logo_url,
      'commitment_date', p.commitment_date,
      'city', p.city, 'state', p.state,
      'email', CASE WHEN p.show_contact_info THEN p.email ELSE NULL END,
      'phone', CASE WHEN p.show_contact_info THEN p.phone ELSE NULL END,
      'gamechanger_profile_url', p.gamechanger_profile_url,
      'maxpreps_profile_url', p.maxpreps_profile_url,
      'birthday', p.birthday,
      'high_school', p.high_school,
      'grade', p.grade
    ),
    'program', CASE WHEN pr.id IS NOT NULL THEN json_build_object(
      'name', pr.name, 'school_name', pr.school_name,
      'sport', pr.sport, 'logo_url', pr.logo_url
    ) ELSE NULL END,
    'club_teams', (
      SELECT COALESCE(json_agg(json_build_object(
        'name', ct.name, 'is_current', ct.is_current
      )), '[]'::json)
      FROM player_club_teams ct WHERE ct.player_id = p.id
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
        'evaluator_id', ev.id,
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
  LEFT JOIN programs pr ON pr.id = p.program_id
  WHERE p.profile_slug = _slug AND p.profile_public = true;

  RETURN result;
END;
$function$;
