-- Migration 34 — Player Profile V1.
--
-- Two additive columns that close the gap between "verified vs player-
-- reported" data on public profiles. Migration 30 already shipped the
-- raw fields (sat_score, act_score, gpa, intended_level, class_rank_*,
-- bio); this migration adds:
--
--   show_academics       boolean DEFAULT false
--     Per-profile gate for academic visibility on the PUBLIC /p/<handle>
--     page. Distinct from `show_contact_info` (which gates phone /
--     email / socials). A player can opt their profile public WITHOUT
--     also exposing their GPA / SAT / ACT to anonymous visitors;
--     this defaults OFF so academic data is hidden by default. The
--     /p/[handle] page reads this and conditionally renders the
--     academics card.
--
--   prior_stats          jsonb DEFAULT '[]'::jsonb
--     Player-entered career stats from BEFORE Rostr (e.g. "2024 JV:
--     .312 BA, 5 HR"). Stored as a flexible array so the player can
--     add multiple seasons. Always rendered on the public profile
--     under a "Player Reported" header — never mixed with verified
--     game stats. Schema is JSONB rather than a sub-table because
--     queries are always per-player and the structure is tiny.
--
--     Shape:
--       [
--         { "season": "2024", "level": "JV",
--           "ba": ".312", "ops": ".845", "hr": "5", "rbi": "22",
--           "context": "Spring 2024" }
--       ]
--     All fields are TEXT (we don't enforce types — players know their
--     own format and pasting "5" or "5.0" or "5/22" should all flow).
--
-- Both columns are idempotent. Safe to apply against any environment.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS show_academics boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prior_stats jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.players.show_academics IS
  'When true AND profile_public=true, the academics card (GPA / SAT / ACT / class rank / intended level) renders on /p/<handle>. Defaults false so academic data is hidden from anonymous visitors by default.';

COMMENT ON COLUMN public.players.prior_stats IS
  'Player-reported career stats from before Rostr. JSON array of season objects. Rendered under a "Player Reported" header on the public profile, never mixed with verified game stats.';
