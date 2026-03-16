-- Team Management Module: games, game rosters, and lineups
-- Extends existing schema without modifying roster_assignments or programs.levels

-- ── Games ──────────────────────────────────────────────────────────
-- A game/event within a program, optionally scoped to a team level and season.
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  season_id uuid REFERENCES seasons(id) ON DELETE SET NULL,
  name text NOT NULL,                          -- e.g. "vs Lincoln High"
  opponent text,                               -- opponent name
  team_level text,                             -- matches programs.levels value (e.g. "Varsity")
  game_date date NOT NULL DEFAULT CURRENT_DATE,
  game_time time,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES coaches(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_games_program ON games(program_id, game_date DESC);
CREATE INDEX idx_games_season ON games(season_id) WHERE season_id IS NOT NULL;

-- ── Game Rosters ───────────────────────────────────────────────────
-- Which players are active (available/selected) for a specific game.
CREATE TABLE IF NOT EXISTS game_rosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'injured', 'suspended')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (game_id, player_id)
);

CREATE INDEX idx_game_rosters_game ON game_rosters(game_id);

-- ── Lineup Entries ─────────────────────────────────────────────────
-- Per-game batting order and defensive position assignments.
-- Sport-agnostic: batting_order is an integer (null if not in lineup),
-- position is a free-text field matching the program's sport conventions.
CREATE TABLE IF NOT EXISTS lineup_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  batting_order integer,                       -- 1-based; null = not in batting lineup
  position text,                               -- defensive position (e.g. "SS", "CF", "GK")
  inning_half text,                            -- optional: for platoon/substitution tracking
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (game_id, player_id)
);

CREATE INDEX idx_lineup_entries_game ON lineup_entries(game_id);
CREATE INDEX idx_lineup_entries_batting ON lineup_entries(game_id, batting_order) WHERE batting_order IS NOT NULL;

-- ── RLS Policies ───────────────────────────────────────────────────
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineup_entries ENABLE ROW LEVEL SECURITY;

-- Games: coaches can view games for their program; head coaches can manage
CREATE POLICY "Coaches can view program games"
  ON games FOR SELECT
  USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()));

CREATE POLICY "Head coaches can insert games"
  ON games FOR INSERT
  WITH CHECK (
    program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid() AND role = 'head_coach')
    OR created_by IN (SELECT id FROM coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "Head coaches can update games"
  ON games FOR UPDATE
  USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid() AND role = 'head_coach'));

CREATE POLICY "Head coaches can delete games"
  ON games FOR DELETE
  USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid() AND role = 'head_coach'));

-- Game rosters: coaches can view; head coaches + game creator can manage
CREATE POLICY "Coaches can view game rosters"
  ON game_rosters FOR SELECT
  USING (game_id IN (SELECT id FROM games WHERE program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())));

CREATE POLICY "Coaches can manage game rosters"
  ON game_rosters FOR INSERT
  WITH CHECK (game_id IN (SELECT id FROM games WHERE program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())));

CREATE POLICY "Coaches can update game rosters"
  ON game_rosters FOR UPDATE
  USING (game_id IN (SELECT id FROM games WHERE program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())));

CREATE POLICY "Coaches can delete game rosters"
  ON game_rosters FOR DELETE
  USING (game_id IN (SELECT id FROM games WHERE program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())));

-- Lineup entries: coaches can view; coaches can manage
CREATE POLICY "Coaches can view lineup entries"
  ON lineup_entries FOR SELECT
  USING (game_id IN (SELECT id FROM games WHERE program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())));

CREATE POLICY "Coaches can manage lineup entries"
  ON lineup_entries FOR INSERT
  WITH CHECK (game_id IN (SELECT id FROM games WHERE program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())));

CREATE POLICY "Coaches can update lineup entries"
  ON lineup_entries FOR UPDATE
  USING (game_id IN (SELECT id FROM games WHERE program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())));

CREATE POLICY "Coaches can delete lineup entries"
  ON lineup_entries FOR DELETE
  USING (game_id IN (SELECT id FROM games WHERE program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid())));
