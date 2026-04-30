-- Migration 36 — Verified-highlight immutability trigger.
--
-- Migration 35 added verified_by_coach to player_highlights so a coach
-- can vouch for a clip. The verification action lives in the app layer
-- (verifyHighlightAction). This migration adds defense-in-depth at the
-- database layer:
--
--   1. A player who has CLAIMED a row (claimed_by_user_id = auth.uid())
--      can normally UPDATE / DELETE their own highlights via the
--      players_manage_own_highlights RLS policy from migration 30. We
--      do NOT want them to delete or modify a clip that a coach has
--      already verified — once vouched, the row is immutable from the
--      player side until the coach unverifies it.
--
--   2. Coaches in the player's program retain full control via the
--      coaches_in_program_can_write policy. A coach can update a
--      verified row (e.g. to flip verified_by_coach back to false if
--      they made a mistake). That code path isn't exposed in the UI
--      yet but the data model allows it.
--
-- Approach: a BEFORE UPDATE OR DELETE row trigger. RLS policies are
-- additive (any matching policy grants access), so we can't tighten
-- player access by adding another policy. A trigger runs AFTER policy
-- evaluation but BEFORE the row mutation lands, which is exactly what
-- we need: block players, allow coaches.
--
-- Behavior:
--   - On UPDATE / DELETE of a row where OLD.verified_by_coach = true,
--     check whether the current user is (a) the player who owns this
--     row and (b) NOT a coach in the player's program. If both, raise
--     an exception. Coaches in the program pass through.
--   - Unverified rows (verified_by_coach = false) are unaffected — the
--     trigger short-circuits at the top.
--
-- Idempotent. Safe to apply against any environment.

CREATE OR REPLACE FUNCTION public.prevent_player_modify_verified_highlight()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_player_owner boolean;
  _is_program_coach boolean;
BEGIN
  -- Short-circuit: only protect verified rows.
  IF COALESCE(OLD.verified_by_coach, false) = false THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Is the current user the player who claimed this highlight's row?
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = OLD.player_id
      AND p.claimed_by_user_id = auth.uid()
  ) INTO _is_player_owner;

  -- Is the current user a coach in the player's program? Coaches
  -- bypass this check — they can flip verified_by_coach back off,
  -- correct mistakes, etc.
  SELECT EXISTS (
    SELECT 1
    FROM public.coaches c
    JOIN public.players p ON p.program_id = c.program_id
    WHERE p.id = OLD.player_id
      AND c.user_id = auth.uid()
  ) INTO _is_program_coach;

  IF _is_player_owner AND NOT _is_program_coach THEN
    RAISE EXCEPTION 'Cannot modify a coach-verified highlight'
      USING HINT = 'Ask a coach in your program to unverify the clip first.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS prevent_player_modify_verified_highlight_trg
  ON public.player_highlights;

CREATE TRIGGER prevent_player_modify_verified_highlight_trg
  BEFORE UPDATE OR DELETE ON public.player_highlights
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_player_modify_verified_highlight();

COMMENT ON FUNCTION public.prevent_player_modify_verified_highlight() IS
  'Defense-in-depth: blocks the player from modifying or deleting a coach-verified highlight. Coaches in the player''s program pass through. Paired with the app-layer check in verifyHighlightAction / removeHighlightAction.';
