
CREATE OR REPLACE FUNCTION public.search_players_authenticated(
  _name_search text DEFAULT NULL,
  _positions text[] DEFAULT NULL,
  _grad_year_min integer DEFAULT NULL,
  _grad_year_max integer DEFAULT NULL,
  _limit integer DEFAULT 30,
  _offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RETURN '[]'::json;
  END IF;

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
      'high_school', p.high_school,
      'city', p.city,
      'state', p.state,
      'school_name', COALESCE(pr.school_name, p.high_school, ''),
      'program_name', pr.name,
      'sport', pr.sport,
      'recruiting_status', p.recruiting_status,
      'committed_school_name', p.committed_school_name
    ) as row_data
    FROM players p
    LEFT JOIN programs pr ON pr.id = p.program_id
    WHERE p.user_id IS NOT NULL
      AND (_name_search IS NULL OR
        LOWER(p.first_name || ' ' || p.last_name) LIKE '%' || LOWER(_name_search) || '%')
      AND (_positions IS NULL OR p.positions && _positions)
      AND (_grad_year_min IS NULL OR p.graduation_year >= _grad_year_min)
      AND (_grad_year_max IS NULL OR p.graduation_year <= _grad_year_max)
    ORDER BY p.last_name, p.first_name
    LIMIT _limit OFFSET _offset
  ) sub;

  RETURN result;
END;
$$;
