-- Analytics events table for pilot usage tracking
-- Captures workflow behavior (not personal player data)

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  coach_id uuid, -- nullable for anonymous/system events
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for querying by program and event type
CREATE INDEX idx_analytics_events_program ON analytics_events(program_id, event_name, created_at DESC);

-- RLS: coaches can insert events for their own program, admins can read all
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can insert analytics for their program"
  ON analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.user_id = auth.uid()
        AND coaches.program_id = analytics_events.program_id
    )
  );

CREATE POLICY "Coaches can read analytics for their program"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.user_id = auth.uid()
        AND coaches.program_id = analytics_events.program_id
    )
  );
