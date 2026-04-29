-- Player media (header + avatar + highlight video + commitment) and game-day prep.
--
-- Three additions:
--   1. Player profile media — header photo, avatar photo, highlight video
--      URL (YouTube/Hudl/Vimeo), commitment status + school
--   2. player_announcements — a feed of posts on each player's profile
--      (commitment, milestone, update, video drop)
--   3. Game prep columns on `games` — report time, school release,
--      uniform, equipment reminders, early lineup notes
--
-- URLs are text (not files) for v1. Coaches and players paste links
-- from social media, Google Drive, Hudl, YouTube. v2 can add real
-- Supabase Storage uploads without a schema change — just add a
-- bucket and let clients upload to the bucket + persist the returned
-- public URL into these columns.

-- ── Player media columns ─────────────────────────────────────────

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS header_url text,
  ADD COLUMN IF NOT EXISTS highlight_video_url text,
  ADD COLUMN IF NOT EXISTS commitment_status text
    CHECK (commitment_status IN ('uncommitted','committed','decommitted','decided') OR commitment_status IS NULL),
  ADD COLUMN IF NOT EXISTS commitment_school text,
  ADD COLUMN IF NOT EXISTS commitment_year integer,
  ADD COLUMN IF NOT EXISTS commitment_note text;

COMMENT ON COLUMN public.players.avatar_url IS
  'Profile photo URL. v1 = any publicly-accessible URL (social, Drive, Hudl). '
  'v2 will add Supabase Storage uploads behind the same column.';
COMMENT ON COLUMN public.players.header_url IS
  'Header / cover photo for the public profile (/p/[handle] hero banner).';
COMMENT ON COLUMN public.players.highlight_video_url IS
  'Primary highlight reel. Supports YouTube, Hudl, Vimeo URLs — we detect the provider and render the right iframe embed.';
COMMENT ON COLUMN public.players.commitment_status IS
  'committed = has committed to a school; decommitted = was committed, now open; decided = non-college path (pro, military, etc.).';

-- ── player_announcements ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  kind text NOT NULL CHECK (kind IN (
    'commitment',         -- "Committed to State U!"
    'milestone',          -- "100th career hit"
    'update',             -- generic update
    'video',              -- highlight drop
    'achievement',        -- "All-Conference 1st team"
    'offer'               -- "Received offer from X"
  )),
  title text NOT NULL,
  body text,
  image_url text,
  link_url text,
  /**
   * Pinned posts appear above unpinned in the feed. Useful for the
   * commitment announcement to stay at the top.
   */
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_by_player
  ON public.player_announcements(player_id, pinned DESC, created_at DESC);

ALTER TABLE public.player_announcements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Public can read announcements for any player with a public profile.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_announcements' AND policyname = 'Public reads player announcements') THEN
    CREATE POLICY "Public reads player announcements"
      ON public.player_announcements FOR SELECT
      USING (
        player_id IN (SELECT id FROM players WHERE profile_public = true)
      );
  END IF;

  -- Coaches on the player's program can manage the feed.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_announcements' AND policyname = 'Coaches manage announcements') THEN
    CREATE POLICY "Coaches manage announcements"
      ON public.player_announcements FOR ALL
      USING (
        player_id IN (
          SELECT p.id FROM players p
          JOIN coaches c ON c.program_id = p.program_id
          WHERE c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        player_id IN (
          SELECT p.id FROM players p
          JOIN coaches c ON c.program_id = p.program_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;

  -- Players who have claimed their profile can post their own
  -- announcements (commitment posts, etc).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_announcements' AND policyname = 'Players post to own feed') THEN
    CREATE POLICY "Players post to own feed"
      ON public.player_announcements FOR ALL
      USING (
        player_id IN (SELECT id FROM players WHERE claimed_by_user_id = auth.uid())
      )
      WITH CHECK (
        player_id IN (SELECT id FROM players WHERE claimed_by_user_id = auth.uid())
      );
  END IF;
END $$;

-- ── Game prep columns ────────────────────────────────────────────

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS report_time time,
  ADD COLUMN IF NOT EXISTS release_time time,
  ADD COLUMN IF NOT EXISTS uniform text,
  ADD COLUMN IF NOT EXISTS equipment_notes text,
  ADD COLUMN IF NOT EXISTS lineup_preview text,
  ADD COLUMN IF NOT EXISTS prep_notes text;

COMMENT ON COLUMN public.games.report_time IS
  'When players need to be at the field / bus pickup. Shown to players in /me and to parents on the public game page.';
COMMENT ON COLUMN public.games.release_time IS
  'When players are released from class. Coaches share this with teachers so players can leave early.';
COMMENT ON COLUMN public.games.uniform IS
  'e.g. "Home whites · gold belts · black cleats". Free text.';
COMMENT ON COLUMN public.games.equipment_notes IS
  'Reminders — bring own gloves, extra socks, rainy-day jackets, etc.';
COMMENT ON COLUMN public.games.lineup_preview IS
  'Free-form early look at the lineup. "Look for Jack in CF, Marcus batting cleanup." Set before the full lineup is finalized in the Lineup tab.';
COMMENT ON COLUMN public.games.prep_notes IS
  'Catch-all for anything not covered above — opponent scouting, travel directions, team dinner plans.';
