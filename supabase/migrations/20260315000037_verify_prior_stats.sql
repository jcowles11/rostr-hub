-- Migration 37 — Verified prior-season stats.
--
-- Extends the verification system from highlights to player-reported
-- prior-season stat rows (the JSONB array on players.prior_stats from
-- migration 34).
--
-- Two changes here:
--
--   1. Backfill stable IDs on every existing prior_stats entry. The
--      verify/unverify flow needs row identity to match against. New
--      entries created via updatePriorStatsAction will have IDs from
--      birth; this migration fills in any rows already in the wild
--      that pre-date the verification work.
--
--      Each entry gains an `id` (text, uuid string) if missing. The
--      `verified_by_coach`, `verified_by`, `verified_at` fields default
--      false / null inside the JSONB shape — readers fall back to
--      false when absent so the migration is fully backward compatible.
--
--   2. A BEFORE UPDATE trigger on `players` that, when the player
--      (claimed_by_user_id = auth.uid()) tries to mutate prior_stats,
--      verifies that every entry which was verified in OLD still
--      exists in NEW with byte-identical content. Coaches in the
--      player's program bypass the check (they need to verify /
--      unverify, which legitimately mutates the verified_* fields).
--
-- The trigger is a defense-in-depth backstop. The app-layer merge in
-- updatePriorStatsAction is the primary gate; the trigger is the
-- "what if a malicious user crafts a direct supabase.from() call"
-- defense.
--
-- Idempotent. Safe to apply against any environment.

-- ── Backfill IDs ────────────────────────────────────────────────

UPDATE public.players p
SET prior_stats = (
  SELECT jsonb_agg(
    CASE
      WHEN (elt ? 'id') AND (elt->>'id' IS NOT NULL) AND (elt->>'id' <> '')
        THEN elt
      ELSE elt || jsonb_build_object('id', gen_random_uuid()::text)
    END
  )
  FROM jsonb_array_elements(p.prior_stats) elt
)
WHERE jsonb_typeof(p.prior_stats) = 'array'
  AND jsonb_array_length(p.prior_stats) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p.prior_stats) elt
    WHERE NOT (elt ? 'id')
       OR elt->>'id' IS NULL
       OR elt->>'id' = ''
  );

-- ── Trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_player_modify_verified_prior_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_player_owner boolean;
  _is_program_coach boolean;
  _old_entry jsonb;
  _found boolean;
  _entry_id text;
BEGIN
  -- Short-circuit: column unchanged.
  IF NEW.prior_stats IS NOT DISTINCT FROM OLD.prior_stats THEN
    RETURN NEW;
  END IF;

  -- Coach in the player's program: allowed to do anything (verify,
  -- unverify, edit content). The verification UI is a coach-only
  -- surface, so this is the legitimate write path.
  SELECT EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.program_id = NEW.program_id AND c.user_id = auth.uid()
  ) INTO _is_program_coach;
  IF _is_program_coach THEN
    RETURN NEW;
  END IF;

  -- Player owner attempting to mutate own prior_stats: must preserve
  -- every verified entry verbatim. Compare by id for stability;
  -- pre-migration entries without an id fall back to deep equality.
  _is_player_owner := (NEW.claimed_by_user_id = auth.uid());
  IF NOT _is_player_owner THEN
    -- Not the player, not a coach in the program — nothing to enforce
    -- here; RLS handles the gross access control.
    RETURN NEW;
  END IF;

  FOR _old_entry IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(OLD.prior_stats, '[]'::jsonb))
    WHERE COALESCE((value->>'verified_by_coach')::boolean, false) = true
  LOOP
    _entry_id := _old_entry->>'id';
    IF _entry_id IS NULL OR _entry_id = '' THEN
      -- Pre-migration row without a stable id: enforce deep equality
      -- against the new array.
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(NEW.prior_stats, '[]'::jsonb)) elt
        WHERE elt = _old_entry
      ) INTO _found;
    ELSE
      -- Match by id and require byte-identical content (so the
      -- player can't tamper with verified_* fields).
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(NEW.prior_stats, '[]'::jsonb)) elt
        WHERE elt->>'id' = _entry_id
          AND elt = _old_entry
      ) INTO _found;
    END IF;

    IF NOT _found THEN
      RAISE EXCEPTION 'Cannot modify a coach-verified prior season'
        USING HINT = 'Ask a coach in your program to unverify the row first.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_player_modify_verified_prior_stats_trg
  ON public.players;

CREATE TRIGGER prevent_player_modify_verified_prior_stats_trg
  BEFORE UPDATE OF prior_stats ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_player_modify_verified_prior_stats();

COMMENT ON FUNCTION public.prevent_player_modify_verified_prior_stats() IS
  'Defense-in-depth: blocks the player from modifying or deleting a coach-verified prior_stats entry. Coaches in the player''s program pass through. Paired with the app-layer merge in updatePriorStatsAction.';
