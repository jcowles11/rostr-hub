
-- Add recruiting/commitment fields to players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS recruiting_status text NOT NULL DEFAULT 'uncommitted',
  ADD COLUMN IF NOT EXISTS committed_school_name text,
  ADD COLUMN IF NOT EXISTS committed_school_logo_url text,
  ADD COLUMN IF NOT EXISTS commitment_date date,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS gamechanger_profile_url text,
  ADD COLUMN IF NOT EXISTS maxpreps_profile_url text;

-- Add validation trigger for recruiting_status
CREATE OR REPLACE FUNCTION public.validate_recruiting_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.recruiting_status NOT IN ('uncommitted', 'committed') THEN
    RAISE EXCEPTION 'Invalid recruiting_status: %', NEW.recruiting_status;
  END IF;
  IF NEW.recruiting_status = 'committed' AND (NEW.committed_school_name IS NULL OR NEW.committed_school_name = '') THEN
    RAISE EXCEPTION 'committed_school_name is required when status is committed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_player_recruiting_status
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_recruiting_status();

-- Update the get_public_profile function to include new fields
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
      'maxpreps_profile_url', p.maxpreps_profile_url
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
  JOIN programs pr ON pr.id = p.program_id
  WHERE p.profile_slug = _slug AND p.profile_public = true;

  RETURN result;
END;
$function$;

-- Update search_public_players to include commitment data
CREATE OR REPLACE FUNCTION public.search_public_players(_sport text DEFAULT NULL::text, _positions text[] DEFAULT NULL::text[], _grad_year_min integer DEFAULT NULL::integer, _grad_year_max integer DEFAULT NULL::integer, _bats text DEFAULT NULL::text, _throws text DEFAULT NULL::text, _name_search text DEFAULT NULL::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _recruiting_status text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT COALESCE(json_agg(row_data), '[]'::json) INTO result
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'positions', p.positions,
      'photo_url', p.photo_url,
      'profile_slug', p.profile_slug,
      'graduation_year', p.graduation_year,
      'height', p.height,
      'weight', p.weight,
      'bats', p.bats,
      'throws', p.throws,
      'school_name', pr.school_name,
      'program_name', pr.name,
      'sport', pr.sport,
      'program_logo', pr.logo_url,
      'recruiting_status', p.recruiting_status,
      'committed_school_name', p.committed_school_name,
      'committed_school_logo_url', p.committed_school_logo_url,
      'city', p.city,
      'state', p.state,
      'metrics', (
        SELECT COALESCE(json_agg(json_build_object(
          'name', metric_data.metric_name,
          'value', metric_data.best_value,
          'unit', metric_data.metric_unit
        )), '[]'::json)
        FROM (
          SELECT m.name as metric_name, m.unit as metric_unit,
            CASE WHEN m.metric_type = 'timed' THEN MIN(e.value) ELSE MAX(e.value) END as best_value
          FROM evaluations e
          JOIN metrics m ON m.id = e.metric_id
          WHERE e.player_id = p.id AND m.visible_to_players = true
          GROUP BY m.name, m.unit, m.metric_type
          UNION ALL
          SELECT ee.metric_name, ee.metric_unit,
            CASE WHEN ee.metric_type = 'timed' THEN MIN(ee.metric_value) ELSE MAX(ee.metric_value) END
          FROM evaluator_entries ee
          WHERE ee.player_id = p.id
          GROUP BY ee.metric_name, ee.metric_unit, ee.metric_type
        ) metric_data
      )
    ) as row_data
    FROM players p
    JOIN programs pr ON pr.id = p.program_id
    WHERE p.profile_public = true
      AND (_sport IS NULL OR pr.sport = _sport)
      AND (_positions IS NULL OR p.positions && _positions)
      AND (_grad_year_min IS NULL OR p.graduation_year >= _grad_year_min)
      AND (_grad_year_max IS NULL OR p.graduation_year <= _grad_year_max)
      AND (_bats IS NULL OR p.bats = _bats)
      AND (_throws IS NULL OR p.throws = _throws)
      AND (_recruiting_status IS NULL OR p.recruiting_status = _recruiting_status)
      AND (_name_search IS NULL OR
        (LOWER(p.first_name || ' ' || p.last_name) LIKE '%' || LOWER(_name_search) || '%'))
    ORDER BY p.last_name, p.first_name
    LIMIT _limit OFFSET _offset
  ) sub;

  RETURN result;
END;
$function$;

-- Create a function for featured/recent players (Social Home)
CREATE OR REPLACE FUNCTION public.get_social_feed(_limit integer DEFAULT 20)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'featured', (
      SELECT COALESCE(json_agg(row_data), '[]'::json)
      FROM (
        SELECT json_build_object(
          'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
          'positions', p.positions, 'photo_url', p.photo_url,
          'profile_slug', p.profile_slug, 'graduation_year', p.graduation_year,
          'height', p.height, 'weight', p.weight,
          'school_name', pr.school_name, 'program_name', pr.name,
          'sport', pr.sport, 'program_logo', pr.logo_url,
          'recruiting_status', p.recruiting_status,
          'committed_school_name', p.committed_school_name,
          'metric_count', (
            SELECT COUNT(DISTINCT e.metric_id) FROM evaluations e WHERE e.player_id = p.id
          )
        ) as row_data
        FROM players p
        JOIN programs pr ON pr.id = p.program_id
        WHERE p.profile_public = true
        ORDER BY (
          SELECT COUNT(*) FROM evaluations e WHERE e.player_id = p.id
        ) DESC
        LIMIT 10
      ) sub
    ),
    'recent', (
      SELECT COALESCE(json_agg(row_data), '[]'::json)
      FROM (
        SELECT json_build_object(
          'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
          'positions', p.positions, 'photo_url', p.photo_url,
          'profile_slug', p.profile_slug, 'graduation_year', p.graduation_year,
          'school_name', pr.school_name, 'program_name', pr.name,
          'recruiting_status', p.recruiting_status,
          'committed_school_name', p.committed_school_name,
          'updated_at', p.updated_at
        ) as row_data
        FROM players p
        JOIN programs pr ON pr.id = p.program_id
        WHERE p.profile_public = true
        ORDER BY p.updated_at DESC
        LIMIT _limit
      ) sub
    ),
    'commitments', (
      SELECT COALESCE(json_agg(row_data), '[]'::json)
      FROM (
        SELECT json_build_object(
          'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
          'positions', p.positions, 'photo_url', p.photo_url,
          'profile_slug', p.profile_slug, 'graduation_year', p.graduation_year,
          'school_name', pr.school_name,
          'committed_school_name', p.committed_school_name,
          'committed_school_logo_url', p.committed_school_logo_url,
          'commitment_date', p.commitment_date
        ) as row_data
        FROM players p
        JOIN programs pr ON pr.id = p.program_id
        WHERE p.profile_public = true AND p.recruiting_status = 'committed'
        ORDER BY p.commitment_date DESC NULLS LAST
        LIMIT _limit
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$function$;
