-- Live in-app scoring + fan viewer + cross-team game linking (v1)
--
-- Three additions to the data model:
--
--   1. game_events           — append-only event log (one row per at-bat,
--                              sub, inning change, etc.). The source of
--                              truth for everything downstream: box
--                              scores, career stats, MaxPreps exports,
--                              reconciliation between home/away books.
--
--   2. games.opponent_program_id — when both teams on the field are on
--                              Rostr, the games record stores the link.
--                              Opposing scorekeeper sees their own view
--                              of the same event stream; rosters merge
--                              so neither coach has to re-enter players.
--
--   3. fan_subscriptions     — per-team subscriptions for fans (parents,
--                              alumni, scouts-lite). Gated access to the
--                              live game feed. Schema lands now; billing
--                              (Stripe) lands later.

-- ── games: add cross-team link + live state columns FIRST ────────
-- (policies below reference opponent_program_id, so create the column
-- before the policies are defined.)

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS opponent_program_id uuid
    REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS live_status text
    CHECK (live_status IN ('not_started', 'in_progress', 'final'))
    DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS live_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_games_opponent_program
  ON public.games(opponent_program_id)
  WHERE opponent_program_id IS NOT NULL;

-- ── game_events ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.game_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,

  -- Monotonically increasing per game — makes it easy to replay events
  -- chronologically even when two scorekeepers log in parallel.
  sequence integer NOT NULL,

  event_type text NOT NULL CHECK (event_type IN (
    'game_start', 'inning_change', 'at_bat', 'substitution',
    'pitcher_change', 'correction', 'note', 'game_end'
  )),

  -- Inning context (null on game_start / note / game_end)
  inning integer,                         -- 1-indexed, 1..N
  top_bottom text CHECK (top_bottom IN ('top', 'bottom') OR top_bottom IS NULL),
  outs_after integer CHECK (outs_after IS NULL OR (outs_after >= 0 AND outs_after <= 3)),

  -- Score AFTER this event resolves
  home_score integer,
  away_score integer,

  -- Who batted (for at_bat) / subbed (for substitution). Either a real
  -- player_id (Rostr roster) OR an ad-hoc opponent name (before
  -- cross-team linking is wired). Nullable for non-player events.
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  player_ad_hoc_name text,                -- when opponent's not on Rostr

  -- Event-specific payload. Examples:
  --   at_bat:       { outcome: '1B'|'2B'|'3B'|'HR'|'BB'|'K'|'GO'|'FO'|'HBP'|'E'|'FC'|'SAC', rbi: 2 }
  --   substitution: { in_player_id, out_player_id, position: 'SS' }
  --   pitcher_change: { new_pitcher_id }
  --   inning_change:{ new_inning: 2, new_half: 'top' }
  --   correction:   { original_event_id, notes: 'was a single, not a double' }
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Provenance: who keyed this event, from which team's perspective.
  -- Two scorekeepers on the same game produce two streams that can be
  -- merged later; home team's is canonical.
  logged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  logged_by_side text CHECK (logged_by_side IN ('home', 'away')) NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness per (game, sequence, side) prevents lost writes if two
-- scorekeepers produce the same sequence number simultaneously — they
-- get recorded as separate streams and reconciled later.
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_events_unique
  ON public.game_events(game_id, sequence, logged_by_side);

CREATE INDEX IF NOT EXISTS idx_game_events_by_game
  ON public.game_events(game_id, created_at ASC);

ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- RLS: coaches of either linked program can SELECT + INSERT events.
-- Public fans don't get direct SELECT — they use the aggregated
-- inbox-safe view below.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'game_events' AND policyname = 'Coaches read own game events') THEN
    CREATE POLICY "Coaches read own game events"
      ON public.game_events FOR SELECT
      USING (
        game_id IN (
          SELECT g.id FROM games g
          JOIN coaches c ON (c.program_id = g.program_id OR c.program_id = g.opponent_program_id)
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'game_events' AND policyname = 'Coaches log own game events') THEN
    CREATE POLICY "Coaches log own game events"
      ON public.game_events FOR INSERT
      WITH CHECK (
        logged_by = auth.uid()
        AND game_id IN (
          SELECT g.id FROM games g
          JOIN coaches c ON (c.program_id = g.program_id OR c.program_id = g.opponent_program_id)
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── fan_subscriptions ────────────────────────────────────────────
-- Fans (parents, alumni) subscribe to a program. Tier determines
-- what they can see. Billing comes later — for now this just tracks
-- who has what plan.

CREATE TABLE IF NOT EXISTS public.fan_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'fan', 'family')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'past_due')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  -- Future: stripe_customer_id, stripe_subscription_id
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_fan_subs_by_user
  ON public.fan_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_fan_subs_by_program
  ON public.fan_subscriptions(program_id, status);

ALTER TABLE public.fan_subscriptions ENABLE ROW LEVEL SECURITY;

-- Fans manage their own subs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fan_subscriptions' AND policyname = 'Fans manage own subs') THEN
    CREATE POLICY "Fans manage own subs"
      ON public.fan_subscriptions FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fan_subscriptions' AND policyname = 'Coaches see fans of own program') THEN
    -- Coaches can see (anonymized) subscriber counts on their program.
    CREATE POLICY "Coaches see fans of own program"
      ON public.fan_subscriptions FOR SELECT
      USING (
        program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── Public game snapshot view ────────────────────────────────────
-- For the fan viewer at /g/[id]. Exposes only game-facing info (score,
-- inning, outs, most-recent event preview). Does NOT expose recruiter
-- view counts, player notes, internal coach data, etc.

CREATE OR REPLACE VIEW public.live_game_snapshot AS
SELECT
  g.id AS game_id,
  g.program_id,
  g.opponent_program_id,
  g.name,
  g.opponent,
  g.game_date,
  g.game_time,
  g.location,
  g.home_away,
  g.team_level,
  g.status,
  g.live_status,
  g.our_score,
  g.opponent_score,
  g.result,
  -- Latest event (for "currently batting" / "top of the 3rd"-style banners)
  (SELECT jsonb_build_object(
      'id', ge.id,
      'sequence', ge.sequence,
      'event_type', ge.event_type,
      'inning', ge.inning,
      'top_bottom', ge.top_bottom,
      'outs_after', ge.outs_after,
      'home_score', ge.home_score,
      'away_score', ge.away_score,
      'payload', ge.payload,
      'created_at', ge.created_at
    )
    FROM game_events ge
    WHERE ge.game_id = g.id
    AND ge.logged_by_side = 'home'
    ORDER BY ge.sequence DESC
    LIMIT 1
  ) AS latest_event,
  (SELECT COUNT(*)::int FROM game_events ge
    WHERE ge.game_id = g.id AND ge.logged_by_side = 'home') AS event_count
FROM public.games g;

GRANT SELECT ON public.live_game_snapshot TO anon, authenticated;

-- ── Public event stream view ─────────────────────────────────────
-- Fan-safe event feed for the public game viewer. Only the home team's
-- canonical stream is exposed. Player names are included directly so
-- fans don't need access to the players table.

CREATE OR REPLACE VIEW public.public_game_events AS
SELECT
  ge.id,
  ge.game_id,
  ge.sequence,
  ge.event_type,
  ge.inning,
  ge.top_bottom,
  ge.outs_after,
  ge.home_score,
  ge.away_score,
  ge.payload,
  ge.created_at,
  COALESCE(
    p.first_name || ' ' || p.last_name,
    ge.player_ad_hoc_name
  ) AS player_name,
  p.player_number AS player_jersey
FROM public.game_events ge
LEFT JOIN public.players p ON p.id = ge.player_id
WHERE ge.logged_by_side = 'home';

GRANT SELECT ON public.public_game_events TO anon, authenticated;

-- ── RPC: start live scoring ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.start_live_scoring(_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  game_row games%ROWTYPE;
  user_side text;
  is_home boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO game_row FROM games WHERE id = _game_id;
  IF game_row.id IS NULL THEN
    RAISE EXCEPTION 'game_not_found';
  END IF;

  -- Determine if the caller is the home or away coach.
  is_home := EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = auth.uid()
    AND program_id = game_row.program_id
  );

  IF NOT is_home AND game_row.opponent_program_id IS NOT NULL THEN
    is_home := NOT EXISTS (
      SELECT 1 FROM coaches
      WHERE user_id = auth.uid()
      AND program_id = game_row.opponent_program_id
    );
    IF EXISTS (
      SELECT 1 FROM coaches
      WHERE user_id = auth.uid()
      AND program_id = game_row.opponent_program_id
    ) THEN
      is_home := false;
    ELSE
      RAISE EXCEPTION 'not_a_coach_on_either_team';
    END IF;
  ELSIF NOT is_home THEN
    RAISE EXCEPTION 'not_a_coach_on_this_game';
  END IF;

  user_side := CASE WHEN is_home THEN 'home' ELSE 'away' END;

  -- Flip game live_status if not already
  UPDATE games
    SET live_status = 'in_progress',
        live_started_at = COALESCE(live_started_at, now()),
        status = CASE WHEN status = 'scheduled' THEN 'scheduled' ELSE status END
    WHERE id = _game_id;

  -- Insert game_start event if one doesn't exist for this side yet.
  IF NOT EXISTS (
    SELECT 1 FROM game_events
    WHERE game_id = _game_id
    AND event_type = 'game_start'
    AND logged_by_side = user_side
  ) THEN
    INSERT INTO game_events (
      game_id, sequence, event_type, home_score, away_score,
      logged_by, logged_by_side
    )
    VALUES (
      _game_id, 1, 'game_start', 0, 0,
      auth.uid(), user_side
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_live_scoring(uuid) TO authenticated;

-- ── RPC: log an at-bat outcome ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_at_bat(
  _game_id uuid,
  _player_id uuid,
  _ad_hoc_name text,
  _outcome text,
  _rbi integer,
  _inning integer,
  _top_bottom text,
  _outs_after integer,
  _home_score integer,
  _away_score integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  next_seq integer;
  user_side text;
  game_row games%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO game_row FROM games WHERE id = _game_id;

  IF EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = auth.uid() AND program_id = game_row.program_id
  ) THEN
    user_side := 'home';
  ELSIF game_row.opponent_program_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = auth.uid() AND program_id = game_row.opponent_program_id
  ) THEN
    user_side := 'away';
  ELSE
    RAISE EXCEPTION 'not_a_coach_on_this_game';
  END IF;

  -- Next sequence for this side
  SELECT COALESCE(MAX(sequence), 0) + 1 INTO next_seq
  FROM game_events
  WHERE game_id = _game_id AND logged_by_side = user_side;

  INSERT INTO game_events (
    game_id, sequence, event_type, inning, top_bottom, outs_after,
    home_score, away_score, player_id, player_ad_hoc_name,
    payload, logged_by, logged_by_side
  )
  VALUES (
    _game_id, next_seq, 'at_bat', _inning, _top_bottom, _outs_after,
    _home_score, _away_score, _player_id, _ad_hoc_name,
    jsonb_build_object('outcome', _outcome, 'rbi', COALESCE(_rbi, 0)),
    auth.uid(), user_side
  )
  RETURNING id INTO new_id;

  -- Keep games.our_score / opponent_score in sync with the home
  -- scorekeeper's stream so Hub stat tiles stay consistent without
  -- a heavy aggregation job.
  IF user_side = 'home' THEN
    IF game_row.home_away = 'home' THEN
      UPDATE games SET our_score = _home_score, opponent_score = _away_score WHERE id = _game_id;
    ELSE
      UPDATE games SET our_score = _away_score, opponent_score = _home_score WHERE id = _game_id;
    END IF;
  END IF;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_at_bat(uuid, uuid, text, text, integer, integer, text, integer, integer, integer) TO authenticated;

-- ── RPC: end game (finalize) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.end_live_game(_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  game_row games%ROWTYPE;
  final_home integer;
  final_away integer;
  user_side text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO game_row FROM games WHERE id = _game_id;
  IF game_row.id IS NULL THEN
    RAISE EXCEPTION 'game_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM coaches WHERE user_id = auth.uid() AND program_id = game_row.program_id) THEN
    user_side := 'home';
  ELSIF game_row.opponent_program_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM coaches WHERE user_id = auth.uid() AND program_id = game_row.opponent_program_id
  ) THEN
    user_side := 'away';
  ELSE
    RAISE EXCEPTION 'not_a_coach_on_this_game';
  END IF;

  -- Pull the latest home/away score from the most recent home-side event
  SELECT home_score, away_score INTO final_home, final_away
  FROM game_events
  WHERE game_id = _game_id AND logged_by_side = 'home'
  ORDER BY sequence DESC
  LIMIT 1;

  final_home := COALESCE(final_home, 0);
  final_away := COALESCE(final_away, 0);

  UPDATE games
    SET live_status = 'final',
        status = 'completed',
        our_score = CASE
          WHEN home_away = 'home' THEN final_home
          ELSE final_away
        END,
        opponent_score = CASE
          WHEN home_away = 'home' THEN final_away
          ELSE final_home
        END,
        completed_at = COALESCE(completed_at, now()),
        completed_by = COALESCE(completed_by,
          (SELECT id FROM coaches WHERE user_id = auth.uid() AND program_id = game_row.program_id LIMIT 1))
    WHERE id = _game_id;

  INSERT INTO game_events (
    game_id, sequence, event_type, home_score, away_score,
    logged_by, logged_by_side
  )
  VALUES (
    _game_id,
    (SELECT COALESCE(MAX(sequence), 0) + 1 FROM game_events WHERE game_id = _game_id AND logged_by_side = user_side),
    'game_end', final_home, final_away,
    auth.uid(), user_side
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_live_game(uuid) TO authenticated;
