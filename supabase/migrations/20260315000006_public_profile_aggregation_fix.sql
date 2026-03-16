-- Fix public profile aggregation to respect per-metric aggregation config.
--
-- PROBLEM: The get_public_profile RPC hardcodes MIN/MAX based on metric_type,
-- ignoring the metric's configured aggregation method (best/average/latest).
-- This causes the public profile to show different values than the coach sees
-- on Dashboard and PlayerDetail when a metric is configured as "average" or "latest".
--
-- FIX: Use the metric's aggregation column to determine the correct aggregation:
--   "best"    → MIN for timed, MAX for measured/rated (unchanged for best)
--   "average" → AVG of all evaluations
--   "latest"  → value from the most recent evaluation (by created_at)
--
-- ALSO ADDS:
--   - aggregation method label per metric (so frontend can display "Best attempt", "Average", etc.)
--   - trend_data: session-by-session aggregated values for development sparklines

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
        'aggregation', m.aggregation,
        'value', sub.agg_value, 'verified', true,
        'source_type', 'program',
        'source_name', pr.name
      ) ORDER BY m.sort_order), '[]'::json)
      FROM metrics m
      INNER JOIN (
        SELECT
          e.metric_id,
          CASE m2.aggregation
            WHEN 'average' THEN AVG(e.value)
            WHEN 'latest'  THEN (
              SELECT e2.value FROM evaluations e2
              WHERE e2.player_id = p.id AND e2.metric_id = e.metric_id
              ORDER BY e2.created_at DESC LIMIT 1
            )
            ELSE -- 'best' or any default
              CASE WHEN m2.metric_type = 'timed' THEN MIN(e.value) ELSE MAX(e.value) END
          END as agg_value
        FROM evaluations e
        JOIN metrics m2 ON m2.id = e.metric_id
        WHERE e.player_id = p.id AND m2.visible_to_players = true
        GROUP BY e.metric_id, m2.aggregation, m2.metric_type
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
    ),
    'trend_data', (
      SELECT COALESCE(json_agg(json_build_object(
        'metric_name', trend.metric_name,
        'metric_unit', trend.metric_unit,
        'metric_type', trend.metric_type,
        'aggregation', trend.aggregation,
        'points', trend.points
      )), '[]'::json)
      FROM (
        SELECT
          m.name as metric_name,
          m.unit as metric_unit,
          m.metric_type,
          m.aggregation,
          (
            SELECT json_agg(sp ORDER BY sp.session_date)
            FROM (
              SELECT
                ts.name as session_name,
                ts.session_date::text as session_date,
                CASE m.aggregation
                  WHEN 'average' THEN AVG(e2.value)
                  ELSE CASE WHEN m.metric_type = 'timed' THEN MIN(e2.value) ELSE MAX(e2.value) END
                END as value
              FROM evaluations e2
              JOIN tryout_sessions ts ON ts.id = e2.session_id
              WHERE e2.player_id = p.id AND e2.metric_id = m.id AND e2.session_id IS NOT NULL
              GROUP BY ts.id, ts.name, ts.session_date
              HAVING COUNT(*) > 0
            ) sp
          ) as points
        FROM metrics m
        WHERE m.program_id = p.program_id
          AND m.visible_to_players = true
          AND (
            SELECT COUNT(DISTINCT e3.session_id)
            FROM evaluations e3
            WHERE e3.player_id = p.id AND e3.metric_id = m.id AND e3.session_id IS NOT NULL
          ) >= 2
      ) trend
    )
  ) INTO result
  FROM players p
  LEFT JOIN programs pr ON pr.id = p.program_id
  WHERE p.profile_slug = _slug AND p.profile_public = true;

  RETURN result;
END;
$function$;
