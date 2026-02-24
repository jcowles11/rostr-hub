
-- Part 1: Extend scouts table with profile fields
ALTER TABLE public.scouts 
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'baseball',
  ADD COLUMN IF NOT EXISTS division text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_state text,
  ADD COLUMN IF NOT EXISTS recruiting_territories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS positions_recruiting text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"new_messages": true, "prospect_updates": true}'::jsonb;

-- Part 2: Scout saved prospects
CREATE TABLE public.scout_saved_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL REFERENCES public.scouts(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  notes text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scout_id, player_id)
);

ALTER TABLE public.scout_saved_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scouts can view own saved prospects"
  ON public.scout_saved_prospects FOR SELECT
  USING (EXISTS (SELECT 1 FROM scouts s WHERE s.id = scout_saved_prospects.scout_id AND s.user_id = auth.uid()));

CREATE POLICY "Scouts can insert own saved prospects"
  ON public.scout_saved_prospects FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM scouts s WHERE s.id = scout_saved_prospects.scout_id AND s.user_id = auth.uid()));

CREATE POLICY "Scouts can update own saved prospects"
  ON public.scout_saved_prospects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM scouts s WHERE s.id = scout_saved_prospects.scout_id AND s.user_id = auth.uid()));

CREATE POLICY "Scouts can delete own saved prospects"
  ON public.scout_saved_prospects FOR DELETE
  USING (EXISTS (SELECT 1 FROM scouts s WHERE s.id = scout_saved_prospects.scout_id AND s.user_id = auth.uid()));

-- Part 3: Scout lists
CREATE TABLE public.scout_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL REFERENCES public.scouts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scout_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scouts can view own lists"
  ON public.scout_lists FOR SELECT
  USING (EXISTS (SELECT 1 FROM scouts s WHERE s.id = scout_lists.scout_id AND s.user_id = auth.uid()));

CREATE POLICY "Scouts can insert own lists"
  ON public.scout_lists FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM scouts s WHERE s.id = scout_lists.scout_id AND s.user_id = auth.uid()));

CREATE POLICY "Scouts can update own lists"
  ON public.scout_lists FOR UPDATE
  USING (EXISTS (SELECT 1 FROM scouts s WHERE s.id = scout_lists.scout_id AND s.user_id = auth.uid()));

CREATE POLICY "Scouts can delete own lists"
  ON public.scout_lists FOR DELETE
  USING (EXISTS (SELECT 1 FROM scouts s WHERE s.id = scout_lists.scout_id AND s.user_id = auth.uid()));

-- Part 4: Scout list members
CREATE TABLE public.scout_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.scout_lists(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, player_id)
);

ALTER TABLE public.scout_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scouts can view own list members"
  ON public.scout_list_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM scout_lists sl JOIN scouts s ON s.id = sl.scout_id WHERE sl.id = scout_list_members.list_id AND s.user_id = auth.uid()));

CREATE POLICY "Scouts can insert own list members"
  ON public.scout_list_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM scout_lists sl JOIN scouts s ON s.id = sl.scout_id WHERE sl.id = scout_list_members.list_id AND s.user_id = auth.uid()));

CREATE POLICY "Scouts can delete own list members"
  ON public.scout_list_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM scout_lists sl JOIN scouts s ON s.id = sl.scout_id WHERE sl.id = scout_list_members.list_id AND s.user_id = auth.uid()));

-- Part 5: Conversation requests (scout → player messaging gate)
CREATE TABLE public.conversation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL REFERENCES public.scouts(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  initial_message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(scout_id, player_id)
);

ALTER TABLE public.conversation_requests ENABLE ROW LEVEL SECURITY;

-- Scouts can view their own requests
CREATE POLICY "Scouts can view own requests"
  ON public.conversation_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM scouts s WHERE s.id = conversation_requests.scout_id AND s.user_id = auth.uid()));

-- Players can view requests sent to them
CREATE POLICY "Players can view own requests"
  ON public.conversation_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM players p WHERE p.id = conversation_requests.player_id AND p.user_id = auth.uid()));

-- Only scouts can create requests
CREATE POLICY "Scouts can create requests"
  ON public.conversation_requests FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM scouts s WHERE s.id = conversation_requests.scout_id AND s.user_id = auth.uid()));

-- Players can update (accept/decline) their own requests
CREATE POLICY "Players can respond to requests"
  ON public.conversation_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM players p WHERE p.id = conversation_requests.player_id AND p.user_id = auth.uid()));

-- Part 6: Conversations (created when request accepted)
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL REFERENCES public.scouts(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.conversation_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scout_id, player_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scouts can view own conversations"
  ON public.conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM scouts s WHERE s.id = conversations.scout_id AND s.user_id = auth.uid()));

CREATE POLICY "Players can view own conversations"
  ON public.conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM players p WHERE p.id = conversations.player_id AND p.user_id = auth.uid()));

-- Conversations are created via a function when request is accepted, but allow insert for scouts in accepted state
CREATE POLICY "System can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM scouts s WHERE s.id = conversations.scout_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM players p WHERE p.id = conversations.player_id AND p.user_id = auth.uid())
  );

-- Part 7: Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_role text NOT NULL, -- 'scout' or 'player'
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Scouts can view messages in their conversations
CREATE POLICY "Scouts can view conversation messages"
  ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c 
    JOIN scouts s ON s.id = c.scout_id 
    WHERE c.id = messages.conversation_id AND s.user_id = auth.uid()
  ));

-- Players can view messages in their conversations
CREATE POLICY "Players can view conversation messages"
  ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c 
    JOIN players p ON p.id = c.player_id 
    WHERE c.id = messages.conversation_id AND p.user_id = auth.uid()
  ));

-- Scouts can send messages in their conversations
CREATE POLICY "Scouts can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_role = 'scout' AND
    EXISTS (
      SELECT 1 FROM conversations c 
      JOIN scouts s ON s.id = c.scout_id 
      WHERE c.id = messages.conversation_id AND s.user_id = auth.uid() AND s.id = messages.sender_id
    )
  );

-- Players can send messages in accepted conversations only
CREATE POLICY "Players can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_role = 'player' AND
    EXISTS (
      SELECT 1 FROM conversations c 
      JOIN players p ON p.id = c.player_id 
      JOIN conversation_requests cr ON cr.scout_id = c.scout_id AND cr.player_id = c.player_id
      WHERE c.id = messages.conversation_id AND p.user_id = auth.uid() AND p.id = messages.sender_id AND cr.status = 'accepted'
    )
  );

-- Update conversations last_message_at trigger
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_conversation_timestamp
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Function to accept a conversation request and create conversation
CREATE OR REPLACE FUNCTION public.accept_conversation_request(_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
  conv_id uuid;
BEGIN
  SELECT * INTO req FROM conversation_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  
  -- Verify the caller is the player
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = req.player_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  IF req.status != 'pending' THEN RAISE EXCEPTION 'Request already responded to'; END IF;
  
  UPDATE conversation_requests SET status = 'accepted', responded_at = now() WHERE id = _request_id;
  
  INSERT INTO conversations (scout_id, player_id, request_id)
  VALUES (req.scout_id, req.player_id, _request_id)
  ON CONFLICT (scout_id, player_id) DO UPDATE SET last_message_at = now()
  RETURNING id INTO conv_id;
  
  -- Insert the initial message into the conversation
  INSERT INTO messages (conversation_id, sender_role, sender_id, body)
  VALUES (conv_id, 'scout', req.scout_id, req.initial_message);
  
  RETURN json_build_object('conversation_id', conv_id);
END;
$$;

-- Function to decline a conversation request
CREATE OR REPLACE FUNCTION public.decline_conversation_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
BEGIN
  SELECT * INTO req FROM conversation_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = req.player_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  IF req.status != 'pending' THEN RAISE EXCEPTION 'Request already responded to'; END IF;
  
  UPDATE conversation_requests SET status = 'declined', responded_at = now() WHERE id = _request_id;
END;
$$;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_requests;
