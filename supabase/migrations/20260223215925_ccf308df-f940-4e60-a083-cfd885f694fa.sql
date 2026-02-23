
-- New scouts table
CREATE TABLE public.scouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  organization_name text NOT NULL DEFAULT '',
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scouts can view own profile" ON public.scouts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Scouts can update own profile" ON public.scouts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Scouts can insert own profile" ON public.scouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view scouts" ON public.scouts
  FOR SELECT USING (true);

-- Search function for public players with metric filtering
CREATE OR REPLACE FUNCTION public.search_public_players(
  _sport text DEFAULT NULL,
  _positions text[] DEFAULT NULL,
  _grad_year_min int DEFAULT NULL,
  _grad_year_max int DEFAULT NULL,
  _bats text DEFAULT NULL,
  _throws text DEFAULT NULL,
  _name_search text DEFAULT NULL,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
      AND (_name_search IS NULL OR
        (LOWER(p.first_name || ' ' || p.last_name) LIKE '%' || LOWER(_name_search) || '%'))
    ORDER BY p.last_name, p.first_name
    LIMIT _limit OFFSET _offset
  ) sub;

  RETURN result;
END;
$$;
