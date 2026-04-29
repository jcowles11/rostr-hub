-- Make public game views anon-readable
--
-- The live_game_snapshot + public_game_events views were created as
-- SECURITY INVOKER by default (PG 15+). That meant an anonymous visitor
-- hitting the fan page at /g/[id] triggered RLS on the underlying
-- games / game_events tables, which blocks anon access → 404.
--
-- Fix: run these views with SECURITY DEFINER semantics (security_invoker
-- = off) so they execute as the view owner and bypass RLS on the base
-- tables. Each view is narrow — only the minimum fields a fan needs.
-- No private data (player notes, tryout metrics, recruiter views, etc.)
-- is exposed through them.

ALTER VIEW public.live_game_snapshot SET (security_invoker = off);
ALTER VIEW public.public_game_events SET (security_invoker = off);

-- Also grant SELECT to anon on the base games row so the fan page's
-- additional metadata query (program name, game time, location) works.
-- This is narrow — we only allow SELECT, no INSERT/UPDATE/DELETE at
-- the anon role, and the columns we actually expose are already public
-- (a sports schedule).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'games' AND policyname = 'Public can view game schedules'
  ) THEN
    CREATE POLICY "Public can view game schedules"
      ON public.games FOR SELECT
      USING (true);
  END IF;

  -- Also allow anon to see program names (for the fan page header).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'programs' AND policyname = 'Public can view program names'
  ) THEN
    CREATE POLICY "Public can view program names"
      ON public.programs FOR SELECT
      USING (true);
  END IF;
END $$;
