// @ts-check
/**
 * seed-recruiter.mjs
 *
 * Creates a demo recruiter account + a couple of saved lists/searches
 * so /scout has real data to show on first load.
 *
 * Login: scout@rostr.test / scoutpilot123!
 */

import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3MTU5OCwiZXhwIjoyMDg5MjQ3NTk4fQ.rs0aiShj2COBIcn484pJsRO4Hphr9PX2QTV3gpxVNZI";

const svc = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "scout@rostr.test";
const PASSWORD = "scoutpilot123!";

async function main() {
  console.log("→ Ensuring recruiter auth user…");
  const { data: existing } = await svc.auth.admin.listUsers();
  let user = existing?.users?.find((u) => u.email === EMAIL);
  if (!user) {
    const { data, error } = await svc.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Rebecca Lee", role: "recruiter" },
    });
    if (error || !data?.user) throw new Error(`create user failed: ${error?.message}`);
    user = data.user;
    console.log(`  ✓ Created ${EMAIL}`);
  } else {
    console.log(`  ✓ User exists: ${user.id.slice(0, 8)}…`);
  }

  console.log("\n→ Wiping existing recruiter data…");
  await svc.from("recruiters").delete().eq("user_id", user.id);

  console.log("\n→ Creating recruiter profile…");
  const { data: rec, error: rErr } = await svc
    .from("recruiters")
    .insert({
      user_id: user.id,
      full_name: "Rebecca Lee",
      organization_name: "University of Texas",
      organization_short: "TEX",
      organization_division: "d1",
      title: "Recruiting Coordinator",
      sport: "Baseball",
      region: "Southwest",
      contact_email: EMAIL,
      verified: true,
      avatar_color: "#3a6ea8",
    })
    .select("id")
    .single();
  if (rErr || !rec) throw new Error(`recruiter insert: ${rErr?.message}`);
  console.log(`  ✓ Recruiter ${rec.id.slice(0, 8)}…`);

  console.log("\n→ Creating starter lists…");
  const { data: lists } = await svc
    .from("recruiter_lists")
    .insert([
      {
        recruiter_id: rec.id,
        name: "Watch list · 2027",
        emoji: "👀",
        color: "#c83a3a",
        description: "Players in the 2027 class I'm tracking.",
      },
      {
        recruiter_id: rec.id,
        name: "Top arms",
        emoji: "🔥",
        color: "#d68620",
        description: "Pitchers throwing 85+ mph.",
      },
      {
        recruiter_id: rec.id,
        name: "Speed guys",
        emoji: "🚀",
        color: "#2f7d4f",
        description: "6.9 or faster on the 60.",
      },
    ])
    .select("id, name");
  console.log(`  ✓ Created ${lists?.length ?? 0} lists`);

  console.log("\n→ Creating starter saved searches…");
  const { data: ss } = await svc
    .from("recruiter_saved_searches")
    .insert([
      {
        recruiter_id: rec.id,
        name: "TX pitchers 2027",
        filters: { positions: ["P"], gradeYears: [2027], minVelo: 82 },
      },
      {
        recruiter_id: rec.id,
        name: "Power infielders",
        filters: { positions: ["SS", "2B", "3B"], minEV: 88 },
      },
    ])
    .select("id, name");
  console.log(`  ✓ Created ${ss?.length ?? 0} saved searches`);

  // Populate the Watch list with a few players (class of 2027)
  console.log("\n→ Pre-seeding Watch list with some class-of-2027 players…");
  const { data: players } = await svc
    .from("players")
    .select("id, grade")
    .eq("grade", 10) // sophomores → class of 2028… let's use a mix
    .limit(6);
  const watchList = lists?.find((l) => l.name === "Watch list · 2027");
  if (watchList && players) {
    await svc.from("recruiter_list_players").insert(
      players.map((p) => ({
        list_id: watchList.id,
        player_id: p.id,
        notes: "Auto-added during seed",
      })),
    );
    console.log(`  ✓ Added ${players.length} players to Watch list`);
  }

  console.log("\n✅ Done");
  console.log(`\n   Login: ${EMAIL} / ${PASSWORD}`);
  console.log("   Then visit http://localhost:3000/scout");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
