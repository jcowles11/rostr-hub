// @ts-check
/**
 * seed-completed-games.mjs
 *
 * Takes the earliest N games for the demo coach and marks them as
 * completed with realistic-ish final scores. Gives the Hub a real
 * W-L record, fills the activity feed with "Team won X-Y" lines,
 * and makes the Recap tab on those games render real content.
 */

import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3MTU5OCwiZXhwIjoyMDg5MjQ3NTk4fQ.rs0aiShj2COBIcn484pJsRO4Hphr9PX2QTV3gpxVNZI";

const svc = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Per-team simulated W-L runs for the demo
const PLAN = [
  { level: "Varsity", wins: 8, losses: 2, ties: 0 },
  { level: "JV", wins: 5, losses: 3, ties: 1 },
  { level: "Sophomore", wins: 4, losses: 2, ties: 0 },
  { level: "Freshman", wins: 3, losses: 3, ties: 0 },
];

const RECAP_TEMPLATES = {
  W: [
    "Tight game through 5, big inning in the 6th cracked it open. Johnson 3-for-4, 2 RBI.",
    "Pitching was lights-out — complete game, 2 hits. Offense did enough.",
    "Scored 4 in the first and never looked back. Clean defense, no errors.",
    "Walkoff single in the bottom of the 7th. Crowd went crazy. Team earned this one.",
  ],
  L: [
    "Fell behind early, couldn't string hits together. Good at-bats but just didn't fall in.",
    "Two errors in the 4th cost us. Need to clean up our defense.",
    "Their starter was dealing — we made contact but right at people.",
  ],
  T: ["Rain called after 7. Both pitching staffs had it going."],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function generateScore(result) {
  const ours = 2 + Math.floor(Math.random() * 8);
  let theirs;
  if (result === "W") theirs = Math.max(0, ours - 1 - Math.floor(Math.random() * 4));
  else if (result === "L") theirs = ours + 1 + Math.floor(Math.random() * 4);
  else theirs = ours;
  return { ourScore: ours, opponentScore: theirs };
}

async function main() {
  console.log("━━━ Seeding completed games ━━━\n");

  const { data: coach } = await svc
    .from("coaches")
    .select("id, program_id, full_name")
    .eq("email", "coach@rostr.test")
    .maybeSingle();
  if (!coach) throw new Error("coach@rostr.test not found — run simulate-pilot first");
  console.log(`→ Coach: ${coach.full_name}`);

  for (const team of PLAN) {
    const total = team.wins + team.losses + team.ties;
    // Pull the earliest N games for this level that are still scheduled
    const { data: games } = await svc
      .from("games")
      .select("id, opponent, game_date")
      .eq("program_id", coach.program_id)
      .eq("team_level", team.level)
      .eq("status", "scheduled")
      .order("game_date", { ascending: true })
      .limit(total);
    if (!games || games.length === 0) {
      console.log(`  ⚠ No scheduled games for ${team.level}`);
      continue;
    }

    // Build the result sequence: wins first, then losses, then ties
    const resultSequence = [
      ...Array(team.wins).fill("W"),
      ...Array(team.losses).fill("L"),
      ...Array(team.ties).fill("T"),
    ];
    // Shuffle to make the W/L pattern more realistic
    for (let i = resultSequence.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [resultSequence[i], resultSequence[j]] = [resultSequence[j], resultSequence[i]];
    }

    let applied = 0;
    for (let i = 0; i < games.length && i < resultSequence.length; i++) {
      const game = games[i];
      const result = resultSequence[i];
      const { ourScore, opponentScore } = generateScore(result);
      const notes = pick(RECAP_TEMPLATES[result]);
      const gameDate = new Date(`${game.game_date}T19:00:00`);
      await svc
        .from("games")
        .update({
          status: "completed",
          our_score: ourScore,
          opponent_score: opponentScore,
          recap_notes: notes,
          completed_at: new Date(gameDate.getTime() + 3 * 60 * 60 * 1000).toISOString(),
          completed_by: coach.id,
        })
        .eq("id", game.id);
      applied++;
    }
    console.log(`  ✓ ${team.level}: ${team.wins}-${team.losses}${team.ties ? "-" + team.ties : ""} across ${applied} games`);
  }

  console.log("\n✅ Completed games seeded");
  console.log("   Visit /app (coach@rostr.test / rostrpilot123!) to see the record tile + activity feed");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
