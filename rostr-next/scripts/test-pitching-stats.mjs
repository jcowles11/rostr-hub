// @ts-check
/**
 * test-pitching-stats.mjs
 *
 * Verifies that migration 000019 is applied and the pitching views
 * return meaningful aggregations. Expects pitcher_change events in
 * game_events (seed-live-game.mjs emits them automatically after
 * the 2026-04-23 update).
 */
import { createClient } from "@supabase/supabase-js";
const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzE1OTgsImV4cCI6MjA4OTI0NzU5OH0.P0lJCaeOHmZNIbQtYDqvJKmNCjKF7P4fG92Jvw3z2CM";

const c = createClient(URL, ANON, { auth: { persistSession: false } });
await c.auth.signInWithPassword({ email: "coach@rostr.test", password: "rostrpilot123!" });

console.log("━━━ Pitching stats views ━━━\n");

const { data: leaders, error: leadersErr } = await c
  .from("program_pitching_leaders")
  .select("player_id, first_name, last_name, player_number, games, ip, outs, h, k, bb, r, er, era, whip, k9, bb9, k_bb")
  .order("era", { ascending: true })
  .limit(10);

if (leadersErr) {
  console.error("✗ program_pitching_leaders query failed:");
  console.error(`  ${leadersErr.message}`);
  if (leadersErr.message.includes("does not exist")) {
    console.error("\n  → Migration 000019 probably hasn't been applied yet.");
    console.error("    Apply supabase/migrations/20260315000019_pitching_stats_views.sql");
  }
  process.exit(1);
}

console.log(`Top ${leaders?.length ?? 0} by ERA (min 3 IP / 9 outs):`);
for (const p of leaders ?? []) {
  console.log(
    `  ${p.first_name} ${p.last_name} #${p.player_number}: ${p.games}G · ${p.ip} IP · ${p.k}K/${p.bb}BB · ${p.h}H ${p.r}R · ERA ${p.era} · WHIP ${p.whip} · K/9 ${p.k9}`,
  );
}

if (!leaders || leaders.length === 0) {
  console.log("\n(No pitchers qualified yet. Re-run scripts/seed-live-game.mjs to generate");
  console.log(" pitcher_change events + opponent at-bats that the view depends on.)");
}

console.log("\n━━━ Career pitching line for top qualifier ━━━");
if (leaders && leaders.length > 0) {
  const { data: career, error: careerErr } = await c
    .from("player_career_pitching")
    .select("*")
    .eq("player_id", leaders[0].player_id)
    .maybeSingle();
  if (careerErr) {
    console.error(`✗ career query failed: ${careerErr.message}`);
  } else {
    console.log(JSON.stringify(career, null, 2));
  }
}

console.log("\n━━━ Per-game pitching log (sanity) ━━━");
if (leaders && leaders.length > 0) {
  const { data: gameLog } = await c
    .from("player_game_pitching")
    .select("game_id, bf, outs, ip, h, k, bb, r, last_bf_at")
    .eq("player_id", leaders[0].player_id)
    .order("last_bf_at", { ascending: false })
    .limit(5);
  for (const g of gameLog ?? []) {
    console.log(`  game ${g.game_id.slice(0, 8)}: ${g.ip} IP · ${g.bf} BF · ${g.k}K ${g.bb}BB · ${g.h}H ${g.r}R`);
  }
}
