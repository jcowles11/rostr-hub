/**
 * demoSeedService — Seeds a program with realistic baseball demo data.
 *
 * Creates players, roster assignments, games, practice plans, metrics,
 * tryout sessions, and evaluation scores so the product feels alive
 * during demos. Operates through the existing Supabase client and
 * respects RLS (requires authenticated coach).
 */
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";

// ── Demo roster data ───────────────────────────────────────────────

const VARSITY_PLAYERS = [
  { first_name: "Marcus", last_name: "Rivera", grade: 12, positions: ["SS", "2B"], player_number: 2, bats: "R", throws: "R" },
  { first_name: "Jake", last_name: "Thompson", grade: 12, positions: ["P", "1B"], player_number: 21, bats: "L", throws: "L" },
  { first_name: "Ethan", last_name: "Williams", grade: 11, positions: ["C"], player_number: 8, bats: "R", throws: "R" },
  { first_name: "Dylan", last_name: "Chen", grade: 12, positions: ["CF"], player_number: 7, bats: "L", throws: "L" },
  { first_name: "Caleb", last_name: "Johnson", grade: 11, positions: ["3B"], player_number: 15, bats: "R", throws: "R" },
  { first_name: "Ryan", last_name: "Martinez", grade: 12, positions: ["RF", "P"], player_number: 24, bats: "R", throws: "R" },
  { first_name: "Noah", last_name: "Davis", grade: 11, positions: ["LF"], player_number: 11, bats: "L", throws: "R" },
  { first_name: "Tyler", last_name: "Anderson", grade: 12, positions: ["1B", "DH"], player_number: 33, bats: "L", throws: "L" },
  { first_name: "Luke", last_name: "Wilson", grade: 11, positions: ["2B", "SS"], player_number: 4, bats: "S", throws: "R" },
  { first_name: "Braden", last_name: "Garcia", grade: 11, positions: ["P"], player_number: 18, bats: "R", throws: "R" },
  { first_name: "Mason", last_name: "Lee", grade: 12, positions: ["P", "CF"], player_number: 10, bats: "R", throws: "L" },
  { first_name: "Cole", last_name: "Taylor", grade: 11, positions: ["C", "3B"], player_number: 12, bats: "R", throws: "R" },
];

const JV_PLAYERS = [
  { first_name: "Aiden", last_name: "Brown", grade: 10, positions: ["SS"], player_number: 3, bats: "R", throws: "R" },
  { first_name: "Jackson", last_name: "Miller", grade: 10, positions: ["P", "OF"], player_number: 19, bats: "L", throws: "L" },
  { first_name: "Owen", last_name: "Moore", grade: 9, positions: ["C"], player_number: 22, bats: "R", throws: "R" },
  { first_name: "Liam", last_name: "Clark", grade: 10, positions: ["1B"], player_number: 34, bats: "L", throws: "L" },
  { first_name: "Carter", last_name: "Hall", grade: 9, positions: ["2B", "3B"], player_number: 6, bats: "R", throws: "R" },
  { first_name: "Hudson", last_name: "Allen", grade: 10, positions: ["CF", "LF"], player_number: 9, bats: "L", throws: "R" },
  { first_name: "Gavin", last_name: "Young", grade: 9, positions: ["RF"], player_number: 14, bats: "R", throws: "R" },
  { first_name: "Nathan", last_name: "King", grade: 10, positions: ["P", "SS"], player_number: 17, bats: "R", throws: "R" },
  { first_name: "Eli", last_name: "Wright", grade: 9, positions: ["3B", "LF"], player_number: 25, bats: "L", throws: "R" },
  { first_name: "Alex", last_name: "Scott", grade: 10, positions: ["OF"], player_number: 5, bats: "S", throws: "R" },
];

const UNASSIGNED_PLAYERS = [
  { first_name: "Chase", last_name: "Robinson", grade: 9, positions: ["P", "OF"], player_number: 30, bats: "R", throws: "R" },
  { first_name: "Drew", last_name: "Turner", grade: 9, positions: ["C", "1B"], player_number: 28, bats: "R", throws: "R" },
  { first_name: "Jace", last_name: "Phillips", grade: 10, positions: ["SS", "2B"], player_number: 16, bats: "L", throws: "R" },
];

// ── Game schedule data ─────────────────────────────────────────────

function generateGames(today: Date) {
  return [
    // Past games
    { offset: -10, name: "vs Lincoln High", opponent: "Lincoln High", level: "Varsity", time: "16:00", location: "Eagle Field", status: "completed" },
    { offset: -8, name: "vs Central Academy", opponent: "Central Academy", level: "JV", time: "16:30", location: "Central Park Diamond", status: "completed" },
    { offset: -5, name: "vs Riverside Prep", opponent: "Riverside Prep", level: "Varsity", time: "15:30", location: "Eagle Field", status: "completed" },
    { offset: -3, name: "vs North Valley", opponent: "North Valley", level: "JV", time: "16:00", location: "North Valley HS", status: "completed" },
    // Upcoming games
    { offset: 1, name: "vs Westlake High", opponent: "Westlake High", level: "Varsity", time: "16:00", location: "Eagle Field", status: "scheduled" },
    { offset: 3, name: "vs Summit Christian", opponent: "Summit Christian", level: "JV", time: "16:30", location: "Summit Field", status: "scheduled" },
    { offset: 5, name: "vs Mountain View", opponent: "Mountain View", level: "Varsity", time: "15:00", location: "Mountain View HS", status: "scheduled" },
    { offset: 7, name: "vs Heritage Academy", opponent: "Heritage Academy", level: "Varsity", time: "16:00", location: "Eagle Field", status: "scheduled" },
    { offset: 10, name: "vs Cedar Creek", opponent: "Cedar Creek", level: "JV", time: "16:00", location: "Cedar Creek Park", status: "scheduled" },
    { offset: 12, name: "vs Eastside Prep", opponent: "Eastside Prep", level: "Varsity", time: "15:30", location: "Eastside Athletic Complex", status: "scheduled" },
    { offset: 14, name: "at Lakewood High", opponent: "Lakewood High", level: "Varsity", time: "16:00", location: "Lakewood Stadium", status: "scheduled" },
  ].map((g) => ({
    ...g,
    game_date: format(addDays(today, g.offset), "yyyy-MM-dd"),
  }));
}

// ── Practice plans ─────────────────────────────────────────────────

function generatePractices(today: Date) {
  return [
    { offset: -1, title: "Pre-Game Warmup & Situational Hitting", level: "Varsity", start_time: "15:00", end_time: "17:00" },
    { offset: 0, title: "Defensive Fundamentals & Double Plays", level: "Varsity", start_time: "15:30", end_time: "17:30" },
    { offset: 2, title: "Batting Practice — Varsity", level: "Varsity", start_time: "15:00", end_time: "17:00" },
    { offset: 2, title: "Fielding Drills — JV", level: "JV", start_time: "15:00", end_time: "16:30" },
    { offset: 4, title: "Pitching Mechanics & Bullpen", level: "Varsity", start_time: "15:30", end_time: "17:00" },
    { offset: 4, title: "Base Running & Situational Play", level: "JV", start_time: "15:30", end_time: "16:30" },
    { offset: 6, title: "Full Team Scrimmage", level: "Varsity", start_time: "14:00", end_time: "16:30" },
    { offset: 9, title: "Outfield Communication & Relay Cuts", level: "Varsity", start_time: "15:00", end_time: "17:00" },
    { offset: 11, title: "Hitting Adjustments & Film Review", level: "Varsity", start_time: "15:30", end_time: "17:00" },
  ].map((p) => ({
    ...p,
    practice_date: format(addDays(today, p.offset), "yyyy-MM-dd"),
  }));
}

// ── Demo metrics (sport-agnostic architecture, baseball defaults) ──

const DEMO_METRICS = [
  { name: "60 Yard Dash", unit: "sec", category: "running", metric_type: "timed", aggregation: "best", max_attempts: 3, min_value: 5.5, max_value: 9.0, sort_order: 1 },
  { name: "Fastball Velo", unit: "mph", category: "pitching", metric_type: "measured", aggregation: "best", max_attempts: 5, min_value: 55, max_value: 98, sort_order: 2 },
  { name: "Exit Velocity", unit: "mph", category: "hitting", metric_type: "measured", aggregation: "best", max_attempts: 5, min_value: 55, max_value: 105, sort_order: 3 },
  { name: "Infield Velo", unit: "mph", category: "fielding", metric_type: "measured", aggregation: "best", max_attempts: 3, min_value: 55, max_value: 90, sort_order: 4 },
  { name: "Pop Time", unit: "sec", category: "fielding", metric_type: "timed", aggregation: "best", max_attempts: 3, min_value: 1.7, max_value: 2.8, sort_order: 5 },
  { name: "Fielding", unit: "/10", category: "fielding", metric_type: "rated", aggregation: "average", max_attempts: 1, min_value: 1, max_value: 10, sort_order: 6 },
  { name: "Hitting Mechanics", unit: "/10", category: "hitting", metric_type: "rated", aggregation: "average", max_attempts: 1, min_value: 1, max_value: 10, sort_order: 7 },
  { name: "Baseball IQ", unit: "/10", category: "other", metric_type: "rated", aggregation: "average", max_attempts: 1, min_value: 1, max_value: 10, sort_order: 8 },
];

// ── Helper: add minutes to "HH:MM" string ─────────────────────────

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ── Deterministic pseudo-random number generator (seed-based) ──────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate a realistic score for a player+metric combo.
 * Uses player tier (varsity/jv/unassigned) + a per-player variance seed
 * to produce believable, differentiated values.
 */
function generateScore(
  rand: () => number,
  metric: typeof DEMO_METRICS[0],
  tier: "varsity" | "jv" | "unassigned",
  playerAbility: number // 0..1 representing this player's relative talent
): number {
  const range = metric.max_value - metric.min_value;

  // Tier-based baseline (how far into the "good" end of the range)
  // For timed metrics, lower is better, so varsity baseline is lower
  let tierBaseline: number;
  if (metric.metric_type === "timed") {
    // Timed: varsity gets lower values (closer to min)
    tierBaseline = tier === "varsity" ? 0.15 : tier === "jv" ? 0.40 : 0.55;
  } else {
    // Measured/rated: varsity gets higher values (closer to max)
    tierBaseline = tier === "varsity" ? 0.70 : tier === "jv" ? 0.45 : 0.30;
  }

  // Player-specific offset within their tier (±0.15)
  const playerOffset = (playerAbility - 0.5) * 0.30;

  // Per-attempt noise (±0.06)
  const noise = (rand() - 0.5) * 0.12;

  let normalized = tierBaseline + playerOffset + noise;
  normalized = Math.max(0.02, Math.min(0.98, normalized));

  let value = metric.min_value + normalized * range;

  // Round appropriately
  if (metric.metric_type === "rated") {
    value = Math.round(value);
  } else if (metric.metric_type === "timed") {
    value = Math.round(value * 100) / 100; // 2 decimal places
  } else {
    value = Math.round(value * 10) / 10; // 1 decimal place
  }

  // Clamp
  value = Math.max(metric.min_value, Math.min(metric.max_value, value));

  return value;
}

// ── Demo tryout sessions ──────────────────────────────────────────

function generateSessions(today: Date) {
  return [
    { offset: -14, name: "Early Tryout — Day 1", notes: "First look at all candidates" },
    { offset: -11, name: "Early Tryout — Day 2", notes: "Speed and arm strength focus" },
    { offset: -7, name: "Mid-Season Evaluation", notes: "Full team assessment after first games" },
    { offset: -2, name: "Pre-Conference Checkup", notes: "Final rankings before conference play begins" },
  ].map((s) => ({
    ...s,
    session_date: format(addDays(today, s.offset), "yyyy-MM-dd"),
  }));
}

// ── Seeding function ───────────────────────────────────────────────

export async function seedDemoData(
  programId: string,
  coachId: string
): Promise<{
  success: boolean;
  error?: string;
  counts?: { players: number; games: number; practices: number; metrics: number; evaluations: number; sessions: number };
}> {
  const today = new Date();

  // Get auth user ID for tables that reference auth.users (e.g. practice_plans.created_by)
  const { data: { user } } = await supabase.auth.getUser();
  const authUserId = user?.id ?? null;

  try {
    // 1. Seed players
    const allPlayerData = [
      ...VARSITY_PLAYERS.map((p) => ({ ...p, _level: "Varsity" as const })),
      ...JV_PLAYERS.map((p) => ({ ...p, _level: "JV" as const })),
      ...UNASSIGNED_PLAYERS.map((p) => ({ ...p, _level: null as null })),
    ];

    const playerInserts = allPlayerData.map(({ _level, ...p }) => ({
      program_id: programId,
      first_name: p.first_name,
      last_name: p.last_name,
      grade: p.grade,
      positions: p.positions,
      player_number: p.player_number,
      bats: p.bats,
      throws: p.throws,
    }));

    const { data: insertedPlayers, error: playerErr } = await supabase
      .from("players")
      .insert(playerInserts)
      .select("id, first_name, last_name");

    if (playerErr) {
      return { success: false, error: `Failed to insert players: ${playerErr.message}` };
    }

    // 2. Create roster assignments
    const playerMap = new Map<string, string>();
    insertedPlayers?.forEach((p) => {
      playerMap.set(`${p.first_name} ${p.last_name}`, p.id);
    });
    const insertedPlayerIds = (insertedPlayers || []).map((p) => p.id);

    const assignmentInserts: Array<{
      program_id: string;
      player_id: string;
      assignment: string;
      assigned_by: string;
    }> = [];

    allPlayerData.forEach((p) => {
      if (p._level) {
        const playerId = playerMap.get(`${p.first_name} ${p.last_name}`);
        if (playerId) {
          assignmentInserts.push({
            program_id: programId,
            player_id: playerId,
            assignment: p._level,
            assigned_by: coachId,
          });
        }
      }
    });

    if (assignmentInserts.length > 0) {
      const { error: assignErr } = await supabase
        .from("roster_assignments")
        .insert(assignmentInserts);
      if (assignErr) {
        console.warn("Assignment insert warning:", assignErr.message);
      }
    }

    // 3. Seed games
    const gameData = generateGames(today);
    const gameInserts = gameData.map((g) => ({
      program_id: programId,
      name: g.name,
      opponent: g.opponent,
      team_level: g.level,
      game_date: g.game_date,
      game_time: g.time,
      location: g.location,
      status: g.status,
      created_by: coachId,
    }));

    const { data: insertedGames, error: gameErr } = await supabase.from("games").insert(gameInserts).select("id, team_level, status");
    if (gameErr) {
      console.warn("Game insert warning:", gameErr.message);
    }

    // 3b. Seed game rosters + lineups for all games (completed + upcoming)
    const BASEBALL_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
    if (insertedGames && insertedGames.length > 0 && insertedPlayerIds.length > 0) {
      const lineupRand = seededRandom(99); // separate seed for lineup determinism
      const gameRosterInserts: Array<{ game_id: string; player_id: string; status: string }> = [];
      const lineupInserts: Array<{ game_id: string; player_id: string; batting_order: number; position: string }> = [];

      for (const game of insertedGames) {
        const level = (game.team_level || "").toLowerCase();
        // Pick players matching this game's level
        const pool = level === "jv"
          ? insertedPlayerIds.slice(VARSITY_PLAYERS.length, VARSITY_PLAYERS.length + JV_PLAYERS.length)
          : insertedPlayerIds.slice(0, VARSITY_PLAYERS.length);

        // Shuffle pool deterministically then take 9
        const shuffled = [...pool].sort(() => lineupRand() - 0.5);
        const rosterPlayers = shuffled.slice(0, Math.min(9, shuffled.length));

        rosterPlayers.forEach((pid, idx) => {
          gameRosterInserts.push({
            game_id: game.id,
            player_id: pid,
            status: "active",
          });
          lineupInserts.push({
            game_id: game.id,
            player_id: pid,
            batting_order: idx + 1,
            position: BASEBALL_POSITIONS[idx % BASEBALL_POSITIONS.length],
          });
        });
      }

      if (gameRosterInserts.length > 0) {
        const { error: grErr } = await supabase.from("game_rosters").upsert(gameRosterInserts, { onConflict: "game_id,player_id" });
        if (grErr) console.warn("Game roster insert warning:", grErr.message);
      }
      if (lineupInserts.length > 0) {
        const { error: liErr } = await supabase.from("lineup_entries").insert(lineupInserts);
        if (liErr) console.warn("Lineup insert warning:", liErr.message);
      }
    }

    // 4. Seed practice plans
    const practiceData = generatePractices(today);
    const practiceInserts = practiceData.map((p) => ({
      program_id: programId,
      title: p.title,
      team_level: p.level,
      practice_date: p.practice_date,
      notes: `${p.start_time} – ${p.end_time}`,
      shared_with_players: false,
      created_by: authUserId,
    }));

    const { data: insertedPlans, error: practiceErr } = await supabase
      .from("practice_plans")
      .insert(practiceInserts)
      .select("id");
    if (practiceErr) {
      console.warn("Practice insert warning:", practiceErr.message);
    }

    // Seed practice blocks for each plan
    if (insertedPlans && insertedPlans.length > 0) {
      const blockInserts: Array<{
        practice_plan_id: string;
        start_time: string;
        end_time: string;
        activity_name: string;
        player_group: string | null;
        sort_order: number;
      }> = [];

      insertedPlans.forEach((plan, idx) => {
        const p = practiceData[idx];
        if (!p) return;
        // Generate 3-4 blocks per practice
        const blocks = [
          { start: p.start_time, activity: "Warm-up & Stretching", group: null },
          { start: addMinutes(p.start_time, 20), activity: p.title.split(" — ")[0] || p.title, group: p.level },
          { start: addMinutes(p.start_time, 60), activity: "Live Reps / Scrimmage", group: null },
          { start: addMinutes(p.start_time, 90), activity: "Cool Down & Review", group: null },
        ];
        blocks.forEach((b, bIdx) => {
          blockInserts.push({
            practice_plan_id: plan.id,
            start_time: b.start,
            end_time: blocks[bIdx + 1]?.start || p.end_time,
            activity_name: b.activity,
            player_group: b.group,
            sort_order: bIdx,
          });
        });
      });

      if (blockInserts.length > 0) {
        const { error: blockErr } = await supabase.from("practice_blocks").insert(blockInserts);
        if (blockErr) console.warn("Practice block insert warning:", blockErr.message);
      }
    }

    // 5. Seed metrics (skip if metrics already exist for this program)
    const { data: existingMetrics } = await supabase
      .from("metrics")
      .select("id")
      .eq("program_id", programId)
      .limit(1);

    let metricIds: string[] = [];
    if (!existingMetrics || existingMetrics.length === 0) {
      const metricInserts = DEMO_METRICS.map((m) => ({
        program_id: programId,
        name: m.name,
        unit: m.unit,
        category: m.category,
        metric_type: m.metric_type,
        aggregation: m.aggregation,
        max_attempts: m.max_attempts,
        min_value: m.min_value,
        max_value: m.max_value,
        sort_order: m.sort_order,
      }));

      const { data: insertedMetrics, error: metricErr } = await supabase
        .from("metrics")
        .insert(metricInserts)
        .select("id");

      if (metricErr) {
        console.warn("Metric insert warning:", metricErr.message);
      } else {
        metricIds = (insertedMetrics || []).map((m) => m.id);
      }
    } else {
      // Use existing metrics
      const { data: allMetrics } = await supabase
        .from("metrics")
        .select("id")
        .eq("program_id", programId)
        .order("sort_order");
      metricIds = (allMetrics || []).map((m) => m.id);
    }

    // 6. Seed tryout sessions
    const sessionData = generateSessions(today);
    const sessionInserts = sessionData.map((s) => ({
      program_id: programId,
      name: s.name,
      session_date: s.session_date,
      notes: s.notes,
    }));

    const { data: insertedSessions, error: sessionErr } = await supabase
      .from("tryout_sessions")
      .insert(sessionInserts)
      .select("id");

    if (sessionErr) {
      console.warn("Session insert warning:", sessionErr.message);
    }

    const sessionIds = (insertedSessions || []).map((s) => s.id);

    // 7. Seed evaluations — realistic scores for all assigned players
    let evalCount = 0;
    if (metricIds.length > 0 && sessionIds.length > 0) {
      const rand = seededRandom(42);
      const evalInserts: Array<{
        program_id: string;
        player_id: string;
        metric_id: string;
        coach_id: string;
        session_id: string;
        attempt_number: number;
        value: number;
      }> = [];

      // Build a list of players with their tier info
      const playerEntries = allPlayerData
        .map((p, idx) => ({
          id: playerMap.get(`${p.first_name} ${p.last_name}`),
          tier: (p._level === "Varsity" ? "varsity" : p._level === "JV" ? "jv" : "unassigned") as "varsity" | "jv" | "unassigned",
          ability: rand(), // each player gets a fixed ability seed
          positions: p.positions,
          index: idx,
        }))
        .filter((p) => p.id);

      // Position-relevance boosts: players score higher on metrics
      // that match their position, creating realistic data patterns
      function positionBoost(positions: string[], metricName: string): number {
        const pos = positions.map((p) => p.toUpperCase());
        if (metricName === "Fastball Velo" && pos.some((p) => p === "P")) return 0.12;
        if (metricName === "Pop Time" && pos.some((p) => p === "C")) return 0.10;
        if (metricName === "Exit Velocity" && pos.some((p) => ["1B", "DH", "3B", "LF", "RF"].includes(p))) return 0.08;
        if (metricName === "Infield Velo" && pos.some((p) => ["SS", "3B", "2B"].includes(p))) return 0.08;
        if (metricName === "60 Yard Dash" && pos.some((p) => ["CF", "LF", "RF", "OF", "SS"].includes(p))) return -0.06; // lower = faster
        if (metricName === "Fielding" && pos.some((p) => ["SS", "2B", "C", "CF"].includes(p))) return 0.08;
        return 0;
      }

      // For each player, generate scores across sessions and metrics
      for (const player of playerEntries) {
        if (!player.id) continue;

        // Determine which metrics this player gets scored on
        // Most players get most metrics; some only get a subset for realism
        // Position-specific: catchers always get Pop Time, pitchers always get Velo
        const metricCoverage = player.tier === "unassigned" ? 0.5 : 0.85;

        for (let mi = 0; mi < metricIds.length; mi++) {
          const metricDef = DEMO_METRICS[mi] || DEMO_METRICS[0];

          // Always include position-relevant metrics
          const boost = positionBoost(player.positions, metricDef.name);
          const isPositionMetric = Math.abs(boost) > 0;

          // Skip some metrics randomly for realism (but keep position-relevant ones)
          if (!isPositionMetric && rand() > metricCoverage) continue;

          // Score in 2-3 sessions for this metric (more sessions = more data)
          // Position-relevant metrics get scored in more sessions
          const numSessions = player.tier === "unassigned"
            ? (rand() > 0.5 ? 1 : 2)
            : isPositionMetric
              ? Math.min(3, sessionIds.length)
              : (rand() > 0.3 ? Math.min(3, sessionIds.length) : 2);

          for (let si = 0; si < numSessions && si < sessionIds.length; si++) {
            // 1-3 attempts per session depending on metric
            const attempts = metricDef.max_attempts > 1
              ? Math.min(metricDef.max_attempts, Math.ceil(rand() * 3))
              : 1;

            for (let attempt = 1; attempt <= attempts; attempt++) {
              // Apply position boost to effective ability
              const effectiveAbility = Math.max(0, Math.min(1, player.ability + boost));
              const value = generateScore(rand, metricDef, player.tier, effectiveAbility);
              evalInserts.push({
                program_id: programId,
                player_id: player.id,
                metric_id: metricIds[mi],
                coach_id: coachId,
                session_id: sessionIds[si],
                attempt_number: attempt,
                value,
              });
            }
          }
        }
      }

      // Insert evaluations in chunks of 500
      for (let i = 0; i < evalInserts.length; i += 500) {
        const chunk = evalInserts.slice(i, i + 500);
        const { error: evalErr } = await supabase.from("evaluations").insert(chunk);
        if (evalErr) {
          console.warn(`Evaluation insert warning (chunk ${i}):`, evalErr.message);
        } else {
          evalCount += chunk.length;
        }
      }
    }

    return {
      success: true,
      counts: {
        players: allPlayerData.length,
        games: gameData.length,
        practices: practiceData.length,
        metrics: metricIds.length,
        evaluations: evalCount,
        sessions: sessionIds.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Unexpected error" };
  }
}
