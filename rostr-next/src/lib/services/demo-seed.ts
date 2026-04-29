/**
 * Demo data seeder — populates a coach's program with a fully
 * playable demo dataset so the product can be walked through end-to-end
 * without manual data entry.
 *
 * What it creates (scoped to the coach's program_id):
 *   - 25 players across Varsity / JV / Freshman
 *   - 5 upcoming games + 2 completed games
 *   - 4 practice events + 1 active practice plan with 6 blocks
 *   - 1 completed tryout with 6 stations + scores for ~15 players
 *   - Imported batting + pitching season stats for the V-level players
 *   - 8 player notes spread across various players
 *   - 1 completed game with full at-bat event log (for box-score content)
 *
 * Idempotency: marker player "Marcus Johnson #21" is checked first.
 * If present on this program, the seeder no-ops with a friendly note.
 *
 * Safe to run on any program: only touches rows scoped to programId.
 * Caller (the action) handles auth + ownership verification.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

const SEED_MARKER = { firstName: "Marcus", lastName: "Johnson", playerNumber: 21 };

interface SeedPlayer {
  firstName: string;
  lastName: string;
  jersey: number;
  positions: string[];
  level: "varsity" | "jv" | "freshman";
  classYear: 9 | 10 | 11 | 12;
  bats: "L" | "R" | "S";
  throws: "L" | "R";
  /** Optional season batting stats for V-level hitters. */
  batting?: { ab: number; h: number; bb: number; hr: number; rbi: number; r: number; ba: number; obp: number; slg: number };
  /** Optional season pitching stats. */
  pitching?: { ip: number; outs: number; h: number; r: number; er: number; bb: number; k: number; era: number; whip: number };
  profileSlug?: string;
}

const SEED_PLAYERS: SeedPlayer[] = [
  // Varsity (12)
  { firstName: "Marcus", lastName: "Johnson", jersey: 21, positions: ["CF"], level: "varsity", classYear: 12, bats: "R", throws: "R",
    profileSlug: "marcusjohnson21",
    batting: { ab: 64, h: 24, bb: 9, hr: 4, rbi: 22, r: 18, ba: 0.375, obp: 0.452, slg: 0.703 } },
  { firstName: "Jordan",   lastName: "Kim",        jersey: 12, positions: ["SS"],      level: "varsity", classYear: 11, bats: "L", throws: "R",
    batting: { ab: 60, h: 19, bb: 12, hr: 2, rbi: 14, r: 16, ba: 0.317, obp: 0.430, slg: 0.483 } },
  { firstName: "Alex",     lastName: "Riggs",      jersey: 7,  positions: ["P", "1B"], level: "varsity", classYear: 12, bats: "R", throws: "R",
    batting: { ab: 55, h: 17, bb: 6, hr: 3, rbi: 18, r: 12, ba: 0.309, obp: 0.371, slg: 0.527 },
    pitching: { ip: 42.1, outs: 127, h: 31, r: 16, er: 13, bb: 14, k: 49, era: 2.76, whip: 1.06 } },
  { firstName: "DeAndre",  lastName: "Brooks",     jersey: 33, positions: ["2B", "3B"],level: "varsity", classYear: 11, bats: "R", throws: "R",
    batting: { ab: 58, h: 17, bb: 5, hr: 1, rbi: 11, r: 14, ba: 0.293, obp: 0.349, slg: 0.414 } },
  { firstName: "Tre",      lastName: "Mbeki",      jersey: 44, positions: ["C"],       level: "varsity", classYear: 10, bats: "R", throws: "R",
    batting: { ab: 51, h: 13, bb: 7, hr: 1, rbi: 9, r: 8, ba: 0.255, obp: 0.345, slg: 0.353 } },
  { firstName: "Noah",     lastName: "Patel",      jersey: 8,  positions: ["RF"],      level: "varsity", classYear: 12, bats: "L", throws: "L",
    batting: { ab: 56, h: 17, bb: 8, hr: 2, rbi: 13, r: 15, ba: 0.304, obp: 0.391, slg: 0.500 } },
  { firstName: "Sean",     lastName: "Hale",       jersey: 27, positions: ["SS", "3B"],level: "varsity", classYear: 11, bats: "R", throws: "R",
    batting: { ab: 49, h: 13, bb: 4, hr: 0, rbi: 7, r: 9, ba: 0.265, obp: 0.321, slg: 0.347 } },
  { firstName: "Ty",       lastName: "Okafor",     jersey: 15, positions: ["P"],       level: "varsity", classYear: 10, bats: "R", throws: "R",
    pitching: { ip: 35.0, outs: 105, h: 28, r: 14, er: 12, bb: 11, k: 38, era: 3.09, whip: 1.11 } },
  { firstName: "Omar",     lastName: "Ruiz",       jersey: 5,  positions: ["LF"],      level: "varsity", classYear: 11, bats: "R", throws: "R",
    batting: { ab: 53, h: 15, bb: 5, hr: 1, rbi: 10, r: 11, ba: 0.283, obp: 0.345, slg: 0.396 } },
  { firstName: "Kai",      lastName: "Nakamura",   jersey: 23, positions: ["P", "DH"], level: "varsity", classYear: 12, bats: "L", throws: "L",
    batting: { ab: 38, h: 11, bb: 6, hr: 2, rbi: 9, r: 7, ba: 0.289, obp: 0.386, slg: 0.500 },
    pitching: { ip: 28.2, outs: 86, h: 22, r: 11, er: 10, bb: 9, k: 31, era: 3.14, whip: 1.08 } },
  { firstName: "Jaylen",   lastName: "Carter",     jersey: 9,  positions: ["1B"],      level: "varsity", classYear: 11, bats: "L", throws: "L",
    batting: { ab: 50, h: 14, bb: 4, hr: 2, rbi: 12, r: 8, ba: 0.280, obp: 0.333, slg: 0.460 } },
  { firstName: "Mateo",    lastName: "Vasquez",    jersey: 16, positions: ["3B"],      level: "varsity", classYear: 12, bats: "R", throws: "R",
    batting: { ab: 47, h: 12, bb: 7, hr: 1, rbi: 9, r: 10, ba: 0.255, obp: 0.358, slg: 0.383 } },
  // JV (10)
  { firstName: "Cal",      lastName: "Washington", jersey: 3,  positions: ["2B"],      level: "jv", classYear: 10, bats: "R", throws: "R" },
  { firstName: "Henry",    lastName: "Park",       jersey: 19, positions: ["P", "OF"], level: "jv", classYear: 10, bats: "R", throws: "R" },
  { firstName: "Ethan",    lastName: "Murphy",     jersey: 14, positions: ["SS"],      level: "jv", classYear: 10, bats: "R", throws: "R" },
  { firstName: "Zayd",     lastName: "Hassan",     jersey: 22, positions: ["CF"],      level: "jv", classYear: 11, bats: "L", throws: "L" },
  { firstName: "Brody",    lastName: "Sullivan",   jersey: 28, positions: ["C", "1B"], level: "jv", classYear: 10, bats: "R", throws: "R" },
  { firstName: "Lucas",    lastName: "Tran",       jersey: 31, positions: ["LF"],      level: "jv", classYear: 11, bats: "L", throws: "R" },
  { firstName: "Caleb",    lastName: "Foster",     jersey: 17, positions: ["P"],       level: "jv", classYear: 10, bats: "R", throws: "R" },
  { firstName: "Isaiah",   lastName: "Reed",       jersey: 4,  positions: ["3B"],      level: "jv", classYear: 11, bats: "R", throws: "R" },
  { firstName: "Owen",     lastName: "Bell",       jersey: 26, positions: ["RF"],      level: "jv", classYear: 10, bats: "R", throws: "R" },
  { firstName: "Felix",    lastName: "Holloway",   jersey: 6,  positions: ["P", "1B"], level: "jv", classYear: 11, bats: "L", throws: "L" },
  // Freshman (3)
  { firstName: "Diego",    lastName: "Alvarez",    jersey: 11, positions: ["C"],       level: "freshman", classYear: 9, bats: "R", throws: "R" },
  { firstName: "Tristan",  lastName: "Wong",       jersey: 25, positions: ["SS"],      level: "freshman", classYear: 9, bats: "L", throws: "R" },
  { firstName: "Quincy",   lastName: "Boyd",       jersey: 32, positions: ["P", "OF"], level: "freshman", classYear: 9, bats: "R", throws: "R" },
];

interface SeedResult {
  alreadySeeded: boolean;
  playersInserted: number;
  gamesInserted: number;
  practicesInserted: number;
  practicePlanBlocksInserted: number;
  tryoutAttendees: number;
  tryoutScoresInserted: number;
  battingRowsInserted: number;
  pitchingRowsInserted: number;
  notesInserted: number;
  completedGameEventsInserted: number;
}

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Main seeder. Idempotent — checks for the marker player and bails
 * with `alreadySeeded: true` if found.
 *
 * Returns a per-table count summary so the action layer can show the
 * coach what was created.
 */
export async function seedDemoData(programId: string, coachId: string): Promise<{
  data: SeedResult | null;
  error: string | null;
}> {
  const supabase = createSupabaseServerClient();

  // ── Idempotency check ────────────────────────────────────────
  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("program_id", programId)
    .eq("first_name", SEED_MARKER.firstName)
    .eq("last_name", SEED_MARKER.lastName)
    .eq("player_number", SEED_MARKER.playerNumber)
    .maybeSingle();
  if (existing) {
    return {
      data: {
        alreadySeeded: true,
        playersInserted: 0,
        gamesInserted: 0,
        practicesInserted: 0,
        practicePlanBlocksInserted: 0,
        tryoutAttendees: 0,
        tryoutScoresInserted: 0,
        battingRowsInserted: 0,
        pitchingRowsInserted: 0,
        notesInserted: 0,
        completedGameEventsInserted: 0,
      },
      error: null,
    };
  }

  // ── 1. Players ────────────────────────────────────────────────
  const playerInserts = SEED_PLAYERS.map((p) => ({
    program_id: programId,
    first_name: p.firstName,
    last_name: p.lastName,
    player_number: p.jersey,
    positions: p.positions,
    bats: p.bats,
    throws: p.throws,
    grade: p.classYear,
    profile_slug: p.profileSlug ?? null,
    availability_status: "ok",
  }));
  const { data: insertedPlayers, error: playerErr } = await supabase
    .from("players")
    .insert(playerInserts)
    .select("id, first_name, last_name, player_number");
  if (playerErr) return { data: null, error: `Players: ${playerErr.message}` };

  // Build a name → id map for the rest of the seed.
  const playerIdByName = new Map<string, string>();
  for (const p of insertedPlayers ?? []) {
    playerIdByName.set(`${p.first_name} ${p.last_name}`, p.id);
  }
  const idFor = (firstName: string, lastName: string): string => {
    const id = playerIdByName.get(`${firstName} ${lastName}`);
    if (!id) throw new Error(`Seed bug: missing player ${firstName} ${lastName}`);
    return id;
  };

  // ── 2. Roster assignments ────────────────────────────────────
  const rosterRows = SEED_PLAYERS.map((p) => ({
    program_id: programId,
    player_id: idFor(p.firstName, p.lastName),
    assignment: p.level,
    assigned_by: coachId,
  }));
  await supabase
    .from("roster_assignments")
    .upsert(rosterRows, { onConflict: "player_id" });

  // ── 3. Schedule: completed + upcoming games ──────────────────
  const completedGames = [
    { opp: "Oakridge",  daysAgo: -7, ours: 7, theirs: 4, level: "Varsity" },
    { opp: "Meridian",  daysAgo: -4, ours: 6, theirs: 3, level: "Varsity" },
  ];
  const upcomingGames = [
    { opp: "Central Hawks",       in: 2, time: "17:00", home: true,  level: "Varsity" },
    { opp: "Westfield Panthers",  in: 3, time: "13:00", home: false, level: "Varsity" },
    { opp: "Eastside Eagles",     in: 6, time: "16:30", home: true,  level: "Varsity" },
  ];

  const gameInserts = [
    ...completedGames.map((g) => ({
      program_id: programId,
      opponent: g.opp,
      game_date: todayISO(g.daysAgo),
      game_time: "17:00",
      location: "Lincoln HS · Main",
      home_away: "home",
      team_level: g.level,
      status: "completed",
      our_score: g.ours,
      opponent_score: g.theirs,
      live_status: "final",
      created_by: coachId,
    })),
    ...upcomingGames.map((g) => ({
      program_id: programId,
      opponent: g.opp,
      game_date: todayISO(g.in),
      game_time: g.time,
      location: g.home ? "Lincoln HS · Main" : `${g.opp} HS`,
      home_away: g.home ? "home" : "away",
      team_level: g.level,
      status: "scheduled",
      live_status: "not_started",
      created_by: coachId,
    })),
  ];
  const { data: insertedGames, error: gameErr } = await supabase
    .from("games")
    .insert(gameInserts)
    .select("id");
  if (gameErr) return { data: null, error: `Games: ${gameErr.message}` };

  // ── 4. Practices (separate from practice_plan with blocks) ───
  const practiceInserts = [
    { date: todayISO(0),  title: "Today's practice — situational hitting", time: "15:30" },
    { date: todayISO(1),  title: "Defensive fundamentals + bullpens",       time: "15:30" },
    { date: todayISO(4),  title: "Light BP + pregame prep",                  time: "15:30" },
    { date: todayISO(8),  title: "Full practice — base running + cutoffs",   time: "15:30" },
  ];
  const { error: practErr, data: insertedPractices } = await supabase
    .from("practice_plans")
    .insert(
      practiceInserts.map((p) => ({
        program_id: programId,
        practice_date: p.date,
        title: p.title,
        team_level: "Varsity",
        start_time: p.time,
        status: "draft",
        created_by: coachId,
      })),
    )
    .select("id, practice_date");
  if (practErr) return { data: null, error: `Practices: ${practErr.message}` };

  // Pick today's practice as the active plan and add 6 blocks to it
  const todayPractice = (insertedPractices ?? []).find((p) => p.practice_date === todayISO(0));
  let practicePlanBlocksInserted = 0;
  if (todayPractice) {
    const blocks = [
      { sort: 1, lane: "main",      cat: "warm",  name: "Dynamic warm + bands",        focus: "J-bands, hip openers",                        dur: 15 },
      { sort: 2, lane: "main",      cat: "hit",   name: "Tee work — inside/outside",   focus: "3 stations · 30 reps each",                  dur: 15 },
      { sort: 3, lane: "main",      cat: "hit",   name: "Front toss — two strikes",    focus: "Shorten up, battle approach",                dur: 20 },
      { sort: 4, lane: "secondary", cat: "pitch", name: "Bullpen — 25 pitch",          focus: "FB/CH/SL mix",                                dur: 20 },
      { sort: 5, lane: "main",      cat: "def",   name: "Infield groundballs",         focus: "Short hop, backhand",                         dur: 20 },
      { sort: 6, lane: "main",      cat: "cool",  name: "Team stretch + huddle",       focus: "Message of the day",                          dur: 8  },
    ];
    const { error: blockErr } = await supabase.from("practice_blocks").insert(
      blocks.map((b) => ({
        practice_plan_id: todayPractice.id,
        sort_order: b.sort,
        lane: b.lane,
        category: b.cat,
        activity_name: b.name,
        focus_text: b.focus,
        duration_min: b.dur,
      })),
    );
    if (blockErr) return { data: null, error: `Practice blocks: ${blockErr.message}` };
    practicePlanBlocksInserted = blocks.length;
  }

  // ── 5. Tryout with stations + scores ─────────────────────────
  const { data: insertedTryout, error: tryoutErr } = await supabase
    .from("tryouts")
    .insert({
      program_id: programId,
      name: "Spring '26 — open tryouts",
      start_date: todayISO(-30),
      end_date: todayISO(-28),
      notes: "3-day open tryout — 60 evaluators, all positions",
      status: "complete",
      created_by: coachId,
    })
    .select("id")
    .single();
  if (tryoutErr) return { data: null, error: `Tryout: ${tryoutErr.message}` };

  const stationDefs = [
    { name: "60-yard dash",       short: "60yd",  unit: "s",    type: "lower_better" },
    { name: "Exit velocity",      short: "EV",    unit: "mph",  type: "higher_better" },
    { name: "Pop time",           short: "POP",   unit: "s",    type: "lower_better" },
    { name: "Throwing velocity",  short: "VELO",  unit: "mph",  type: "higher_better" },
    { name: "Vertical jump",      short: "VJ",    unit: "in",   type: "higher_better" },
    { name: "Coachability",       short: "COACH", unit: null,   type: "rating" },
  ];
  const { data: insertedStations } = await supabase
    .from("tryout_stations")
    .insert(
      stationDefs.map((s, i) => ({
        tryout_id: insertedTryout.id,
        name: s.name,
        short_code: s.short,
        unit: s.unit,
        score_type: s.type,
        sort_order: i + 1,
        status: "active",
      })),
    )
    .select("id, short_code");

  // Mark all V players + half of JV as attendees
  const attendeePlayers = SEED_PLAYERS.filter(
    (p) => p.level === "varsity" || (p.level === "jv" && Math.random() < 0.6),
  );
  const attendeeRows = attendeePlayers.map((p) => ({
    tryout_id: insertedTryout.id,
    player_id: idFor(p.firstName, p.lastName),
    attended: true,
  }));
  await supabase.from("tryout_attendees").insert(attendeeRows);

  // Generate plausible scores for each player at each station.
  let tryoutScoresInserted = 0;
  if (insertedStations) {
    const scoreRows: Array<{
      tryout_id: string; station_id: string; player_id: string; value: number; scored_by: string;
    }> = [];
    const valueFor = (shortCode: string, idx: number): number => {
      // Deterministic but varied per player + station.
      const seed = (idx * 7 + shortCode.length * 13) % 100;
      switch (shortCode) {
        case "60yd":  return Number((6.50 + seed / 100 * 1.0).toFixed(2));   // 6.50 - 7.50
        case "EV":    return Math.round(80 + seed / 100 * 18);                // 80 - 98
        case "POP":   return Number((1.85 + seed / 100 * 0.45).toFixed(2));   // 1.85 - 2.30
        case "VELO":  return Math.round(75 + seed / 100 * 18);                // 75 - 93
        case "VJ":    return Math.round(20 + seed / 100 * 14);                // 20 - 34
        case "COACH": return Math.max(2, Math.min(5, Math.round(3 + (seed / 100 - 0.5) * 3)));
        default:      return 0;
      }
    };
    attendeePlayers.forEach((p, i) => {
      insertedStations.forEach((st) => {
        scoreRows.push({
          tryout_id: insertedTryout.id,
          station_id: st.id,
          player_id: idFor(p.firstName, p.lastName),
          value: valueFor(st.short_code, i),
          scored_by: coachId,
        });
      });
    });
    if (scoreRows.length > 0) {
      const { error: scoreErr } = await supabase
        .from("tryout_scores")
        .insert(scoreRows);
      if (scoreErr) return { data: null, error: `Tryout scores: ${scoreErr.message}` };
      tryoutScoresInserted = scoreRows.length;
    }
  }

  // ── 6. Imported batting + pitching season stats ──────────────
  const seasonYear = new Date().getFullYear();
  const battingRows = SEED_PLAYERS.filter((p) => p.batting).map((p) => ({
    program_id: programId,
    player_id: idFor(p.firstName, p.lastName),
    season_year: seasonYear,
    games: Math.round(p.batting!.ab / 3),
    pa: p.batting!.ab + p.batting!.bb,
    ab: p.batting!.ab,
    h: p.batting!.h,
    singles: Math.max(0, p.batting!.h - p.batting!.hr - 2),
    doubles: 2,
    triples: 0,
    hr: p.batting!.hr,
    bb: p.batting!.bb,
    hbp: 0,
    k: Math.round(p.batting!.ab * 0.18),
    sac: 1,
    rbi: p.batting!.rbi,
    r: p.batting!.r,
    sb: 2,
    ba: p.batting!.ba,
    obp: p.batting!.obp,
    slg: p.batting!.slg,
    ops: p.batting!.obp + p.batting!.slg,
    source: "manual",
    source_note: "Demo seed data",
    imported_at: new Date().toISOString(),
    imported_by: coachId,
  }));
  if (battingRows.length > 0) {
    const { error: batErr } = await supabase
      .from("player_imported_batting")
      .insert(battingRows);
    if (batErr) return { data: null, error: `Batting: ${batErr.message}` };
  }

  const pitchingRows = SEED_PLAYERS.filter((p) => p.pitching).map((p) => ({
    program_id: programId,
    player_id: idFor(p.firstName, p.lastName),
    season_year: seasonYear,
    games: Math.round(p.pitching!.ip / 5),
    games_started: Math.round(p.pitching!.ip / 6),
    wins: 3,
    losses: 1,
    saves: 0,
    bf: Math.round(p.pitching!.outs * 1.5),
    outs: p.pitching!.outs,
    ip: p.pitching!.ip,
    pitches: p.pitching!.outs * 5,
    h: p.pitching!.h,
    hr: 1,
    r: p.pitching!.r,
    er: p.pitching!.er,
    bb: p.pitching!.bb,
    hbp: 0,
    k: p.pitching!.k,
    era: p.pitching!.era,
    whip: p.pitching!.whip,
    k9: Number(((p.pitching!.k * 9) / p.pitching!.ip).toFixed(2)),
    bb9: Number(((p.pitching!.bb * 9) / p.pitching!.ip).toFixed(2)),
    baa: 0.220,
    source: "manual",
    source_note: "Demo seed data",
    imported_at: new Date().toISOString(),
    imported_by: coachId,
  }));
  if (pitchingRows.length > 0) {
    const { error: pitErr } = await supabase
      .from("player_imported_pitching")
      .insert(pitchingRows);
    if (pitErr) return { data: null, error: `Pitching: ${pitErr.message}` };
  }

  // ── 7. Player notes (a few for AI context) ───────────────────
  const noteContents = [
    { player: ["Marcus", "Johnson"],   content: "Locked in this week — great BP, swing decisions are sharp." },
    { player: ["Jordan", "Kim"],       content: "Hamstring tight after Friday's game. Q for Tuesday." },
    { player: ["Alex", "Riggs"],       content: "Velo trending up — sat 87-89 in the bullpen yesterday." },
    { player: ["DeAndre", "Brooks"],   content: "Academic priority — leave by 5pm for tutoring." },
    { player: ["Tre", "Mbeki"],        content: "Pop time work paying off — 1.92 in tryouts." },
    { player: ["Noah", "Patel"],       content: "Wrist tight — limited swings until Wednesday." },
    { player: ["Ty", "Okafor"],        content: "Curveball coming around — start him Friday." },
    { player: ["Diego", "Alvarez"],    content: "Frosh catcher with a real arm. Watch his receiving." },
  ];
  const noteRows = noteContents.map((n) => ({
    program_id: programId,
    player_id: idFor(n.player[0], n.player[1]),
    coach_id: coachId,
    content: n.content,
    flag: null,
  }));
  await supabase.from("player_notes").insert(noteRows);

  // ── 8. Completed game with at-bat events (for box-score demo) ─
  // Use the first completed game (the +7 ago vs Oakridge).
  const oakridgeGame = (insertedGames ?? [])[0];
  let completedGameEventsInserted = 0;
  if (oakridgeGame) {
    // Start the sequence so log_at_bat allocates correctly. Best-effort
    // — if the RPC errors (e.g. game already in progress), continue.
    try {
      await supabase.rpc("start_live_scoring", { _game_id: oakridgeGame.id });
    } catch {
      // ignore
    }

    // Drive a small game via log_at_bat. 7-3 W; mix of singles/HR/K/BB/SAC.
    const johnson = idFor("Marcus", "Johnson");
    const kim     = idFor("Jordan", "Kim");
    const riggs   = idFor("Alex", "Riggs");
    const brooks  = idFor("DeAndre", "Brooks");
    const mbeki   = idFor("Tre", "Mbeki");
    const patel   = idFor("Noah", "Patel");
    const hale    = idFor("Sean", "Hale");
    const ruiz    = idFor("Omar", "Ruiz");

    // Compact scripted half-innings — every play resolves cleanly.
    type Play = {
      pid: string; outcome: string; outs: number; home: number; away: number;
      inning: number; half: "top" | "bottom"; pitcher?: string; runScorers?: string[];
      runners?: { 1: string | null; 2: string | null; 3: string | null };
    };
    const ourP1 = riggs;
    const plays: Play[] = [
      // Top 1 (Oakridge bats): three outs, no runs (use ad-hoc opposing batters via player names null)
      // Bot 1 (Us bats): Johnson 1B, Kim K, Riggs HR (2-run), Brooks GO, Mbeki K. 2-0
      { pid: johnson, outcome: "1B", outs: 0, home: 0, away: 0, inning: 1, half: "bottom", runners: { 1: johnson, 2: null, 3: null } },
      { pid: kim,     outcome: "K",  outs: 1, home: 0, away: 0, inning: 1, half: "bottom", runners: { 1: johnson, 2: null, 3: null } },
      { pid: riggs,   outcome: "HR", outs: 1, home: 2, away: 0, inning: 1, half: "bottom", runScorers: [johnson, riggs], runners: { 1: null, 2: null, 3: null } },
      { pid: brooks,  outcome: "GO", outs: 2, home: 2, away: 0, inning: 1, half: "bottom", runners: { 1: null, 2: null, 3: null } },
      { pid: mbeki,   outcome: "K",  outs: 3, home: 2, away: 0, inning: 1, half: "bottom", runners: { 1: null, 2: null, 3: null } },
      // Bot 3: Patel 2B, Hale BB, Ruiz 1B (Patel scores), Johnson SF (Hale scores). 4-1 going.
      { pid: patel,   outcome: "2B", outs: 0, home: 2, away: 1, inning: 3, half: "bottom", runners: { 1: null, 2: patel, 3: null } },
      { pid: hale,    outcome: "BB", outs: 0, home: 2, away: 1, inning: 3, half: "bottom", runners: { 1: hale, 2: patel, 3: null } },
      { pid: ruiz,    outcome: "1B", outs: 0, home: 3, away: 1, inning: 3, half: "bottom", runScorers: [patel], runners: { 1: ruiz, 2: hale, 3: null } },
      { pid: johnson, outcome: "SAC", outs: 1, home: 4, away: 1, inning: 3, half: "bottom", runScorers: [hale], runners: { 1: ruiz, 2: null, 3: null } },
      // Bot 5: Riggs 1B, Brooks 2B (Riggs scores). 5-2.
      { pid: riggs,   outcome: "1B", outs: 0, home: 4, away: 2, inning: 5, half: "bottom", runners: { 1: riggs, 2: null, 3: null } },
      { pid: brooks,  outcome: "2B", outs: 0, home: 5, away: 2, inning: 5, half: "bottom", runScorers: [riggs], runners: { 1: null, 2: brooks, 3: null } },
      // Bot 7: Johnson HR (solo), Patel 1B, Mbeki K. 7-3 final.
      { pid: johnson, outcome: "HR", outs: 0, home: 6, away: 3, inning: 7, half: "bottom", runScorers: [johnson], runners: { 1: null, 2: null, 3: null } },
      { pid: patel,   outcome: "1B", outs: 0, home: 7, away: 3, inning: 7, half: "bottom", runners: { 1: patel, 2: null, 3: null } },
    ];

    for (const p of plays) {
      const { data: eid } = await supabase.rpc("log_at_bat", {
        _game_id: oakridgeGame.id,
        _player_id: p.pid,
        _ad_hoc_name: null,
        _outcome: p.outcome,
        _rbi: 0,
        _inning: p.inning,
        _top_bottom: p.half,
        _outs_after: p.outs,
        _home_score: p.home,
        _away_score: p.away,
      });
      if (eid && (p.runners || p.runScorers)) {
        const merged: Record<string, unknown> = { outcome: p.outcome, rbi: 0 };
        if (p.runners) merged.runnersAfter = p.runners;
        if (p.runScorers) {
          merged.runScorers = p.runScorers;
          merged.runsOnPlay = p.runScorers.length;
        }
        merged.pitcherId = p.pitcher ?? ourP1;
        if (p.outcome === "SAC") merged.sacrificeType = "fly";
        await supabase.from("game_events").update({ payload: merged }).eq("id", eid as string);
      }
      completedGameEventsInserted += 1;
    }

    // Mark the game as final. Best-effort — same rationale as above.
    try {
      await supabase.rpc("end_live_game", { _game_id: oakridgeGame.id });
    } catch {
      // ignore
    }
  }

  return {
    data: {
      alreadySeeded: false,
      playersInserted: insertedPlayers?.length ?? 0,
      gamesInserted: insertedGames?.length ?? 0,
      practicesInserted: insertedPractices?.length ?? 0,
      practicePlanBlocksInserted,
      tryoutAttendees: attendeeRows.length,
      tryoutScoresInserted,
      battingRowsInserted: battingRows.length,
      pitchingRowsInserted: pitchingRows.length,
      notesInserted: noteRows.length,
      completedGameEventsInserted,
    },
    error: null,
  };
}
