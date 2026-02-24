
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
