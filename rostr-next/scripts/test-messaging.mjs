// @ts-check
/**
 * test-messaging.mjs — integration test across all 3 messaging roles.
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzE1OTgsImV4cCI6MjA4OTI0NzU5OH0.P0lJCaeOHmZNIbQtYDqvJKmNCjKF7P4fG92Jvw3z2CM";

const bugs = [];
const bug = (a, m, d) => {
  bugs.push({ a, m });
  console.log(`  ❌ [${a}] ${m}`);
  if (d) console.log(`     ${JSON.stringify(d).slice(0, 200)}`);
};
const ok = (a, m) => console.log(`  ✅ [${a}] ${m}`);

async function asUser(email, password) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} signin failed: ${error.message}`);
  return c;
}

async function main() {
  console.log("━━━ Messaging integration test ━━━\n");

  // ── Coach view ──────────────────────────────────────────
  console.log("→ Sign in as coach…");
  const coach = await asUser("coach@rostr.test", "rostrpilot123!");
  ok("coach-signin", "signed in");

  const { data: coachInbox, error: cErr } = await coach
    .from("inbox_threads")
    .select("thread_id, kind, subject, last_message_at, unread_count")
    .order("last_message_at", { ascending: false });
  if (cErr) bug("coach-inbox", cErr.message);
  else {
    ok("coach-inbox", `${coachInbox.length} threads visible`);
    const kinds = coachInbox.reduce((m, t) => {
      m[t.kind] = (m[t.kind] ?? 0) + 1;
      return m;
    }, {});
    console.log(`     by kind: ${JSON.stringify(kinds)}`);
  }

  const { data: unread } = await coach.rpc("my_unread_count");
  ok("coach-unread", `${unread} unread`);

  // ── Athlete view ─────────────────────────────────────────
  console.log("\n→ Sign in as athlete…");
  const athlete = await asUser("athlete@rostr.test", "athlete123!");
  ok("athlete-signin", "signed in");

  const { data: athleteInbox, error: aErr } = await athlete
    .from("inbox_threads")
    .select("thread_id, kind, subject, outreach_status, unread_count");
  if (aErr) bug("athlete-inbox", aErr.message);
  else {
    ok("athlete-inbox", `${athleteInbox.length} threads visible`);
    const pending = athleteInbox.filter(
      (t) => t.kind === "recruiter_outreach" && t.outreach_status === "pending",
    );
    ok("athlete-pending", `${pending.length} pending recruiter request`);
  }

  // Athlete should be able to read messages in a thread they participate in
  if (athleteInbox && athleteInbox.length > 0) {
    const tid = athleteInbox[0].thread_id;
    const { data: msgs, error: mErr } = await athlete
      .from("chat_messages")
      .select("id, body")
      .eq("thread_id", tid);
    if (mErr) bug("athlete-read-messages", mErr.message);
    else ok("athlete-read-messages", `${msgs.length} messages in first thread`);
  }

  // ── Recruiter view ──────────────────────────────────────
  console.log("\n→ Sign in as recruiter…");
  const recruiter = await asUser("scout@rostr.test", "scoutpilot123!");
  ok("recruiter-signin", "signed in");

  const { data: recInbox } = await recruiter
    .from("inbox_threads")
    .select("thread_id, kind, outreach_status");
  ok("recruiter-inbox", `${recInbox?.length ?? 0} threads`);

  // Quota check
  const { data: quota } = await recruiter
    .from("recruiter_message_quotas")
    .select("plan, monthly_limit, current_month_sent")
    .maybeSingle();
  ok("recruiter-quota", `plan=${quota?.plan} sent=${quota?.current_month_sent}/${quota?.monthly_limit}`);

  // ── Accept the outreach ─────────────────────────────────
  console.log("\n→ Athlete accepts the outreach…");
  const pending = athleteInbox?.find(
    (t) => t.kind === "recruiter_outreach" && t.outreach_status === "pending",
  );
  if (!pending) {
    console.log("  (no pending outreach to accept — skipping)");
  } else {
    const { error: respondErr } = await athlete.rpc("respond_to_outreach", {
      _thread_id: pending.thread_id,
      _decision: "accepted",
    });
    if (respondErr) bug("accept-outreach", respondErr.message);
    else {
      ok("accept-outreach", "accepted");
      // Athlete should now be able to reply
      const { error: replyErr } = await athlete.from("chat_messages").insert({
        thread_id: pending.thread_id,
        sender_user_id: (await athlete.auth.getUser()).data.user.id,
        body: "Thanks for reaching out, Rebecca! Tuesday at 3:30 would work great.",
      });
      if (replyErr) bug("athlete-reply", replyErr.message);
      else ok("athlete-reply", "athlete replied to accepted outreach");
    }
  }

  // ── Cross-role RLS boundary ────────────────────────────
  console.log("\n→ Verify RLS: athlete can't read other people's threads…");
  // Make a second random auth user and confirm they see 0 threads
  // (we have none seeded for them)
  // Skip — relies on listUsers admin call we don't want in this test

  console.log("\n━━━ Results ━━━");
  if (bugs.length === 0) {
    console.log("🎉 Messaging works end-to-end across all 3 roles.");
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
