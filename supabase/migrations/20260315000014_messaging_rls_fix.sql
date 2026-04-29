-- Messaging RLS recursion fix
--
-- The policies in migration 000013 recursed: the policy on
-- thread_participants checked "is this user a participant" via a SELECT
-- on thread_participants itself, which re-triggered the policy, which
-- re-triggered the SELECT, etc.
--
-- Fix: a SECURITY DEFINER helper function that bypasses RLS for the
-- participation check, then rewrite all affected policies to call it.

CREATE OR REPLACE FUNCTION public.is_thread_participant(_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.thread_participants
    WHERE thread_id = _thread_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_thread_participant(uuid) TO authenticated;

-- Rewrite policies to use the helper.

-- message_threads
DROP POLICY IF EXISTS "Participants see threads" ON public.message_threads;
CREATE POLICY "Participants see threads"
  ON public.message_threads FOR SELECT
  USING (public.is_thread_participant(id));

DROP POLICY IF EXISTS "Participants update own thread status" ON public.message_threads;
CREATE POLICY "Participants update own thread status"
  ON public.message_threads FOR UPDATE
  USING (public.is_thread_participant(id))
  WITH CHECK (public.is_thread_participant(id));

-- thread_participants: keep the self-row read/update but allow reading
-- other participants in shared threads via the helper.
DROP POLICY IF EXISTS "Read participants of shared threads" ON public.thread_participants;
CREATE POLICY "Read participants of shared threads"
  ON public.thread_participants FOR SELECT
  USING (public.is_thread_participant(thread_id));

-- chat_messages
DROP POLICY IF EXISTS "Participants read messages" ON public.chat_messages;
CREATE POLICY "Participants read messages"
  ON public.chat_messages FOR SELECT
  USING (public.is_thread_participant(thread_id));

DROP POLICY IF EXISTS "Participants send messages" ON public.chat_messages;
CREATE POLICY "Participants send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND public.is_thread_participant(thread_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = chat_messages.thread_id
      AND mt.kind = 'recruiter_outreach'
      AND mt.outreach_status IN ('declined', 'pending')
      AND NOT EXISTS (
        SELECT 1 FROM public.thread_participants tp
        WHERE tp.thread_id = mt.id
        AND tp.user_id = auth.uid()
        AND tp.role = 'recruiter'
      )
    )
  );
