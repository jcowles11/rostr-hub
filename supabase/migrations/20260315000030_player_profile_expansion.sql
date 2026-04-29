-- Migration 30 — Player profile expansion.
--
-- Pumps the player profile up to "LinkedIn for high-school athletes"
-- depth. New columns + a multi-row highlight-videos table give players
-- the customization knobs they need to actually compete for recruiter
-- attention, while keeping every field optional so brand-new claims
-- still see a clean profile.
--
-- All academic fields are PLAYER-ENTERED (no coach editing). That's
-- the path of least resistance for getting accurate data — the kid
-- looking at their own report card is the source of truth, not a
-- coach with a clipboard.
--
-- New columns on players:
--   gpa                         (text — already exists, see migration 02)
--   sat_score                   (integer 400-1600)
--   act_score                   (integer 1-36)
--   class_rank_numerator        (integer — "5 of 240" → 5)
--   class_rank_denominator      (integer — "5 of 240" → 240)
--   intended_level              (D1 / D2 / D3 / NAIA / Juco / Open)
--   school_logo_url             (text — links to a logo image; can be
--                                hosted in Supabase storage or external)
--   bio                         (text — short "about me" blurb; up to
--                                500 chars enforced in app, not DB)
--
-- New table:
--   player_highlights           (multi-row, ordered, with caption + url)
--
-- This migration is fully idempotent so it can be applied to any state.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS sat_score smallint,
  ADD COLUMN IF NOT EXISTS act_score smallint,
  ADD COLUMN IF NOT EXISTS class_rank_numerator integer,
  ADD COLUMN IF NOT EXISTS class_rank_denominator integer,
  ADD COLUMN IF NOT EXISTS intended_level text,
  ADD COLUMN IF NOT EXISTS school_logo_url text,
  ADD COLUMN IF NOT EXISTS bio text;

-- Sanity guards on academic fields. NULL = "not entered" (the default,
-- privacy-respecting). When entered, the values must be in the real-
-- world ranges — no negatives, no SAT 9999.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_sat_score_range'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_sat_score_range
      CHECK (sat_score IS NULL OR (sat_score BETWEEN 400 AND 1600));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_act_score_range'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_act_score_range
      CHECK (act_score IS NULL OR (act_score BETWEEN 1 AND 36));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_class_rank_sane'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_class_rank_sane
      CHECK (
        (class_rank_numerator IS NULL AND class_rank_denominator IS NULL)
        OR (
          class_rank_numerator > 0
          AND class_rank_denominator > 0
          AND class_rank_numerator <= class_rank_denominator
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_intended_level_enum'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_intended_level_enum
      CHECK (
        intended_level IS NULL
        OR intended_level IN ('D1','D2','D3','NAIA','Juco','Open','Other')
      );
  END IF;
END
$$;

-- Highlight videos. Multiple per player, ordered by sort_order. URL
-- can point to YouTube / Hudl / Vimeo / or a Supabase-storage MP4.
-- We deliberately don't restrict providers — coaches just want the
-- thing to play.
CREATE TABLE IF NOT EXISTS public.player_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_highlights_player_id_idx
  ON public.player_highlights(player_id);

CREATE INDEX IF NOT EXISTS player_highlights_player_id_sort_order_idx
  ON public.player_highlights(player_id, sort_order);

-- RLS: same pattern as the other player_* tables.
--   - Coaches in the player's program can read/write.
--   - The player who has claimed the row can read/write their own.
--   - Anyone (recruiters, public) can read highlights for a player
--     whose profile is opted-in (handled in the SELECT view used by
--     the public profile route — application-layer gate, not RLS).
ALTER TABLE public.player_highlights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'player_highlights' AND policyname = 'coaches_in_program_can_read'
  ) THEN
    CREATE POLICY coaches_in_program_can_read ON public.player_highlights
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.players p
          JOIN public.coaches c ON c.program_id = p.program_id
          WHERE p.id = player_highlights.player_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'player_highlights' AND policyname = 'coaches_in_program_can_write'
  ) THEN
    CREATE POLICY coaches_in_program_can_write ON public.player_highlights
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.players p
          JOIN public.coaches c ON c.program_id = p.program_id
          WHERE p.id = player_highlights.player_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.players p
          JOIN public.coaches c ON c.program_id = p.program_id
          WHERE p.id = player_highlights.player_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'player_highlights' AND policyname = 'players_manage_own_highlights'
  ) THEN
    CREATE POLICY players_manage_own_highlights ON public.player_highlights
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.players p
          WHERE p.id = player_highlights.player_id
            AND p.claimed_by_user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.players p
          WHERE p.id = player_highlights.player_id
            AND p.claimed_by_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'player_highlights' AND policyname = 'public_can_read_highlights_for_opted_in_profiles'
  ) THEN
    -- Public read is gated at the *application* layer (the /p/[handle]
    -- query joins through players.show_contact_info / public flag).
    -- We add a permissive SELECT policy here so anonymous fetches
    -- don't get blocked by RLS — the app is the gatekeeper.
    CREATE POLICY public_can_read_highlights_for_opted_in_profiles
      ON public.player_highlights
      FOR SELECT
      USING (true);
  END IF;
END
$$;

-- Comment columns for self-documentation.
COMMENT ON COLUMN public.players.sat_score IS 'Player-entered SAT total (400-1600). Optional.';
COMMENT ON COLUMN public.players.act_score IS 'Player-entered ACT composite (1-36). Optional.';
COMMENT ON COLUMN public.players.class_rank_numerator IS 'Class rank numerator — "5" in "5 of 240". Optional.';
COMMENT ON COLUMN public.players.class_rank_denominator IS 'Class rank denominator — "240" in "5 of 240". Optional.';
COMMENT ON COLUMN public.players.intended_level IS 'Target college level: D1/D2/D3/NAIA/Juco/Open/Other. Optional.';
COMMENT ON COLUMN public.players.school_logo_url IS 'URL of the player''s high school logo. Optional.';
COMMENT ON COLUMN public.players.bio IS 'Short "about me" blurb. App enforces 500-char limit.';
COMMENT ON TABLE public.player_highlights IS 'Multiple highlight videos per player, ordered by sort_order.';
