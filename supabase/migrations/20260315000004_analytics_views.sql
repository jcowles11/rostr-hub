-- Analytics views for pilot monitoring
-- All views are scoped by program_id; RLS on the underlying table enforces access.
-- These views aggregate event data without exposing any personal player information.

-- 1. Score entries per session (event_name = 'score_entry', grouped by session context)
CREATE OR REPLACE VIEW analytics_scores_per_session AS
SELECT
  ae.program_id,
  COALESCE(ae.properties->>'session_id', 'unknown') AS session_label,
  ae.properties->>'label' AS entry_mode,
  COUNT(*) AS score_count,
  COUNT(DISTINCT ae.coach_id) AS coach_count,
  MIN(ae.created_at) AS first_score_at,
  MAX(ae.created_at) AS last_score_at
FROM analytics_events ae
WHERE ae.event_name = 'score_entry'
GROUP BY ae.program_id, session_label, entry_mode;

-- 2. Total score entries per program (daily rollup)
CREATE OR REPLACE VIEW analytics_scores_daily AS
SELECT
  ae.program_id,
  DATE(ae.created_at AT TIME ZONE 'UTC') AS event_date,
  COUNT(*) AS score_count,
  COUNT(DISTINCT ae.coach_id) AS active_coaches
FROM analytics_events ae
WHERE ae.event_name = 'score_entry'
GROUP BY ae.program_id, event_date
ORDER BY event_date DESC;

-- 3. Roster imports and player creation events
CREATE OR REPLACE VIEW analytics_roster_activity AS
SELECT
  ae.program_id,
  ae.event_name,
  DATE(ae.created_at AT TIME ZONE 'UTC') AS event_date,
  COUNT(*) AS event_count,
  SUM(COALESCE((ae.properties->>'count')::int, 1)) AS player_count
FROM analytics_events ae
WHERE ae.event_name IN ('roster_import', 'player_create')
GROUP BY ae.program_id, ae.event_name, event_date
ORDER BY event_date DESC;

-- 4. Ranking filter usage frequency
CREATE OR REPLACE VIEW analytics_filter_usage AS
SELECT
  ae.program_id,
  ae.properties->>'label' AS filter_type,
  DATE(ae.created_at AT TIME ZONE 'UTC') AS event_date,
  COUNT(*) AS usage_count
FROM analytics_events ae
WHERE ae.event_name = 'ranking_filter'
GROUP BY ae.program_id, filter_type, event_date
ORDER BY event_date DESC, usage_count DESC;

-- 5. Evaluator filter usage
CREATE OR REPLACE VIEW analytics_evaluator_filter AS
SELECT
  ae.program_id,
  ae.properties->>'label' AS filter_mode,
  DATE(ae.created_at AT TIME ZONE 'UTC') AS event_date,
  COUNT(*) AS usage_count
FROM analytics_events ae
WHERE ae.event_name = 'evaluator_filter'
GROUP BY ae.program_id, filter_mode, event_date
ORDER BY event_date DESC;

-- 6. Player profile view counts (daily, no player identity exposed)
CREATE OR REPLACE VIEW analytics_profile_views AS
SELECT
  ae.program_id,
  DATE(ae.created_at AT TIME ZONE 'UTC') AS event_date,
  COUNT(*) AS view_count,
  COUNT(DISTINCT ae.coach_id) AS viewing_coaches
FROM analytics_events ae
WHERE ae.event_name = 'player_profile_view'
GROUP BY ae.program_id, event_date
ORDER BY event_date DESC;

-- 7. Summary: all events by type per program (high-level overview)
CREATE OR REPLACE VIEW analytics_event_summary AS
SELECT
  ae.program_id,
  ae.event_name,
  COUNT(*) AS total_count,
  COUNT(DISTINCT ae.coach_id) AS unique_coaches,
  MIN(ae.created_at) AS first_seen,
  MAX(ae.created_at) AS last_seen
FROM analytics_events ae
GROUP BY ae.program_id, ae.event_name
ORDER BY total_count DESC;
