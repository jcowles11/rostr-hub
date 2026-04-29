// @ts-check
/**
 * test-recruiter.mjs — integration test for /scout.
 * Signs in as the seeded recruiter, exercises search + list workflows.
 */

import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzE1OTgsImV4cCI6MjA4OTI0NzU5OH0.P0lJCaeOHmZNIbQtYDqvJKmNCjKF7P4fG92Jvw3z2CM";

const bugs = [];
function bug(a, m, d) { bugs.push({ a, m }); console.log(`  ❌ [${a}] ${m}`); if (d) console.log(`     ${JSON.stringify(d).slice(0,200)}`); }
function ok(a, m) { console.log(`  ✅ [${a}] ${m}`); }

const client = createClient(URL, ANON, { auth: { persistSession: false } });

async function main() {
  console.log("━━━ Recruiter integration test ━━━\n");

  console.log("→ Sign in as recruiter…");
  const { error } = await client.auth.signInWithPassword({
    email: "scout@rostr.test",
    password: "scoutpilot123!",
  });
  if (error) return bug("signin", error.message);
  ok("signin", "Rebecca Lee signed in");

  console.log("\n→ getCurrentRecruiter query…");
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data: rec } = await client
    .from("recruiters")
    .select("id, full_name, organization_name, organization_division")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!rec) return bug("recruiter", "no record for this user");
  ok("recruiter", `${rec.full_name} · ${rec.organization_name} (${rec.organization_division})`);

  console.log("\n→ player_search view (all public players)…");
  const { data: players, error: sErr, count } = await client
    .from("player_search")
    .select("id, first_name, last_name, best_ev, best_60yd, best_velo", { count: "exact" })
    .eq("profile_public", true)
    .order("best_ev", { ascending: false, nullsFirst: false })
    .limit(5);
  if (sErr) return bug("search", sErr.message, sErr);
  ok("search", `${count} public players; top EV = ${players[0]?.best_ev ?? "—"} by ${players[0]?.first_name} ${players[0]?.last_name}`);

  console.log("\n→ Filtered search: class 2027, position SS…");
  const { data: filtered, count: fCount } = await client
    .from("player_search")
    .select("id, first_name, last_name, grade, positions", { count: "exact" })
    .eq("profile_public", true)
    .eq("grade", 11) // class of 2027 → grade 11 today
    .overlaps("positions", ["SS"]);
  ok("search-filter", `${fCount ?? 0} SS in class 2027`);

  console.log("\n→ Fetch my lists…");
  const { data: lists } = await client
    .from("recruiter_lists")
    .select("id, name, emoji")
    .eq("recruiter_id", rec.id);
  ok("lists", `${lists?.length ?? 0} lists (${lists?.map((l) => l.name).join(", ")})`);

  console.log("\n→ Save a new player to the Watch list…");
  const watchList = lists?.find((l) => l.name === "Watch list · 2027");
  if (!watchList) return bug("save-test", "no watch list");
  const { data: somePlayer } = await client
    .from("player_search")
    .select("id")
    .eq("profile_public", true)
    .not("id", "in", `(SELECT player_id FROM recruiter_list_players WHERE list_id = '${watchList.id}')`)
    .limit(1)
    .maybeSingle();
  if (somePlayer) {
    const { error } = await client
      .from("recruiter_list_players")
      .insert({ list_id: watchList.id, player_id: somePlayer.id });
    if (error && !/duplicate/.test(error.message)) bug("save", error.message);
    else ok("save", "player added to watch list");
  }

  console.log("\n→ Log a view…");
  const { data: vp } = await client
    .from("player_search")
    .select("id")
    .eq("profile_public", true)
    .limit(1)
    .maybeSingle();
  if (vp) {
    const { error } = await client
      .from("recruiter_views")
      .insert({ recruiter_id: rec.id, player_id: vp.id });
    if (error) bug("view-log", error.message);
    else ok("view-log", `viewed player ${vp.id.slice(0, 8)}…`);
  }

  console.log("\n→ Fetch view stats for that player via RPC…");
  if (vp) {
    const { data: stats, error: sErr } = await client.rpc("player_recruiter_view_stats", {
      _player_id: vp.id,
    });
    if (sErr) bug("stats-rpc", sErr.message);
    else {
      const row = Array.isArray(stats) ? stats[0] : stats;
      ok("stats-rpc", `viewers_30d=${row?.viewers_30d} views_30d=${row?.views_30d}`);
    }
  }

  console.log("\n━━━ Results ━━━");
  if (bugs.length === 0) console.log("🎉 Recruiter flow works end-to-end.");
  else {
    console.log(`${bugs.length} bug(s):`);
    for (const b of bugs) console.log(`  • [${b.a}] ${b.m}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
