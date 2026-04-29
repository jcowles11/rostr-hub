-- Messaging (v1)
--
-- Native, in-app messaging. Three audiences, one infrastructure:
--
--   1. Coach ↔ Player (DMs and team announcements within a program)
--   2. Recruiter → Player (cross-program outreach, gated by plan quota,
--      requires player acceptance before becoming a 2-way thread)
--
-- Tables:
--   message_threads            — conversation container
--   thread_participants        — user/role/read-state per thread
--   messages                   — individual messages
--   recruiter_message_quotas   — per-recruiter plan + usage counter
--
-- Plus helper RPCs for:
--   - counting unread messages
--   - sending recruiter outreach atomically with quota check
--
-- No SMS / email integrations in this layer — it's pure in-app. Email
-- digests land later as a scheduled edge function reading the same data.

-- ── message_threads ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL
    CHECK (kind IN ('dm', 'announcement', 'recruiter_outreach')),
  subject text,

  -- Program-scoped threads (DMs, announcements). Null for recruiter
  -- outreach which crosses programs.
  program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,

  -- Recruiter outreach context.
  recruiter_id uuid REFERENCES public.recruiters(id) ON DELETE CASCADE,
  target_player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  outreach_status text
    CHECK (outreach_status IN ('pending', 'accepted', 'declined')),

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),

  -- Kind-specific integrity:
  --   dm / announcement must have program_id
  --   recruiter_outreach must have recruiter_id + target_player_id + outreach_status
  CONSTRAINT thread_scope_check CHECK (
    (kind IN ('dm', 'announcement') AND program_id IS NOT NULL) OR
    (kind = 'recruiter_outreach'
      AND recruiter_id IS NOT NULL
      AND target_player_id IS NOT NULL
      AND outreach_status IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_message_threads_program
  ON public.message_threads(program_id, last_message_at DESC)
  WHERE program_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_threads_recruiter
  ON public.message_threads(recruiter_id, last_message_at DESC)
  WHERE recruiter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_threads_target_player
  ON public.message_threads(target_player_id)
  WHERE target_player_id IS NOT NULL;

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

-- ── thread_participants ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.thread_participants (
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('coach', 'player', 'recruiter')),
  last_read_at timestamptz,
  muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_participants_by_user
  ON public.thread_participants(user_id);

ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;

-- ── messages ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_messages_by_thread
  ON public.chat_messages(thread_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Trigger: keep message_threads.last_message_at up to date.
CREATE OR REPLACE FUNCTION public.bump_thread_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.message_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_thread ON public.chat_messages;
CREATE TRIGGER messages_bump_thread
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_thread_last_message_at();

-- ── recruiter_message_quotas ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiter_message_quotas (
  recruiter_id uuid PRIMARY KEY REFERENCES public.recruiters(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  monthly_limit int NOT NULL DEFAULT 0,
  current_month_sent int NOT NULL DEFAULT 0,
  month_reset_at timestamptz NOT NULL
    DEFAULT date_trunc('month', now()) + interval '1 month',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recruiter_message_quotas ENABLE ROW LEVEL SECURITY;

-- Recruiters read their own quota; nobody else needs to.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recruiter_message_quotas' AND policyname = 'Recruiter reads own quota') THEN
    CREATE POLICY "Recruiter reads own quota"
      ON public.recruiter_message_quotas FOR SELECT
      USING (recruiter_id IN (SELECT id FROM recruiters WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ── RLS policies: participants and visibility ─────────────────────

-- SELECT on message_threads: must be a participant OR in a
-- coach/recruiter role that implicitly owns the thread.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_threads' AND policyname = 'Participants see threads') THEN
    CREATE POLICY "Participants see threads"
      ON public.message_threads FOR SELECT
      USING (
        id IN (SELECT thread_id FROM thread_participants WHERE user_id = auth.uid())
      );
  END IF;

  -- INSERT handled by SECURITY DEFINER RPCs below. No policy needed.

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_threads' AND policyname = 'Participants update own thread status') THEN
    CREATE POLICY "Participants update own thread status"
      ON public.message_threads FOR UPDATE
      USING (id IN (SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()))
      WITH CHECK (id IN (SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()));
  END IF;
END $$;

-- thread_participants: can read rows for threads you're in; insert
-- handled via RPC; update for last_read_at self-serve.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'thread_participants' AND policyname = 'Read participants of shared threads') THEN
    CREATE POLICY "Read participants of shared threads"
      ON public.thread_participants FOR SELECT
      USING (
        thread_id IN (SELECT thread_id FROM thread_participants WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'thread_participants' AND policyname = 'Update own participant row') THEN
    CREATE POLICY "Update own participant row"
      ON public.thread_participants FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- messages: SELECT if participant of the thread; INSERT if participant
-- AND (for outreach threads) status is accepted OR sender is the recruiter.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Participants read messages') THEN
    CREATE POLICY "Participants read messages"
      ON public.chat_messages FOR SELECT
      USING (
        thread_id IN (SELECT thread_id FROM thread_participants WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Participants send messages') THEN
    CREATE POLICY "Participants send messages"
      ON public.chat_messages FOR INSERT
      WITH CHECK (
        sender_user_id = auth.uid()
        AND thread_id IN (SELECT tp.thread_id FROM thread_participants tp WHERE tp.user_id = auth.uid())
        AND NOT EXISTS (
          -- Block message sends on declined or pending outreach unless
          -- you're the recruiter (they can send the initial outreach
          -- before acceptance).
          SELECT 1 FROM message_threads mt
          WHERE mt.id = chat_messages.thread_id
          AND mt.kind = 'recruiter_outreach'
          AND mt.outreach_status IN ('declined', 'pending')
          AND auth.uid() NOT IN (
            SELECT tp2.user_id FROM thread_participants tp2
            WHERE tp2.thread_id = mt.id AND tp2.role = 'recruiter'
          )
        )
      );
  END IF;
END $$;

-- ── Helper view: inbox summary ────────────────────────────────────

CREATE OR REPLACE VIEW public.inbox_threads AS
SELECT
  tp.user_id,
  tp.thread_id,
  tp.role AS viewer_role,
  tp.last_read_at,
  tp.muted,
  mt.kind,
  mt.subject,
  mt.program_id,
  mt.recruiter_id,
  mt.target_player_id,
  mt.outreach_status,
  mt.created_at AS thread_created_at,
  mt.last_message_at,
  -- Unread = messages after last_read_at, not from self
  (SELECT COUNT(*) FROM chat_messages m
    WHERE m.thread_id = mt.id
    AND m.deleted_at IS NULL
    AND m.sender_user_id IS DISTINCT FROM tp.user_id
    AND (tp.last_read_at IS NULL OR m.created_at > tp.last_read_at)
  )::int AS unread_count,
  -- Preview of the most recent message
  (SELECT body FROM chat_messages m
    WHERE m.thread_id = mt.id
    AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC LIMIT 1
  ) AS preview,
  (SELECT m.sender_user_id FROM chat_messages m
    WHERE m.thread_id = mt.id
    AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC LIMIT 1
  ) AS last_sender_user_id
FROM public.thread_participants tp
JOIN public.message_threads mt ON mt.id = tp.thread_id;

GRANT SELECT ON public.inbox_threads TO authenticated;

-- ── RPC: create a DM between coach + player ───────────────────────

CREATE OR REPLACE FUNCTION public.create_coach_player_dm(
  _program_id uuid,
  _player_id uuid,
  _body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_id uuid;
  player_user_id uuid;
  coach_user_id uuid := auth.uid();
  existing_thread_id uuid;
BEGIN
  IF coach_user_id IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  -- Verify the caller is a coach on this program.
  IF NOT EXISTS (
    SELECT 1 FROM coaches WHERE user_id = coach_user_id AND program_id = _program_id
  ) THEN
    RAISE EXCEPTION 'not_a_coach_on_program';
  END IF;

  SELECT claimed_by_user_id INTO player_user_id FROM players WHERE id = _player_id;
  IF player_user_id IS NULL THEN
    RAISE EXCEPTION 'player_not_claimed';
  END IF;

  -- Find existing DM thread with this coach + this player (or reuse).
  SELECT mt.id INTO existing_thread_id
  FROM message_threads mt
  JOIN thread_participants cp ON cp.thread_id = mt.id AND cp.user_id = coach_user_id
  JOIN thread_participants pp ON pp.thread_id = mt.id AND pp.user_id = player_user_id
  WHERE mt.kind = 'dm' AND mt.program_id = _program_id
  LIMIT 1;

  IF existing_thread_id IS NOT NULL THEN
    thread_id := existing_thread_id;
  ELSE
    INSERT INTO message_threads (kind, program_id, created_by)
    VALUES ('dm', _program_id, coach_user_id)
    RETURNING id INTO thread_id;

    INSERT INTO thread_participants (thread_id, user_id, role)
    VALUES
      (thread_id, coach_user_id, 'coach'),
      (thread_id, player_user_id, 'player');
  END IF;

  INSERT INTO chat_messages (thread_id, sender_user_id, body)
  VALUES (thread_id, coach_user_id, _body);

  RETURN thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_coach_player_dm(uuid, uuid, text) TO authenticated;

-- ── RPC: announcement to a whole team ──────────────────────────────

CREATE OR REPLACE FUNCTION public.send_team_announcement(
  _program_id uuid,
  _team_level text,
  _subject text,
  _body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_id uuid;
  coach_user_id uuid := auth.uid();
  player_row RECORD;
BEGIN
  IF coach_user_id IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM coaches WHERE user_id = coach_user_id AND program_id = _program_id
  ) THEN
    RAISE EXCEPTION 'not_a_coach_on_program';
  END IF;

  INSERT INTO message_threads (kind, program_id, subject, created_by)
  VALUES ('announcement', _program_id, _subject, coach_user_id)
  RETURNING id INTO thread_id;

  -- Coach is a participant.
  INSERT INTO thread_participants (thread_id, user_id, role)
  VALUES (thread_id, coach_user_id, 'coach');

  -- All claimed players on the target team level (or all players if null).
  FOR player_row IN
    SELECT DISTINCT p.claimed_by_user_id
    FROM players p
    LEFT JOIN roster_assignments ra ON ra.player_id = p.id
    WHERE p.program_id = _program_id
    AND p.claimed_by_user_id IS NOT NULL
    AND (_team_level IS NULL OR LOWER(ra.assignment) = LOWER(_team_level))
  LOOP
    INSERT INTO thread_participants (thread_id, user_id, role)
    VALUES (thread_id, player_row.claimed_by_user_id, 'player')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- The announcement body itself.
  INSERT INTO chat_messages (thread_id, sender_user_id, body)
  VALUES (thread_id, coach_user_id, _body);

  RETURN thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_team_announcement(uuid, text, text, text) TO authenticated;

-- ── RPC: recruiter outreach ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_recruiter_outreach(
  _player_id uuid,
  _subject text,
  _body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_id uuid;
  rec_id uuid;
  rec_user_id uuid := auth.uid();
  player_user_id uuid;
  q RECORD;
BEGIN
  IF rec_user_id IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT id INTO rec_id FROM recruiters WHERE user_id = rec_user_id;
  IF rec_id IS NULL THEN
    RAISE EXCEPTION 'not_a_recruiter';
  END IF;

  SELECT claimed_by_user_id INTO player_user_id FROM players WHERE id = _player_id;
  IF player_user_id IS NULL THEN
    RAISE EXCEPTION 'player_not_claimed';
  END IF;

  -- Quota check + reset if the month has rolled over.
  SELECT * INTO q FROM recruiter_message_quotas WHERE recruiter_id = rec_id;
  IF q.recruiter_id IS NULL THEN
    -- Create default free tier row
    INSERT INTO recruiter_message_quotas (recruiter_id, plan, monthly_limit)
    VALUES (rec_id, 'free', 3)
    RETURNING * INTO q;
  END IF;

  IF q.month_reset_at <= now() THEN
    UPDATE recruiter_message_quotas
      SET current_month_sent = 0,
          month_reset_at = date_trunc('month', now()) + interval '1 month',
          updated_at = now()
      WHERE recruiter_id = rec_id
      RETURNING * INTO q;
  END IF;

  IF q.current_month_sent >= q.monthly_limit THEN
    RAISE EXCEPTION 'quota_exceeded';
  END IF;

  -- Prevent duplicate outreach to the same player (one pending at a time).
  IF EXISTS (
    SELECT 1 FROM message_threads mt
    WHERE mt.kind = 'recruiter_outreach'
    AND mt.recruiter_id = rec_id
    AND mt.target_player_id = _player_id
    AND mt.outreach_status IN ('pending', 'accepted')
  ) THEN
    RAISE EXCEPTION 'duplicate_outreach';
  END IF;

  INSERT INTO message_threads (
    kind, recruiter_id, target_player_id, outreach_status,
    subject, created_by
  )
  VALUES (
    'recruiter_outreach', rec_id, _player_id, 'pending',
    _subject, rec_user_id
  )
  RETURNING id INTO thread_id;

  INSERT INTO thread_participants (thread_id, user_id, role)
  VALUES
    (thread_id, rec_user_id, 'recruiter'),
    (thread_id, player_user_id, 'player');

  INSERT INTO chat_messages (thread_id, sender_user_id, body)
  VALUES (thread_id, rec_user_id, _body);

  UPDATE recruiter_message_quotas
    SET current_month_sent = current_month_sent + 1,
        updated_at = now()
    WHERE recruiter_id = rec_id;

  RETURN thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_recruiter_outreach(uuid, text, text) TO authenticated;

-- ── RPC: respond to outreach ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_to_outreach(
  _thread_id uuid,
  _decision text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mt RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;
  IF _decision NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  SELECT * INTO mt FROM message_threads WHERE id = _thread_id;
  IF mt.id IS NULL THEN
    RAISE EXCEPTION 'thread_not_found';
  END IF;
  IF mt.kind <> 'recruiter_outreach' THEN
    RAISE EXCEPTION 'wrong_thread_kind';
  END IF;

  -- Caller must be the targeted player (claimed).
  IF NOT EXISTS (
    SELECT 1 FROM players p
    WHERE p.id = mt.target_player_id
    AND p.claimed_by_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_the_target';
  END IF;

  UPDATE message_threads
    SET outreach_status = _decision
    WHERE id = _thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_outreach(uuid, text) TO authenticated;

-- ── RPC: unread count for the signed-in user ──────────────────────

CREATE OR REPLACE FUNCTION public.my_unread_count()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(unread_count), 0)::int
  FROM inbox_threads
  WHERE user_id = auth.uid()
  AND muted = false;
$$;

GRANT EXECUTE ON FUNCTION public.my_unread_count() TO authenticated;
