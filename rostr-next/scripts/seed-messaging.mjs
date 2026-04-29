// @ts-check
/**
 * seed-messaging.mjs
 *
 * Seeds demo conversations into the native messaging system so
 * /app/messages, /me/messages, and /scout/outreach all have real data
 * to display on first load.
 *
 * Creates:
 *   1. A claimed test-athlete user for the head coach's top player
 *   2. A coach → player DM thread (2 messages back-and-forth)
 *   3. A team announcement to Varsity
 *   4. A recruiter → player outreach (pending)
 *   5. Sets the recruiter's quota plan = "pro" with a 50-message cap
 */

import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3MTU5OCwiZXhwIjoyMDg5MjQ3NTk4fQ.rs0aiShj2COBIcn484pJsRO4Hphr9PX2QTV3gpxVNZI";

const svc = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("━━━ Seeding messaging ━━━\n");

  // ── 1. Ensure a claimed test athlete ────────────────────────
  const athleteEmail = "athlete@rostr.test";
  const athletePassword = "athlete123!";
  console.log("→ Ensuring athlete user…");
  let { data: users } = await svc.auth.admin.listUsers();
  let athleteUser = users?.users?.find((u) => u.email === athleteEmail);
  if (!athleteUser) {
    const { data } = await svc.auth.admin.createUser({
      email: athleteEmail,
      password: athletePassword,
      email_confirm: true,
      user_metadata: { full_name: "Marcus Johnson (test)", role: "player" },
    });
    athleteUser = data?.user ?? undefined;
    console.log(`  ✓ Created athlete user`);
  } else {
    console.log(`  ✓ Athlete exists`);
  }
  if (!athleteUser) throw new Error("no athlete user");

  // Find the coach's program + a player to claim
  const { data: coach } = await svc
    .from("coaches")
    .select("id, program_id, user_id, full_name")
    .eq("email", "coach@rostr.test")
    .maybeSingle();
  if (!coach) throw new Error("coach not found, run simulate-pilot first");
  console.log(`  ✓ Coach: ${coach.full_name} · program ${coach.program_id.slice(0, 8)}…`);

  const { data: targetPlayer } = await svc
    .from("players")
    .select("id, first_name, last_name, claimed_by_user_id")
    .eq("program_id", coach.program_id)
    .order("player_number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!targetPlayer) throw new Error("no player to claim");

  // Link player to athlete user if not already
  if (targetPlayer.claimed_by_user_id !== athleteUser.id) {
    await svc
      .from("players")
      .update({
        claimed_by_user_id: athleteUser.id,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", targetPlayer.id);
    console.log(`  ✓ Linked ${targetPlayer.first_name} ${targetPlayer.last_name} to athlete user`);
  }

  // ── 2. Clean existing seeded threads for idempotency ────────
  console.log("\n→ Clearing any prior seeded threads…");
  // Delete threads that involve the athlete user, coach, or recruiter.
  const { data: existingThreads } = await svc
    .from("thread_participants")
    .select("thread_id")
    .eq("user_id", athleteUser.id);
  const toDel = (existingThreads ?? []).map((r) => r.thread_id);
  if (toDel.length > 0) {
    await svc.from("message_threads").delete().in("id", toDel);
    console.log(`  ✓ Cleared ${toDel.length} existing thread(s)`);
  }

  // ── 3. Coach → Player DM ────────────────────────────────────
  console.log("\n→ Seeding coach ↔ player DM…");
  const { data: dmThread } = await svc
    .from("message_threads")
    .insert({
      kind: "dm",
      program_id: coach.program_id,
      created_by: coach.user_id,
    })
    .select("id")
    .single();
  await svc.from("thread_participants").insert([
    { thread_id: dmThread.id, user_id: coach.user_id, role: "coach" },
    { thread_id: dmThread.id, user_id: athleteUser.id, role: "player" },
  ]);
  await svc.from("chat_messages").insert([
    {
      thread_id: dmThread.id,
      sender_user_id: coach.user_id,
      body: `Hey ${targetPlayer.first_name}, big game Friday. I want you to take BP first — your swing's been locked in. Let me know if you need anything.`,
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      thread_id: dmThread.id,
      sender_user_id: athleteUser.id,
      body: "Thanks coach! I'll be there early. Wrist feeling good, ready to go.",
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  ]);
  console.log("  ✓ DM thread + 2 messages");

  // ── 4. Team announcement ─────────────────────────────────────
  console.log("\n→ Seeding team announcement…");
  const { data: annThread } = await svc
    .from("message_threads")
    .insert({
      kind: "announcement",
      program_id: coach.program_id,
      subject: "Friday game — bus leaves at 3:45",
      created_by: coach.user_id,
    })
    .select("id")
    .single();
  await svc.from("thread_participants").insert([
    { thread_id: annThread.id, user_id: coach.user_id, role: "coach" },
    { thread_id: annThread.id, user_id: athleteUser.id, role: "player" },
  ]);
  await svc.from("chat_messages").insert({
    thread_id: annThread.id,
    sender_user_id: coach.user_id,
    body: "Team — Friday game vs Central Hawks. Bus leaves the field at 3:45 SHARP. Bring your away jerseys, full water, and your game face. Let's go.",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  });
  console.log("  ✓ Announcement thread");

  // ── 5. Recruiter outreach ────────────────────────────────────
  console.log("\n→ Seeding recruiter outreach (pending)…");
  const { data: recruiter } = await svc
    .from("recruiters")
    .select("id, user_id, full_name, organization_name")
    .eq("contact_email", "scout@rostr.test")
    .maybeSingle();
  if (!recruiter) {
    console.log("  ⚠ Recruiter not found — run seed-recruiter.mjs first");
  } else {
    // Ensure quota row + set to pro tier for demo
    await svc.from("recruiter_message_quotas").upsert(
      {
        recruiter_id: recruiter.id,
        plan: "pro",
        monthly_limit: 50,
        current_month_sent: 1, // count this seeded outreach
        month_reset_at: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1,
        ).toISOString(),
      },
      { onConflict: "recruiter_id" },
    );

    const { data: outreachThread } = await svc
      .from("message_threads")
      .insert({
        kind: "recruiter_outreach",
        recruiter_id: recruiter.id,
        target_player_id: targetPlayer.id,
        outreach_status: "pending",
        subject: "Interest from University of Texas",
        created_by: recruiter.user_id,
      })
      .select("id")
      .single();
    await svc.from("thread_participants").insert([
      { thread_id: outreachThread.id, user_id: recruiter.user_id, role: "recruiter" },
      { thread_id: outreachThread.id, user_id: athleteUser.id, role: "player" },
    ]);
    await svc.from("chat_messages").insert({
      thread_id: outreachThread.id,
      sender_user_id: recruiter.user_id,
      body: `Hi ${targetPlayer.first_name},\n\nI'm Rebecca from the University of Texas. Saw your 94 mph EV and your 6.74 60yd — impressive. I'd love to learn more about your goals and talk about our 2027 class.\n\nAre you available for a short call next week?\n\n— Rebecca`,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    });
    console.log("  ✓ Recruiter outreach (pending) + quota set to pro/50");
  }

  console.log("\n✅ Messaging seeded.");
  console.log(`\n   Coach login:   coach@rostr.test / rostrpilot123!`);
  console.log(`   Athlete login: ${athleteEmail} / ${athletePassword}`);
  console.log(`   Recruiter:     scout@rostr.test / scoutpilot123!`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
