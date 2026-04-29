-- Imported stats from external systems (GameChanger, MaxPreps, etc.)
--
-- The live views in 000018/000019 derive batting + pitching lines from
-- the append-only game_events log. Coaches who haven't live-scored in
-- Rostr yet still need to show their season stats — so we support a
-- parallel "imported" path: CSV upload populates these tables and the
-- service layer falls back to them when no live data exists.
--
-- Rows are keyed by (program_id, player_id, season_year). An upsert
-- on that key replaces the row each time the coach re-imports — the
-- CSV file is the source of truth, not the accumulated edits.
--
-- Provenance: `source` tracks where the row came from so we can
-- attribute "imported from GameChanger · 2026-04-23" on the UI.
-- `imported_at` + `imported_by` let coaches see who/when.

-- ── Imported batting ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_imported_batting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season_year integer NOT NULL,

  -- Counting stats (same vocabulary as player_season_batting for a
  -- one-to-one service-layer swap)
  games integer NOT NULL DEFAULT 0,
  pa integer NOT NULL DEFAULT 0,
  ab integer NOT NULL DEFAULT 0,
  h integer NOT NULL DEFAULT 0,
  singles integer NOT NULL DEFAULT 0,
  doubles integer NOT NULL DEFAULT 0,
  triples integer NOT NULL DEFAULT 0,
  hr integer NOT NULL DEFAULT 0,
  bb integer NOT NULL DEFAULT 0,
  hbp integer NOT NULL DEFAULT 0,
  k integer NOT NULL DEFAULT 0,
  sac integer NOT NULL DEFAULT 0,
  rbi integer NOT NULL DEFAULT 0,
  r integer NOT NULL DEFAULT 0,
  sb integer NOT NULL DEFAULT 0,

  -- Rates (copy from CSV to preserve scorekeeper precision)
  ba numeric(4,3) NOT NULL DEFAULT 0,
  obp numeric(4,3) NOT NULL DEFAULT 0,
  slg numeric(4,3) NOT NULL DEFAULT 0,
  ops numeric(5,3) NOT NULL DEFAULT 0,

  -- Provenance
  source text NOT NULL DEFAULT 'gamechanger',
  source_note text,                  -- e.g. "Heritage Eagles JV Spring 2026"
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (program_id, player_id, season_year)
);

CREATE INDEX IF NOT EXISTS idx_imported_batting_by_program
  ON public.player_imported_batting(program_id, season_year);
CREATE INDEX IF NOT EXISTS idx_imported_batting_by_player
  ON public.player_imported_batting(player_id);

ALTER TABLE public.player_imported_batting ENABLE ROW LEVEL SECURITY;

-- Coaches on the program can read + write their own imported rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_imported_batting' AND policyname = 'Coaches manage own imported batting') THEN
    CREATE POLICY "Coaches manage own imported batting"
      ON public.player_imported_batting FOR ALL
      USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()))
      WITH CHECK (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));
  END IF;

  -- Public profile + recruiter access: anon can SELECT imported stats
  -- for any player whose profile is public. (Matches the access pattern
  -- on player_season_batting.)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_imported_batting' AND policyname = 'Public reads imported batting') THEN
    CREATE POLICY "Public reads imported batting"
      ON public.player_imported_batting FOR SELECT
      USING (
        player_id IN (SELECT id FROM players WHERE profile_public = true)
      );
  END IF;
END $$;

-- ── Imported pitching ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_imported_pitching (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season_year integer NOT NULL,

  games integer NOT NULL DEFAULT 0,              -- GP pitching
  games_started integer NOT NULL DEFAULT 0,      -- GS
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  bf integer NOT NULL DEFAULT 0,                 -- batters faced
  outs integer NOT NULL DEFAULT 0,               -- innings × 3 + fractional outs
  -- IP stored as numeric so 6.1 (=6⅓) + 6.2 (=6⅔) sum correctly when
  -- aggregated later. UI converts outs→IP on display.
  ip numeric(6,2) NOT NULL DEFAULT 0,
  pitches integer NOT NULL DEFAULT 0,            -- #P
  h integer NOT NULL DEFAULT 0,
  hr integer NOT NULL DEFAULT 0,
  r integer NOT NULL DEFAULT 0,
  er integer NOT NULL DEFAULT 0,
  bb integer NOT NULL DEFAULT 0,
  hbp integer NOT NULL DEFAULT 0,
  k integer NOT NULL DEFAULT 0,

  -- Rates (copy from CSV)
  era numeric(5,2) NOT NULL DEFAULT 0,
  whip numeric(5,3) NOT NULL DEFAULT 0,
  k9 numeric(5,2) NOT NULL DEFAULT 0,
  bb9 numeric(5,2) NOT NULL DEFAULT 0,
  baa numeric(4,3) NOT NULL DEFAULT 0,           -- opponent BA

  source text NOT NULL DEFAULT 'gamechanger',
  source_note text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (program_id, player_id, season_year)
);

CREATE INDEX IF NOT EXISTS idx_imported_pitching_by_program
  ON public.player_imported_pitching(program_id, season_year);
CREATE INDEX IF NOT EXISTS idx_imported_pitching_by_player
  ON public.player_imported_pitching(player_id);

ALTER TABLE public.player_imported_pitching ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_imported_pitching' AND policyname = 'Coaches manage own imported pitching') THEN
    CREATE POLICY "Coaches manage own imported pitching"
      ON public.player_imported_pitching FOR ALL
      USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()))
      WITH CHECK (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_imported_pitching' AND policyname = 'Public reads imported pitching') THEN
    CREATE POLICY "Public reads imported pitching"
      ON public.player_imported_pitching FOR SELECT
      USING (
        player_id IN (SELECT id FROM players WHERE profile_public = true)
      );
  END IF;
END $$;
