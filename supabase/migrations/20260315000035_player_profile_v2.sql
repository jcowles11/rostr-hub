-- Migration 35 — Player Profile V2.
--
-- Two additive changes that complete the advanced player profile
-- module (gated client-side by NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_
-- PROFILES). All data added here is hidden by default; nothing
-- becomes publicly visible until the player flips the corresponding
-- privacy switch.
--
--   players.contact_info       jsonb DEFAULT '{}'::jsonb
--     Player-controlled, public-facing contact + social links. Stored
--     as JSONB so the shape can evolve without ALTER TABLE churn.
--     Renders on /p/<handle> ONLY when BOTH:
--       (a) profile_public = true
--       (b) show_contact_info = true   (already on the table from
--           migration 30)
--     The toggle defaults OFF on every existing row, so this column
--     is invisible to the public until the player explicitly opts in.
--
--     Shape (all fields optional, all strings):
--       {
--         "email":       "kid@example.com",
--         "phone":       "+1-555-0100",
--         "twitter":     "@handle",
--         "instagram":   "@handle",
--         "tiktok":      "@handle",
--         "youtube":     "https://youtube.com/@channel",
--         "x":           "@handle",
--         "website":     "https://..."
--       }
--     Server action `updateContactInfoAction` validates with Zod and
--     enforces a max length per field. The "Player Reported" badge
--     is rendered alongside this card on the public profile so a
--     recruiter can never confuse a self-typed handle with one Rostr
--     verified.
--
--   player_highlights.verified_by_coach   boolean DEFAULT false
--   player_highlights.verified_by         uuid (coach user id)
--   player_highlights.verified_at         timestamptz
--     Sets up the data shape for a future "coach-verifies-this-clip"
--     flow without shipping the action UI in this migration. Until
--     then, every clip renders with a Player-Reported badge on the
--     public profile (because verified_by_coach defaults false). The
--     coach-side review route in this commit displays the field as
--     read-only — no write path until product OKs the verification UX.
--
-- Both changes are additive + idempotent. Safe to apply against any
-- environment.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS contact_info jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.players.contact_info IS
  'Player-typed contact + social handles. Rendered on /p/<handle> only when profile_public=true AND show_contact_info=true (migration 30 gate). Always badged "Player Reported" — never verified.';

ALTER TABLE public.player_highlights
  ADD COLUMN IF NOT EXISTS verified_by_coach boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

COMMENT ON COLUMN public.player_highlights.verified_by_coach IS
  'When true, the clip was reviewed by a coach in the player''s program and they vouch for it. UI badges verified clips with the shared VerifiedBadge atom; unverified clips badge "Player Reported". Defaults false. The coach verification action is not implemented yet — column is reserved for the next iteration.';

COMMENT ON COLUMN public.player_highlights.verified_by IS
  'auth.users.id of the coach who marked this clip verified. Null when not yet verified.';

COMMENT ON COLUMN public.player_highlights.verified_at IS
  'Timestamp of the most recent verification. Null when not verified.';
