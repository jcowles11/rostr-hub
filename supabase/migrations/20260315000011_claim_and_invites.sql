-- Player claim + Coach invites (v1)
--
-- Unlocks the two "people join the program" flows:
--
--   1. Player claim — a coach enters a player manually, gets a one-time
--      URL they share with the player (text, email, QR). When the player
--      clicks it, signs up or in, the player row is linked to their auth
--      user. From then on the player can sign in and see their own
--      profile, schedule, and availability.
--
--   2. Coach invite — a head coach invites an assistant by email. The
--      assistant clicks a link, signs up or in, and is auto-linked to
--      the program as a coach. Unlocks station scoring with a team of
--      coaches.
--
-- Both flows use short random tokens. Token lookup is done via
-- SECURITY DEFINER RPC functions so no broad SELECT policy is required
-- (avoids accidentally exposing all player rows to anon callers).

-- ── Player claim columns ──────────────────────────────────────────

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Backfill tokens for existing players so every player has a shareable
-- claim link. Uses pgcrypto's gen_random_bytes for a 24-char hex token.
UPDATE public.players
SET claim_token = encode(gen_random_bytes(12), 'hex')
WHERE claim_token IS NULL;

-- Now enforce uniqueness + not-null on the token column so new rows
-- without a token fail loudly rather than creating a collision.
ALTER TABLE public.players
  ALTER COLUMN claim_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_claim_token_unique'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_claim_token_unique UNIQUE (claim_token);
  END IF;
END $$;

-- Future inserts default to a fresh random token.
ALTER TABLE public.players
  ALTER COLUMN claim_token SET DEFAULT encode(gen_random_bytes(12), 'hex');

CREATE INDEX IF NOT EXISTS idx_players_claimed_by
  ON public.players(claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;

-- Self-serve UPDATE: once a user has claimed a player row, they can
-- update limited fields (availability, note). Coaches retain full
-- control via the coach-scoped policies defined in the original
-- migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'players'
    AND policyname = 'Claimed player can update self'
  ) THEN
    CREATE POLICY "Claimed player can update self"
      ON public.players FOR UPDATE
      USING (claimed_by_user_id = auth.uid())
      WITH CHECK (claimed_by_user_id = auth.uid());
  END IF;
END $$;

-- ── Coach invites table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coach_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  invited_email text,                        -- optional: pre-fill signup form
  invited_name text,                         -- optional: display hint
  invite_token text UNIQUE NOT NULL
    DEFAULT encode(gen_random_bytes(12), 'hex'),
  role coach_role NOT NULL DEFAULT 'assistant_coach',
  created_by uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_coach_invites_program
  ON public.coach_invites(program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_invites_unaccepted
  ON public.coach_invites(program_id)
  WHERE accepted_at IS NULL;

ALTER TABLE public.coach_invites ENABLE ROW LEVEL SECURITY;

-- Head coaches can see + create + revoke invites on their program.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coach_invites' AND policyname = 'Head coaches view invites') THEN
    CREATE POLICY "Head coaches view invites"
      ON public.coach_invites FOR SELECT
      USING (program_id IN (
        SELECT program_id FROM coaches
        WHERE user_id = auth.uid() AND role = 'head_coach'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coach_invites' AND policyname = 'Head coaches create invites') THEN
    CREATE POLICY "Head coaches create invites"
      ON public.coach_invites FOR INSERT
      WITH CHECK (program_id IN (
        SELECT program_id FROM coaches
        WHERE user_id = auth.uid() AND role = 'head_coach'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coach_invites' AND policyname = 'Head coaches delete invites') THEN
    CREATE POLICY "Head coaches delete invites"
      ON public.coach_invites FOR DELETE
      USING (program_id IN (
        SELECT program_id FROM coaches
        WHERE user_id = auth.uid() AND role = 'head_coach'
      ));
  END IF;
END $$;

-- ── RPC: claim_player_by_token ────────────────────────────────────
--
-- Called by /claim/[token] after the visitor has signed up / in.
-- Atomically:
--   1. Looks up the player by token
--   2. Verifies it isn't already claimed
--   3. Sets claimed_by_user_id = auth.uid() and claimed_at = now()
--   4. Returns { player_id, program_id, profile_slug } so the page
--      can redirect to the player's public profile.
--
-- Raises specific errors for the UI to render friendly messages.

CREATE OR REPLACE FUNCTION public.claim_player_by_token(_token text)
RETURNS TABLE (player_id uuid, program_id uuid, profile_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pl public.players%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO pl FROM public.players WHERE claim_token = _token;
  IF pl.id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF pl.claimed_by_user_id IS NOT NULL AND pl.claimed_by_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  UPDATE public.players
  SET claimed_by_user_id = auth.uid(),
      claimed_at = COALESCE(pl.claimed_at, now())
  WHERE id = pl.id;

  RETURN QUERY SELECT pl.id, pl.program_id, pl.profile_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_player_by_token(text) TO authenticated;

-- ── RPC: get_player_preview_by_token ──────────────────────────────
--
-- Read-only preview used by /claim/[token] BEFORE the visitor signs in
-- so we can show "Claim profile for Marcus Johnson · #21" instead of a
-- generic "claim this player" screen. Returns minimal public-safe
-- fields only.

CREATE OR REPLACE FUNCTION public.get_player_preview_by_token(_token text)
RETURNS TABLE (
  first_name text,
  last_name text,
  jersey int,
  grade int,
  team_name text,
  already_claimed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.first_name,
    p.last_name,
    p.player_number AS jersey,
    p.grade,
    pr.name AS team_name,
    (p.claimed_by_user_id IS NOT NULL) AS already_claimed
  FROM public.players p
  JOIN public.programs pr ON pr.id = p.program_id
  WHERE p.claim_token = _token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_preview_by_token(text) TO anon, authenticated;

-- ── RPC: get_invite_preview_by_token ──────────────────────────────
--
-- Read-only preview for /invite/[token] before signup.

CREATE OR REPLACE FUNCTION public.get_invite_preview_by_token(_token text)
RETURNS TABLE (
  program_name text,
  role text,
  invited_name text,
  invited_email text,
  already_accepted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.name AS program_name,
    ci.role::text,
    ci.invited_name,
    ci.invited_email,
    (ci.accepted_at IS NOT NULL) AS already_accepted
  FROM public.coach_invites ci
  JOIN public.programs p ON p.id = ci.program_id
  WHERE ci.invite_token = _token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview_by_token(text) TO anon, authenticated;

-- ── RPC: accept_coach_invite ──────────────────────────────────────
--
-- Called by /invite/[token] after signup/signin. Creates the coach +
-- organization_member rows and marks the invite accepted. Runs as
-- definer so the new coach can insert into coaches/organization_members
-- even though they're not yet a member of the program.

CREATE OR REPLACE FUNCTION public.accept_coach_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.coach_invites%ROWTYPE;
  new_coach_id uuid;
  user_email text;
  user_full_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO inv FROM public.coach_invites WHERE invite_token = _token;
  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;
  IF inv.accepted_at IS NOT NULL AND inv.accepted_by_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'invite_already_accepted';
  END IF;

  -- Already a coach on this program? Mark accepted and return.
  IF EXISTS (
    SELECT 1 FROM public.coaches
    WHERE user_id = auth.uid() AND program_id = inv.program_id
  ) THEN
    UPDATE public.coach_invites
      SET accepted_at = now(),
          accepted_by_user_id = auth.uid()
      WHERE id = inv.id;
    RETURN inv.program_id;
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
    INTO user_email, user_full_name
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO public.coaches (user_id, program_id, full_name, email, role, color)
    VALUES (
      auth.uid(),
      inv.program_id,
      COALESCE(inv.invited_name, user_full_name, 'Coach'),
      COALESCE(user_email, inv.invited_email, ''),
      inv.role,
      '#3B82F6'
    )
    RETURNING id INTO new_coach_id;

  INSERT INTO public.organization_members
    (user_id, organization_id, program_id, role, full_name, email, color)
  SELECT
    auth.uid(),
    p.organization_id,
    inv.program_id,
    'coach',
    COALESCE(inv.invited_name, user_full_name, 'Coach'),
    COALESCE(user_email, inv.invited_email, ''),
    '#3B82F6'
  FROM public.programs p
  WHERE p.id = inv.program_id
  ON CONFLICT DO NOTHING;

  UPDATE public.coach_invites
    SET accepted_at = now(),
        accepted_by_user_id = auth.uid()
    WHERE id = inv.id;

  RETURN inv.program_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_coach_invite(text) TO authenticated;
