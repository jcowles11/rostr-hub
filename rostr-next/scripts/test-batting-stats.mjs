// @ts-check
import { createClient } from "@supabase/supabase-js";
const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzE1OTgsImV4cCI6MjA4OTI0NzU5OH0.P0lJCaeOHmZNIbQtYDqvJKmNCjKF7P4fG92Jvw3z2CM";

const c = createClient(URL, ANON, { auth: { persistSession: false } });
await c.auth.signInWithPassword({ email: "coach@rostr.test", password: "rostrpilot123!" });

console.log("━━━ Batting stats views ━━━\n");

const { data: leaders } = await c
  .from("program_batting_leaders")
  .select("player_id, first_name, last_name, player_number, games, ab, h, hr, rbi, bb, k, ba, obp, slg, ops")
  .order("ops", { ascending: false })
  .limit(10);

console.log("Top 10 by OPS:");
for (const p of leaders ?? []) {
  console.log(
    `  ${p.first_name} ${p.last_name} #${p.player_number}: ${p.games}G ${p.ab}AB ${p.h}H ${p.hr}HR ${p.rbi}RBI · .${String(p.ba).replace("0.", "").padStart(3, "0")}/.${String(p.obp).replace("0.", "").padStart(3, "0")}/.${String(p.slg).replace("0.", "").padStart(3, "0")} (${p.ops})`,
  );
}

console.log("\n━━━ Career line for top OPS player ━━━");
if (leaders && leaders.length > 0) {
  const { data: career } = await c
    .from("player_career_batting")
    .select("*")
    .eq("player_id", leaders[0].player_id)
    .maybeSingle();
  console.log(JSON.stringify(career, null, 2));
}
