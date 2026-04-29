// @ts-check
/**
 * test-signup-flow.mjs
 *
 * Simulates a brand-new coach signing up and going through the entire
 * first-run flow without ever clicking in a browser. Catches any bug
 * that would bite a fresh pilot user on day 1.
 *
 * Exercises (in order):
 *   1. Sign up a new auth user via Supabase
 *   2. Sign in as that user
 *   3. Run the same insert chain /app/setup calls:
 *        organizations → programs → organization_members → coaches
 *   4. Verify getCurrentCoach() returns the right shape
 *   5. Add a player
 *   6. Create a game (exercises the games table + all columns)
 *   7. Create a practice
 *   8. Cleanup
 */

import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzE1OTgsImV4cCI6MjA4OTI0NzU5OH0.P0lJCaeOHmZNIbQtYDqvJKmNCjKF7P4fG92Jvw3z2CM";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3MTU5OCwiZXhwIjoyMDg5MjQ3NTk4fQ.rs0aiShj2COBIcn484pJsRO4Hphr9PX2QTV3gpxVNZI";

const bugs = [];
function bug(area, msg, detail) {
  bugs.push({ area, msg });
  console.log(`  ❌ [${area}] ${msg}`);
  if (detail) console.log(`     ${JSON.stringify(detail).slice(0, 200)}`);
}
function ok(area, msg) {
  console.log(`  ✅ [${area}] ${msg}`);
}

const svc = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("━━━ Fresh-account signup flow test ━━━\n");

  const email = `newcoach_${Date.now()}@rostr.test`;
  const password = "testpass123!";

  // ── Step 1: Sign up a new user ──────────────────────────────
  console.log("→ Creating brand-new auth user…");
  const { data: createRes, error: createErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Coach Jane Doe", role: "coach" },
  });
  if (createErr || !createRes?.user) return bug("signup", "create user failed", createErr);
  const userId = createRes.user.id;
  ok("signup", `Created ${email} (${userId.slice(0, 8)}…)`);

  // ── Step 2: Sign in as that user ────────────────────────────
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) return bug("signin", signInErr.message, signInErr);
  ok("signin", "Signed in successfully");

  // ── Step 3: Run the createProgramAction chain ───────────────
  console.log("\n→ Running /app/setup server action chain…");

  const { data: org, error: orgErr } = await client
    .from("organizations")
    .insert({ name: "Test High School", created_by: userId })
    .select("id")
    .single();
  if (orgErr || !org) return bug("setup-org", orgErr?.message ?? "no data", orgErr);
  ok("setup-org", `org ${org.id.slice(0, 8)}…`);

  const { data: program, error: progErr } = await client
    .from("programs")
    .insert({
      name: "Test Baseball",
      school_name: "Test High School",
      created_by: userId,
      sport: "Baseball",
      organization_id: org.id,
      levels: ["Varsity", "JV", "Freshman"],
    })
    .select("id")
    .single();
  if (progErr || !program) return bug("setup-program", progErr?.message ?? "no data", progErr);
  ok("setup-program", `program ${program.id.slice(0, 8)}…`);

  const { error: memberErr } = await client
    .from("organization_members")
    .insert({
      user_id: userId,
      organization_id: org.id,
      program_id: program.id,
      role: "admin",
      full_name: "Coach Jane Doe",
      email,
      color: "#c83a3a",
    });
  if (memberErr) bug("setup-member", memberErr.message, memberErr);
  else ok("setup-member", "org member created");

  // IMPORTANT: do NOT chain .select("id").single() here. The coach row
  // is inserted by a user who is not yet a coach on this program, which
  // means the RETURNING-based SELECT that Supabase appends when you
  // call .select() fails the coaches-SELECT RLS policy (is_program_coach
  // returns false until the row exists — a chicken-and-egg). Fetch the
  // row with a separate SELECT filtered by user_id instead, which works
  // once the INSERT has committed.
  const { error: coachErr } = await client
    .from("coaches")
    .insert({
      user_id: userId,
      program_id: program.id,
      full_name: "Coach Jane Doe",
      email,
      role: "head_coach",
      color: "#c83a3a",
    });
  if (coachErr) return bug("setup-coach", coachErr.message, coachErr);
  const { data: coachRow } = await client
    .from("coaches")
    .select("id")
    .eq("user_id", userId)
    .eq("program_id", program.id)
    .maybeSingle();
  if (!coachRow) return bug("setup-coach", "insert succeeded but coach row not readable");
  const coach = coachRow;
  ok("setup-coach", `coach ${coach.id.slice(0, 8)}…`);

  // ── Step 4: getCurrentCoach should return the shape /app expects ─
  console.log("\n→ Verifying getCurrentCoach shape…");
  const { data: ccData, error: ccErr } = await client
    .from("coaches")
    .select(
      "id, program_id, full_name, role, programs (name, levels, sport, logo_url)",
    )
    .eq("user_id", userId)
    .limit(1);
  if (ccErr || !ccData || ccData.length === 0)
    bug("getCurrentCoach", ccErr?.message ?? "no row", ccErr);
  else {
    const c = ccData[0];
    if (!c.programs) bug("getCurrentCoach", "programs join is null");
    else ok("getCurrentCoach", `${c.full_name} → ${c.programs.name}`);
  }

  // ── Step 5: Add a player ────────────────────────────────────
  console.log("\n→ Adding a player…");
  const { data: player, error: pErr } = await client
    .from("players")
    .insert({
      program_id: program.id,
      first_name: "First",
      last_name: "Player",
      grade: 11,
      positions: ["CF"],
      player_number: 7,
      profile_slug: `first_player_${Date.now()}`,
    })
    .select("id, claim_token")
    .single();
  if (pErr || !player) bug("player-insert", pErr?.message ?? "no data", pErr);
  else ok("player-insert", `id ${player.id.slice(0, 8)}… token ${player.claim_token.slice(0, 8)}…`);

  // ── Step 6: Create a game ───────────────────────────────────
  console.log("\n→ Creating a game…");
  const { data: game, error: gErr } = await client
    .from("games")
    .insert({
      program_id: program.id,
      name: "vs Test Opponent",
      opponent: "Test Opponent",
      game_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      location: "Home Field",
      home_away: "home",
      team_level: "Varsity",
      status: "scheduled",
      created_by: coach.id,
    })
    .select("id")
    .single();
  if (gErr || !game) bug("game-insert", gErr?.message ?? "no data", gErr);
  else ok("game-insert", `id ${game.id.slice(0, 8)}…`);

  // ── Step 7: Create a practice ───────────────────────────────
  console.log("\n→ Creating a practice…");
  const { data: pr, error: prErr } = await client
    .from("practice_plans")
    .insert({
      program_id: program.id,
      practice_date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
      team_level: "Varsity",
      title: "First practice",
      created_by: userId,
    })
    .select("id")
    .single();
  if (prErr || !pr) bug("practice-insert", prErr?.message ?? "no data", prErr);
  else ok("practice-insert", `id ${pr.id.slice(0, 8)}…`);

  // ── Step 8: Set a roster assignment ─────────────────────────
  console.log("\n→ Setting a roster assignment…");
  if (player) {
    const { error: raErr } = await client.from("roster_assignments").upsert(
      {
        player_id: player.id,
        program_id: program.id,
        assignment: "varsity",
        assigned_by: coach.id,
      },
      { onConflict: "player_id" },
    );
    if (raErr) bug("roster-assign", raErr.message, raErr);
    else ok("roster-assign", "varsity assigned");
  }

  // ── Cleanup ──────────────────────────────────────────────────
  console.log("\n→ Cleaning up…");
  await svc.from("programs").delete().eq("id", program.id);
  await svc.from("organizations").delete().eq("id", org.id);
  await svc.auth.admin.deleteUser(userId);
  ok("cleanup", "removed program + org + user");

  console.log("\n━━━ Results ━━━");
  if (bugs.length === 0) {
    console.log("🎉 Fresh-account signup + setup + seed flow works end-to-end.");
  } else {
    console.log(`${bugs.length} bug(s):`);
    for (const b of bugs) console.log(`  • [${b.area}] ${b.msg}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
