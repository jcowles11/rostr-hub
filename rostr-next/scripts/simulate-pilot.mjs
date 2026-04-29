// @ts-check
/**
 * simulate-pilot.mjs
 *
 * Seeds a complete "real coach" pilot scenario into the live Supabase
 * project so we can pressure-test the app end-to-end without clicking
 * through every flow manually.
 *
 * What it creates:
 *   1. A test auth user (coach@rostr.test / rostrpilot123!)
 *   2. An organization + program with 4 custom team levels
 *      (Varsity, JV, Sophomore, Freshman)
 *   3. 60 mock players with realistic HS baseball attributes
 *   4. A tryout with 5 stations (60yd, EV, Velo, Fielding, BP)
 *   5. All 60 players registered as attendees
 *   6. ~290 mock scores (60 players × 5 stations, minus some intentional
 *      gaps so we test "not yet scored" rendering)
 *   7. Verdicts placing players on the 4 teams (ranked by overall score)
 *   8. A season of games + practices across all 4 team levels
 *   9. Game rosters + lineups for the first game on each team
 *
 * Run: node scripts/simulate-pilot.mjs
 *
 * Idempotency: safe to re-run. If the test coach + program already exist,
 * the script wipes their players, games, etc. and re-seeds from scratch.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3MTU5OCwiZXhwIjoyMDg5MjQ3NTk4fQ.rs0aiShj2COBIcn484pJsRO4Hphr9PX2QTV3gpxVNZI";

const TEST_EMAIL = "coach@rostr.test";
const TEST_PASSWORD = "rostrpilot123!";
const ORG_NAME = "Lincoln High School";
const PROGRAM_NAME = "Lincoln Baseball";
const LEVELS = ["Varsity", "JV", "Sophomore", "Freshman"];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Player data ────────────────────────────────────────────────

const FIRST_NAMES = [
  "Marcus", "Carlos", "Alex", "Jordan", "DeAndre", "Tre", "Noah", "Ethan",
  "Mason", "Logan", "Lucas", "Jackson", "Aiden", "Caleb", "Ryan", "Tyler",
  "Nathan", "Isaac", "Jayden", "Dylan", "Elijah", "Cameron", "Hunter", "Wyatt",
  "Owen", "Blake", "Connor", "Cole", "Brandon", "Trevor", "Chase", "Grant",
  "Parker", "Kyle", "Austin", "Derek", "Devin", "Xavier", "Malik", "Antonio",
  "Miguel", "Diego", "Javier", "Andre", "Joaquin", "Kai", "Luis", "Julian",
  "Sebastian", "Gabriel", "Mateo", "Rafael", "Adrian", "Elias", "Jonah",
  "Micah", "Silas", "Levi", "Asher", "Isaiah",
];

const LAST_NAMES = [
  "Johnson", "Smith", "Peña", "Rivera", "Brooks", "Mbeki", "Patel", "Riggs",
  "Kim", "Park", "Chen", "Nguyen", "Garcia", "Rodriguez", "Martinez", "Lopez",
  "Gonzalez", "Sanchez", "Reyes", "Flores", "Walker", "Hill", "Scott", "Green",
  "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Turner", "Phillips",
  "Campbell", "Evans", "Edwards", "Collins", "Stewart", "Morris", "Murphy",
  "Cook", "Rogers", "Morgan", "Peterson", "Cooper", "Reed", "Bailey", "Bell",
  "Kelly", "Howard", "Ward", "Cox", "Ramirez", "Torres", "Brown", "Davis",
  "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas",
];

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

// Realistic grade distribution for a 60-kid program
// Fr (9th): 18, So (10th): 18, Jr (11th): 14, Sr (12th): 10
const GRADE_DISTRIBUTION = [
  ...Array(18).fill(9),
  ...Array(18).fill(10),
  ...Array(14).fill(11),
  ...Array(10).fill(12),
];

const STATIONS = [
  {
    name: "60-yard dash",
    short_code: "60yd",
    unit: "s",
    score_type: "lower_better",
    sort_order: 1,
    generateScore: (grade) => {
      // Seniors faster than freshmen on average
      const base = 8.2 - (grade - 9) * 0.25;
      return round(base + randNormal(0, 0.35), 2);
    },
  },
  {
    name: "Exit velocity",
    short_code: "EV",
    unit: "mph",
    score_type: "higher_better",
    sort_order: 2,
    generateScore: (grade) => {
      const base = 70 + (grade - 9) * 4;
      return round(base + randNormal(0, 6), 1);
    },
  },
  {
    name: "Pitching velocity",
    short_code: "Velo",
    unit: "mph",
    score_type: "higher_better",
    sort_order: 3,
    generateScore: (grade, positions) => {
      // Only pitchers get a velo score; everyone else is skipped
      if (!positions.includes("P")) return null;
      const base = 68 + (grade - 9) * 3.5;
      return round(base + randNormal(0, 4), 1);
    },
  },
  {
    name: "Fielding · IF",
    short_code: "Field",
    unit: null,
    score_type: "rating",
    sort_order: 4,
    generateScore: () => {
      // 1-5 rating, centered around 3.2 with some spread
      const val = clamp(Math.round(randNormal(3.2, 0.9)), 1, 5);
      return val;
    },
  },
  {
    name: "Batting practice",
    short_code: "BP",
    unit: null,
    score_type: "rating",
    sort_order: 5,
    generateScore: (grade) => {
      // Older players rate slightly higher
      const base = 2.8 + (grade - 9) * 0.15;
      const val = clamp(Math.round(randNormal(base, 0.9)), 1, 5);
      return val;
    },
  },
];

// ── Utilities ──────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function round(n, decimals = 1) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function randNormal(mean = 0, stdev = 1) {
  // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + stdev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function fail(msg, err) {
  console.error(`❌ ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}
function log(...args) {
  console.log(...args);
}

// ── Steps ──────────────────────────────────────────────────────

async function resolveOrCreateAuthUser() {
  log("→ Ensuring test auth user exists…");
  const { data: existing } = await supabase.auth.admin.listUsers();
  let user = existing?.users?.find((u) => u.email === TEST_EMAIL);
  if (user) {
    log(`  ✓ User exists: ${user.id}`);
    return user;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Coach Ruiz", role: "coach" },
  });
  if (error || !data?.user) fail("Couldn't create test user", error);
  log(`  ✓ Created user: ${data.user.id}`);
  return data.user;
}

async function wipeExistingProgramData(user) {
  log("→ Wiping any existing data for the test coach…");
  const { data: coaches } = await supabase
    .from("coaches")
    .select("id, program_id")
    .eq("user_id", user.id);

  if (!coaches || coaches.length === 0) {
    log("  (nothing to wipe)");
    return;
  }

  const programIds = [...new Set(coaches.map((c) => c.program_id))];

  // Cascades handle most of it — delete programs and rely on FK cascades.
  // First blow away any orgs that own these programs, and their programs.
  const { data: programs } = await supabase
    .from("programs")
    .select("id, organization_id")
    .in("id", programIds);
  const orgIds = [...new Set((programs ?? []).map((p) => p.organization_id).filter(Boolean))];

  for (const pid of programIds) {
    await supabase.from("players").delete().eq("program_id", pid);
    await supabase.from("tryouts").delete().eq("program_id", pid);
    await supabase.from("games").delete().eq("program_id", pid);
    await supabase.from("practice_plans").delete().eq("program_id", pid);
    await supabase.from("roster_assignments").delete().eq("program_id", pid);
    await supabase.from("organization_members").delete().eq("program_id", pid);
    await supabase.from("coaches").delete().eq("program_id", pid);
    await supabase.from("programs").delete().eq("id", pid);
  }
  for (const oid of orgIds) {
    await supabase.from("organizations").delete().eq("id", oid);
  }
  log(`  ✓ Wiped ${programIds.length} program(s)`);
}

async function createOrgAndProgram(user) {
  log("→ Creating org + program with 4 levels…");
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name: ORG_NAME, created_by: user.id })
    .select("id")
    .single();
  if (orgErr) fail("org insert failed", orgErr);

  const { data: program, error: progErr } = await supabase
    .from("programs")
    .insert({
      name: PROGRAM_NAME,
      school_name: ORG_NAME,
      created_by: user.id,
      sport: "Baseball",
      organization_id: org.id,
      levels: LEVELS,
    })
    .select("id")
    .single();
  if (progErr) fail("program insert failed", progErr);

  // Organization member — links the auth user to the org with program scope.
  // NOTE: role here uses the app_role enum (admin | coach), NOT the
  // coach_role enum (head_coach | assistant_coach). Program creator = admin.
  const { error: memberErr } = await supabase
    .from("organization_members")
    .insert({
      user_id: user.id,
      organization_id: org.id,
      program_id: program.id,
      role: "admin",
      full_name: "Coach Ruiz",
      email: user.email,
      color: "#c83a3a",
    });
  if (memberErr) fail("organization_members insert failed", memberErr);

  const { data: coach, error: coachErr } = await supabase
    .from("coaches")
    .insert({
      user_id: user.id,
      program_id: program.id,
      full_name: "Coach Ruiz",
      email: user.email,
      role: "head_coach",
      color: "#c83a3a",
    })
    .select("id")
    .single();
  if (coachErr) fail("coach insert failed", coachErr);

  log(`  ✓ Org ${org.id}, Program ${program.id}, Coach ${coach.id}`);
  return { orgId: org.id, programId: program.id, coachId: coach.id };
}

async function createPlayers(programId) {
  log("→ Creating 60 players…");
  const usedJerseys = new Set();
  const players = [];
  for (let i = 0; i < 60; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const grade = GRADE_DISTRIBUTION[i];
    // 1–3 positions, weighted by frequency
    const posCount = 1 + (Math.random() < 0.4 ? 1 : 0);
    const positions = shuffle(POSITIONS).slice(0, posCount);
    // Ensure ~20% of players are pitchers
    if (Math.random() < 0.20 && !positions.includes("P")) positions.unshift("P");

    let jersey;
    do {
      jersey = 1 + Math.floor(Math.random() * 99);
    } while (usedJerseys.has(jersey));
    usedJerseys.add(jersey);

    const handle = `${slugify(firstName + "_" + lastName)}_${jersey}`;
    players.push({
      program_id: programId,
      first_name: firstName,
      last_name: lastName,
      grade,
      positions,
      player_number: jersey,
      bats: pick(["L", "R", "R", "R", "S"]),
      throws: pick(["L", "R", "R", "R"]),
      profile_slug: handle,
      profile_public: true,
    });
  }

  const { data, error } = await supabase
    .from("players")
    .insert(players)
    .select("id, first_name, last_name, grade, positions, player_number");
  if (error) fail("player insert failed", error);
  log(`  ✓ Inserted ${data.length} players`);
  return data;
}

async function createTryoutAndStations(programId, coachId, userId) {
  log("→ Creating tryout + 5 stations…");
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(today.getDate() + 2);

  const { data: tryout, error: tErr } = await supabase
    .from("tryouts")
    .insert({
      program_id: programId,
      name: "Spring Tryout 2026",
      start_date: today.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      status: "live",
      varsity_target: 16,
      jv_target: 16,
      notes: "Full 3-day tryout — combine measurables + live play.",
      created_by: userId,
    })
    .select("id")
    .single();
  if (tErr) fail("tryout insert failed", tErr);

  const { data: stations, error: sErr } = await supabase
    .from("tryout_stations")
    .insert(
      STATIONS.map((s) => ({
        tryout_id: tryout.id,
        name: s.name,
        short_code: s.short_code,
        unit: s.unit,
        score_type: s.score_type,
        sort_order: s.sort_order,
        assigned_coach_id: coachId,
        status: "active",
      })),
    )
    .select("id, short_code, score_type");
  if (sErr) fail("stations insert failed", sErr);

  log(`  ✓ Tryout ${tryout.id}, ${stations.length} stations`);
  return { tryoutId: tryout.id, stations };
}

async function registerAttendeesAndScore(tryoutId, stations, players, coachId) {
  log("→ Registering all 60 players as attendees…");
  const { error: aErr } = await supabase.from("tryout_attendees").insert(
    players.map((p) => ({
      tryout_id: tryoutId,
      player_id: p.id,
      attended: true,
    })),
  );
  if (aErr) fail("attendees insert failed", aErr);
  log(`  ✓ ${players.length} attendees registered`);

  log("→ Generating tryout scores (with realistic noise)…");
  const scoreRows = [];
  for (const player of players) {
    for (const stationMeta of STATIONS) {
      const dbStation = stations.find((s) => s.short_code === stationMeta.short_code);
      if (!dbStation) continue;
      // Skip ~5% of scores to simulate "hasn't been measured yet"
      if (Math.random() < 0.05) continue;
      const value = stationMeta.generateScore(player.grade, player.positions);
      if (value == null) continue;
      // Flag ~10% as standout / attention
      let flag = null;
      const roll = Math.random();
      if (roll < 0.05) flag = "standout";
      else if (roll < 0.08) flag = "attention";
      scoreRows.push({
        tryout_id: tryoutId,
        station_id: dbStation.id,
        player_id: player.id,
        value,
        flag,
        scored_by: coachId,
      });
    }
  }

  // Batch inserts (Postgrest default limit is ~1000, but insert in chunks of 100)
  const CHUNK = 100;
  for (let i = 0; i < scoreRows.length; i += CHUNK) {
    const chunk = scoreRows.slice(i, i + CHUNK);
    const { error } = await supabase.from("tryout_scores").insert(chunk);
    if (error) fail(`score chunk insert failed (offset ${i})`, error);
  }
  log(`  ✓ Inserted ${scoreRows.length} scores`);
  return scoreRows;
}

async function applyVerdictsByRanking(tryoutId, players, stations, scoreRows, coachId, programId) {
  log("→ Computing rankings and applying verdicts…");
  // Compute best score per player per station
  const bestByPlayer = new Map();
  for (const s of scoreRows) {
    const key = `${s.player_id}:${s.station_id}`;
    const meta = stations.find((st) => st.id === s.station_id);
    const existing = bestByPlayer.get(key);
    if (
      existing == null ||
      (meta?.score_type === "lower_better" ? s.value < existing : s.value > existing)
    ) {
      bestByPlayer.set(key, s.value);
    }
  }
  // Per-station min/max
  const stationStats = new Map();
  for (const st of stations) {
    const vals = players
      .map((p) => bestByPlayer.get(`${p.id}:${st.id}`))
      .filter((v) => v != null);
    if (vals.length === 0) continue;
    stationStats.set(st.id, {
      min: Math.min(...vals),
      max: Math.max(...vals),
      scoreType: st.score_type,
    });
  }
  // Overall score = average normalized 0-100 per station
  const ranked = players
    .map((p) => {
      let sum = 0;
      let cnt = 0;
      for (const st of stations) {
        const v = bestByPlayer.get(`${p.id}:${st.id}`);
        const stats = stationStats.get(st.id);
        if (v == null || !stats) continue;
        const span = stats.max - stats.min;
        if (span === 0) {
          sum += 100;
        } else if (stats.scoreType === "lower_better") {
          sum += ((stats.max - v) / span) * 100;
        } else {
          sum += ((v - stats.min) / span) * 100;
        }
        cnt++;
      }
      return { player: p, overall: cnt > 0 ? sum / cnt : 0 };
    })
    .sort((a, b) => b.overall - a.overall);

  // Assign verdicts by rank & grade heuristic:
  //   top 16 → Varsity
  //   next 16 → JV
  //   next 14 → Sophomore
  //   next 14 → Freshman
  // Override: any 9th grader ranking above #40 gets demoted to Sophomore or Freshman
  // (prevents freshmen from making varsity by accident)
  const verdicts = [];
  ranked.forEach(({ player }, idx) => {
    let verdict;
    if (idx < 16) {
      verdict = "varsity";
      if (player.grade <= 10) verdict = "jv"; // No freshmen/sophomores on varsity
    } else if (idx < 32) {
      verdict = "jv";
      if (player.grade === 9) verdict = "sophomore";
    } else if (idx < 46) {
      verdict = "sophomore";
      if (player.grade === 9) verdict = "freshman";
    } else {
      verdict = "freshman";
    }
    // First ranked player is a lock
    if (idx === 0) verdict = "lock";
    verdicts.push({
      tryout_id: tryoutId,
      player_id: player.id,
      attended: true,
      verdict,
      decided_by: coachId,
      decided_at: new Date().toISOString(),
    });
  });

  // Upsert all
  const { error } = await supabase
    .from("tryout_attendees")
    .upsert(verdicts, { onConflict: "tryout_id,player_id" });
  if (error) fail("verdict upsert failed", error);
  log(`  ✓ Applied ${verdicts.length} verdicts`);

  // Push to roster_assignments
  log("→ Applying verdicts to roster_assignments…");
  const topLevel = LEVELS[0].toLowerCase();
  const rosterUpserts = verdicts
    .map((v) => {
      const lower = v.verdict.toLowerCase();
      let assignment;
      if (lower === "cut") assignment = "cut";
      else if (lower === "bubble") assignment = null;
      else if (lower === "lock") assignment = topLevel;
      else assignment = lower;
      if (!assignment) return null;
      return {
        player_id: v.player_id,
        program_id: programId,
        assignment,
        assigned_by: coachId,
      };
    })
    .filter(Boolean);

  // roster_assignments has UNIQUE(player_id). Conflict target is single column.
  const { error: rErr } = await supabase
    .from("roster_assignments")
    .upsert(rosterUpserts, { onConflict: "player_id" });
  if (rErr) fail("roster assignment upsert failed", rErr);
  log(`  ✓ ${rosterUpserts.length} roster assignments written`);
  return ranked;
}

async function createSchedule(programId, userId, coachId, players) {
  log("→ Creating season schedule (games + practices across all 4 levels)…");
  const opponents = [
    "Central Hawks", "Eastside Eagles", "Westview Wildcats", "Ridgewood Prep",
    "Northgate Nationals", "Southlake Stars", "Oakridge Oaks", "Riverside Rams",
    "Brookfield Bears", "Lakeshore Lions", "Pinecrest Panthers", "Summit Sharks",
  ];
  const locations = [
    "Home Field", "Central Park Diamond", "Eastside HS",
    "Westview Complex", "Ridgewood Park", "Home Field",
  ];

  const games = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7); // Season starts 1 week out

  // Varsity: 20 games, JV: 18, Sophomore: 16, Freshman: 14
  const plan = [
    { level: "Varsity", count: 20 },
    { level: "JV", count: 18 },
    { level: "Sophomore", count: 16 },
    { level: "Freshman", count: 14 },
  ];

  for (const { level, count } of plan) {
    for (let i = 0; i < count; i++) {
      const gameDate = new Date(startDate);
      gameDate.setDate(gameDate.getDate() + i * 3 + (level === "JV" ? 1 : level === "Sophomore" ? 0 : level === "Freshman" ? 2 : 0));
      const opp = opponents[i % opponents.length];
      const home = Math.random() < 0.55;
      games.push({
        program_id: programId,
        name: `vs ${opp}`,
        opponent: opp,
        game_date: gameDate.toISOString().slice(0, 10),
        game_time: pick(["15:30", "16:00", "17:00", "19:00"]),
        location: home ? "Home Field" : pick(locations),
        home_away: home ? "home" : "away",
        team_level: level,
        status: "scheduled",
        // games.created_by references coaches(id), NOT auth.users(id).
        created_by: coachId,
      });
    }
  }

  const { data: gameRows, error: gErr } = await supabase
    .from("games")
    .insert(games)
    .select("id, team_level, game_date");
  if (gErr) fail("games insert failed", gErr);
  log(`  ✓ ${gameRows.length} games created`);

  // Practices: 3 per week for 8 weeks across the whole program (not per team)
  const practices = [];
  for (let week = 0; week < 8; week++) {
    for (const dayOffset of [0, 2, 4]) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + week * 7 + dayOffset);
      practices.push({
        program_id: programId,
        practice_date: d.toISOString().slice(0, 10),
        team_level: pick(LEVELS),
        title: pick([
          "Live BP + defense",
          "Situational hitting",
          "Bullpen + fielding",
          "Base running + cutoffs",
          "Team scrimmage",
          "Strength & conditioning",
        ]),
        notes: null,
        shared_with_players: false,
        created_by: userId,
      });
    }
  }
  const { data: practiceRows, error: pErr } = await supabase
    .from("practice_plans")
    .insert(practices)
    .select("id, practice_date, team_level");
  if (pErr) fail("practices insert failed", pErr);
  log(`  ✓ ${practiceRows.length} practices created`);

  return { games: gameRows, practices: practiceRows };
}

async function populateRostersAndLineups(gameRows, players) {
  log("→ Building game rosters + lineups for the first game on each level…");
  // Players grouped by team via roster_assignments. Re-fetch to get latest.
  const { data: assignments } = await supabase
    .from("roster_assignments")
    .select("player_id, assignment");
  const playerToTeam = new Map();
  for (const a of assignments ?? []) {
    playerToTeam.set(a.player_id, a.assignment);
  }

  const playersByLevel = { Varsity: [], JV: [], Sophomore: [], Freshman: [] };
  for (const p of players) {
    const team = playerToTeam.get(p.id);
    if (!team || team === "cut") continue;
    const levelName = LEVELS.find((l) => l.toLowerCase() === team);
    if (levelName) playersByLevel[levelName].push(p);
  }

  const firstGamePerLevel = {};
  const sortedGames = [...gameRows].sort(
    (a, b) => a.game_date.localeCompare(b.game_date),
  );
  for (const g of sortedGames) {
    if (!firstGamePerLevel[g.team_level]) firstGamePerLevel[g.team_level] = g.id;
  }

  let rosterCount = 0;
  let lineupCount = 0;
  for (const level of LEVELS) {
    const gid = firstGamePerLevel[level];
    const roster = playersByLevel[level];
    if (!gid || !roster || roster.length === 0) continue;

    await supabase.from("game_rosters").insert(
      roster.map((p) => ({ game_id: gid, player_id: p.id, status: "active" })),
    );
    rosterCount += roster.length;

    // Lineup = top 9 by grade (seniors first), rotating through positions 1-9
    const batting = [...roster]
      .sort((a, b) => b.grade - a.grade)
      .slice(0, 9);
    const defaultPositions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
    await supabase.from("lineup_entries").insert(
      batting.map((p, i) => ({
        game_id: gid,
        player_id: p.id,
        batting_order: i + 1,
        position: defaultPositions[i],
      })),
    );
    lineupCount += 9;
  }
  log(`  ✓ ${rosterCount} roster entries + ${lineupCount} lineup slots`);
}

async function summarize(programId) {
  const counts = {};
  for (const table of [
    "players",
    "tryouts",
    "tryout_stations",
    "tryout_attendees",
    "tryout_scores",
    "roster_assignments",
    "games",
    "game_rosters",
    "lineup_entries",
    "practice_plans",
  ]) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(table === "tryout_scores" || table === "tryout_attendees" || table === "tryout_stations" ? "tryout_id" : table.startsWith("game_") || table === "lineup_entries" ? "game_id" : "program_id", null)
      .neq("id", "00000000-0000-0000-0000-000000000000")
      .limit(1);
    counts[table] = count ?? "?";
  }
  // Simpler: just count what belongs to this program transitively
  const { count: playerCount } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId);
  const { count: gameCount } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId);
  const { count: assignCount } = await supabase
    .from("roster_assignments")
    .select("player_id", { count: "exact", head: true })
    .eq("program_id", programId);
  const { count: tryoutCount } = await supabase
    .from("tryouts")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId);

  log("\n── Summary ──────────────────────────────────");
  log(`  Players:            ${playerCount}`);
  log(`  Roster assignments: ${assignCount}`);
  log(`  Tryouts:            ${tryoutCount}`);
  log(`  Games:              ${gameCount}`);
  log("\nLogin: coach@rostr.test / rostrpilot123!");
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  const user = await resolveOrCreateAuthUser();
  await wipeExistingProgramData(user);
  const { programId, coachId } = await createOrgAndProgram(user);
  const players = await createPlayers(programId);
  const { tryoutId, stations } = await createTryoutAndStations(programId, coachId, user.id);
  const scoreRows = await registerAttendeesAndScore(tryoutId, stations, players, coachId);
  await applyVerdictsByRanking(tryoutId, players, stations, scoreRows, coachId, programId);
  const { games } = await createSchedule(programId, user.id, coachId, players);
  await populateRostersAndLineups(games, players);
  await summarize(programId);
  log(`\n✅ Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("Fatal error in simulation:", err);
  process.exit(1);
});
