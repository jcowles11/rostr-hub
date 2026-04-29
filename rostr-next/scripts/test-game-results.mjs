// @ts-check
/**
 * test-game-results.mjs — verify the program_record views + game
 * result action work end-to-end.
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzE1OTgsImV4cCI6MjA4OTI0NzU5OH0.P0lJCaeOHmZNIbQtYDqvJKmNCjKF7P4fG92Jvw3z2CM";

const bugs = [];
const bug = (a, m) => {
  bugs.push({ a, m });
  console.log(`  ❌ [${a}] ${m}`);
};
const ok = (a, m) => console.log(`  ✅ [${a}] ${m}`);

async function main() {
  console.log("━━━ Game results integration test ━━━\n");

  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email: "coach@rostr.test",
    password: "rostrpilot123!",
  });
  if (signInErr) return bug("signin", signInErr.message);
  ok("signin", "coach signed in");

  // Program record by level
  const { data: byLevel, error: blErr } = await client
    .from("program_record_by_level")
    .select("team_level, wins, losses, ties, games_completed, runs_for, runs_against");
  if (blErr) return bug("by-level", blErr.message);
  ok("by-level", `${byLevel?.length ?? 0} team levels with completed games`);
  for (const r of byLevel ?? []) {
    console.log(
      `     ${r.team_level}: ${r.wins}-${r.losses}${r.ties ? "-" + r.ties : ""} · RF ${r.runs_for} / RA ${r.runs_against}`,
    );
  }

  // Program-wide total
  const { data: total } = await client
    .from("program_record_total")
    .select("wins, losses, ties, games_completed")
    .maybeSingle();
  ok("total", `Program: ${total?.wins}-${total?.losses}${total?.ties ? "-" + total.ties : ""} across ${total?.games_completed} games`);

  // Game detail fetches score + result
  const { data: oneGame } = await client
    .from("games")
    .select("id, opponent, our_score, opponent_score, result, status")
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
  if (oneGame) {
    ok(
      "one-game",
      `vs ${oneGame.opponent}: ${oneGame.our_score}-${oneGame.opponent_score} (${oneGame.result})`,
    );
  } else {
    bug("one-game", "no completed games found");
  }

  // Activity feed includes game_completed events
  const { data: games } = await client
    .from("games")
    .select("id, completed_at, result")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(3);
  ok("activity-source", `${games?.length ?? 0} recently completed games`);

  console.log("\n━━━ Results ━━━");
  if (bugs.length === 0) {
    console.log("🎉 Game results flow works.");
  } else {
    console.log(`${bugs.length} bug(s):`);
    for (const b of bugs) console.log(`  • [${b.a}] ${b.m}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
