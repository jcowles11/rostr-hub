// @ts-check
/**
 * test-as-coach.mjs
 *
 * Signs in as coach@rostr.test using the ANON key (the same path the
 * app uses in production) and runs the core read queries each page
 * depends on. Reports any query errors, empty results, or RLS issues.
 *
 * This is a lightweight integration test — if every query here comes
 * back populated, the SSR pages have the data they need to render.
 */

import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzE1OTgsImV4cCI6MjA4OTI0NzU5OH0.P0lJCaeOHmZNIbQtYDqvJKmNCjKF7P4fG92Jvw3z2CM";

const bugs = [];
function bug(area, msg, detail) {
  bugs.push({ area, msg, detail });
  console.log(`  ❌ [${area}] ${msg}`);
  if (detail) console.log(`     ${JSON.stringify(detail).slice(0, 200)}`);
}
function ok(area, msg) {
  console.log(`  ✅ [${area}] ${msg}`);
}

const supabase = createClient(URL, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signIn() {
  console.log("→ Signing in as coach@rostr.test…");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "coach@rostr.test",
    password: "rostrpilot123!",
  });
  if (error || !data.user) {
    bug("auth", "Sign-in failed", error);
    process.exit(1);
  }
  console.log(`  ✓ Signed in: ${data.user.id}`);
  return data.user;
}

async function testCoachContext(user) {
  console.log("\n→ Testing getCurrentCoach query (coach + program join)…");
  const { data, error } = await supabase
    .from("coaches")
    .select("id, program_id, full_name, role, programs (name, levels, sport, logo_url)")
    .eq("user_id", user.id)
    .limit(1);
  if (error) return bug("getCurrentCoach", error.message, error);
  if (!data || data.length === 0)
    return bug("getCurrentCoach", "No coach row for signed-in user");
  const coach = data[0];
  if (!coach.programs) return bug("getCurrentCoach", "Program join came back null — RLS?");
  ok("getCurrentCoach", `${coach.full_name} → ${coach.programs.name} (levels: ${coach.programs.levels.join(", ")})`);
  return coach;
}

async function testRoster(programId) {
  console.log("\n→ Testing fetchRoster…");
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, first_name, last_name, grade, positions, player_number, profile_slug, profile_public")
    .eq("program_id", programId)
    .order("last_name", { ascending: true });
  if (pErr) return bug("fetchRoster", pErr.message, pErr);
  if (!players || players.length === 0)
    return bug("fetchRoster", "No players returned — RLS?");

  const { data: assignments, error: aErr } = await supabase
    .from("roster_assignments")
    .select("player_id, assignment")
    .eq("program_id", programId);
  if (aErr) return bug("fetchRoster-assignments", aErr.message, aErr);

  ok("fetchRoster", `${players.length} players, ${assignments?.length ?? 0} assignments`);

  // Check distribution across teams
  const counts = {};
  for (const a of assignments ?? []) {
    counts[a.assignment] = (counts[a.assignment] ?? 0) + 1;
  }
  console.log(`    distribution: ${JSON.stringify(counts)}`);
  return { players, assignments };
}

async function testSchedule(programId) {
  console.log("\n→ Testing fetchUpcomingGames + fetchUpcomingPractices…");
  const today = new Date().toISOString().slice(0, 10);
  const { data: games, error: gErr } = await supabase
    .from("games")
    .select("id, name, opponent, game_date, game_time, location, home_away, team_level, status")
    .eq("program_id", programId)
    .gte("game_date", today)
    .order("game_date", { ascending: true });
  if (gErr) bug("fetchUpcomingGames", gErr.message, gErr);
  else ok("fetchUpcomingGames", `${games?.length ?? 0} upcoming games`);

  const { data: practices, error: pErr } = await supabase
    .from("practice_plans")
    .select("id, practice_date, team_level, title")
    .eq("program_id", programId)
    .gte("practice_date", today)
    .order("practice_date", { ascending: true });
  if (pErr) bug("fetchUpcomingPractices", pErr.message, pErr);
  else ok("fetchUpcomingPractices", `${practices?.length ?? 0} upcoming practices`);

  return { games, practices };
}

async function testGameDetail(gameId) {
  console.log(`\n→ Testing fetchGameDetail(${gameId.slice(0, 8)}…)…`);
  const { data: game, error: gErr } = await supabase
    .from("games")
    .select("id, name, opponent, game_date, game_time, location, home_away, team_level, status")
    .eq("id", gameId)
    .maybeSingle();
  if (gErr) bug("fetchGameDetail-game", gErr.message, gErr);
  else if (!game) bug("fetchGameDetail-game", "Game not found or RLS blocked");
  else ok("fetchGameDetail-game", `${game.name} · ${game.team_level}`);

  const { data: roster, error: rErr } = await supabase
    .from("game_rosters")
    .select("player_id, status")
    .eq("game_id", gameId);
  if (rErr) bug("fetchGameDetail-roster", rErr.message, rErr);
  else ok("fetchGameDetail-roster", `${roster?.length ?? 0} on roster`);

  const { data: lineup, error: lErr } = await supabase
    .from("lineup_entries")
    .select("player_id, batting_order, position")
    .eq("game_id", gameId)
    .order("batting_order");
  if (lErr) bug("fetchGameDetail-lineup", lErr.message, lErr);
  else ok("fetchGameDetail-lineup", `${lineup?.length ?? 0} lineup slots`);
}

async function testTryouts(programId) {
  console.log("\n→ Testing fetchTryouts (list)…");
  const { data: tryouts, error: tErr } = await supabase
    .from("tryouts")
    .select("id, name, start_date, status, varsity_target, jv_target")
    .eq("program_id", programId)
    .order("start_date", { ascending: false });
  if (tErr) return bug("fetchTryouts", tErr.message, tErr);
  if (!tryouts || tryouts.length === 0)
    return bug("fetchTryouts", "No tryouts visible — RLS?");
  ok("fetchTryouts", `${tryouts.length} tryouts`);

  const t = tryouts[0];

  console.log("\n→ Testing fetchTryoutDetail…");
  const [stationsRes, attendeesRes, scoresRes] = await Promise.all([
    supabase
      .from("tryout_stations")
      .select(
        "id, name, short_code, unit, score_type, sort_order, status, coaches:assigned_coach_id(full_name)",
      )
      .eq("tryout_id", t.id)
      .order("sort_order"),
    supabase
      .from("tryout_attendees")
      .select("player_id, attended, verdict")
      .eq("tryout_id", t.id),
    supabase
      .from("tryout_scores")
      .select(
        "id, station_id, player_id, value, flag, created_at, coaches:scored_by(full_name)",
      )
      .eq("tryout_id", t.id),
  ]);

  if (stationsRes.error) bug("fetchTryoutDetail-stations", stationsRes.error.message, stationsRes.error);
  else ok("fetchTryoutDetail-stations", `${stationsRes.data.length} stations`);

  if (attendeesRes.error) bug("fetchTryoutDetail-attendees", attendeesRes.error.message, attendeesRes.error);
  else {
    ok("fetchTryoutDetail-attendees", `${attendeesRes.data.length} attendees`);
    const verdictCounts = {};
    for (const a of attendeesRes.data) {
      verdictCounts[a.verdict ?? "null"] = (verdictCounts[a.verdict ?? "null"] ?? 0) + 1;
    }
    console.log(`    verdicts: ${JSON.stringify(verdictCounts)}`);
  }

  if (scoresRes.error) bug("fetchTryoutDetail-scores", scoresRes.error.message, scoresRes.error);
  else ok("fetchTryoutDetail-scores", `${scoresRes.data.length} scores`);

  return t;
}

async function testStationScoring(tryoutId) {
  console.log("\n→ Testing fetchStationScoringContext…");
  const { data: stations } = await supabase
    .from("tryout_stations")
    .select("id")
    .eq("tryout_id", tryoutId)
    .limit(1);
  const stationId = stations?.[0]?.id;
  if (!stationId) return bug("station", "no stations found");

  const { data: attendeesWithPlayers, error } = await supabase
    .from("tryout_attendees")
    .select("player_id, attended, players:player_id(first_name, last_name, player_number, positions)")
    .eq("tryout_id", tryoutId)
    .eq("attended", true);
  if (error) bug("station-attendeeJoin", error.message, error);
  else {
    const withPlayers = attendeesWithPlayers.filter((a) => a.players);
    ok("station-attendeeJoin", `${withPlayers.length} attendees joined to player rows`);
    if (withPlayers.length < attendeesWithPlayers.length) {
      bug("station-attendeeJoin", `${attendeesWithPlayers.length - withPlayers.length} attendees missing player join — RLS?`);
    }
  }
}

async function testPublicProfile() {
  console.log("\n→ Testing /p/[handle] profile page data…");
  // Pick a random player with a profile_slug.
  const { data: players } = await supabase
    .from("players")
    .select("id, first_name, last_name, profile_slug")
    .limit(5);
  if (!players || players.length === 0) return bug("publicProfile", "no players with slugs");
  const p = players[0];

  const { data: playerDetail, error: pErr } = await supabase
    .from("players")
    .select("id, first_name, last_name, grade, positions, player_number, profile_slug, profile_public, program_id")
    .eq("profile_slug", p.profile_slug)
    .maybeSingle();
  if (pErr) bug("publicProfile-lookup", pErr.message, pErr);
  else if (!playerDetail) bug("publicProfile-lookup", "Couldn't look up player by slug — RLS?");
  else ok("publicProfile-lookup", `${playerDetail.first_name} ${playerDetail.last_name}`);

  // Measurables view
  const { data: measurables, error: mErr } = await supabase
    .from("player_best_measurables")
    .select("short_code, station_name, unit, best_value, score_type, latest_at")
    .eq("player_id", p.id);
  if (mErr) bug("publicProfile-measurables", mErr.message, mErr);
  else ok("publicProfile-measurables", `${measurables?.length ?? 0} best measurables`);
}

async function main() {
  console.log("━━━ Coach-perspective integration test ━━━\n");
  const user = await signIn();
  const coach = await testCoachContext(user);
  if (!coach) return;

  await testRoster(coach.program_id);
  const { games } = await testSchedule(coach.program_id);
  if (games && games.length > 0) {
    await testGameDetail(games[0].id);
  }
  const tryout = await testTryouts(coach.program_id);
  if (tryout) await testStationScoring(tryout.id);
  await testPublicProfile();

  console.log("\n━━━ Results ━━━");
  if (bugs.length === 0) {
    console.log("🎉 All queries pass — data loads correctly for the coach.");
  } else {
    console.log(`${bugs.length} bug(s) found:`);
    for (const b of bugs) {
      console.log(`  • [${b.area}] ${b.msg}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
