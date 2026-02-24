
-- Replace search_public_players with version that includes _high_school and returns external profile URLs
CREATE OR REPLACE FUNCTION public.search_public_players(
  _sport text DEFAULT NULL,
  _positions text[] DEFAULT NULL,
  _grad_year_min integer DEFAULT NULL,
  _grad_year_max integer DEFAULT NULL,
  _bats text DEFAULT NULL,
  _throws text DEFAULT NULL,
  _name_search text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0,
  _recruiting_status text DEFAULT NULL,
  _state text DEFAULT NULL,
  _gpa_min numeric DEFAULT NULL,
  _high_school text DEFAULT NULL
)
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
      'high_school', p.high_school,
      'school_name', pr.school_name,
      'program_name', pr.name,
      'sport', pr.sport,
      'program_logo', pr.logo_url,
      'recruiting_status', p.recruiting_status,
      'committed_school_name', p.committed_school_name,
      'committed_school_logo_url', p.committed_school_logo_url,
      'city', p.city,
      'state', p.state,
      'gpa', p.gpa,
      'gamechanger_profile_url', p.gamechanger_profile_url,
      'maxpreps_profile_url', p.maxpreps_profile_url,
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
      AND (_state IS NULL OR p.state = _state)
      AND (_gpa_min IS NULL OR (
        p.gpa IS NOT NULL 
        AND p.gpa ~ '^[0-9]+\.?[0-9]*$' 
        AND p.gpa::numeric >= _gpa_min
      ))
      AND (_high_school IS NULL OR LOWER(p.high_school) LIKE '%' || LOWER(_high_school) || '%')
      AND (_name_search IS NULL OR
        (LOWER(p.first_name || ' ' || p.last_name) LIKE '%' || LOWER(_name_search) || '%'))
    ORDER BY p.last_name, p.first_name
    LIMIT _limit OFFSET _offset
  ) sub;

  RETURN result;
END;
$function$;
