// @ts-check
/**
 * test-claim-and-invite.mjs
 *
 * Integration test for the player claim + coach invite flows.
 * Signs in as the head coach, exercises the end-to-end paths:
 *   1. Fetch a player's claim token
 *   2. Create a coach invite
 *   3. Fetch invite preview (anon)
 *   4. Simulate a second user accepting the invite
 *   5. Simulate that user claiming a player profile
 */

import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzE1OTgsImV4cCI6MjA4OTI0NzU5OH0.P0lJCaeOHmZNIbQtYDqvJKmNCjKF7P4fG92Jvw3z2CM";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3MTU5OCwiZXhwIjoyMDg5MjQ3NTk4fQ.rs0aiShj2COBIcn484pJsRO4Hphr9PX2QTV3gpxVNZI";

const coachClient = createClient(URL, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const svc = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const bugs = [];
function bug(area, msg, detail) {
  bugs.push({ area, msg });
  console.log(`  ❌ [${area}] ${msg}`);
  if (detail) console.log(`     ${JSON.stringify(detail).slice(0, 200)}`);
}
function ok(area, msg) {
  console.log(`  ✅ [${area}] ${msg}`);
}

async function main() {
  console.log("━━━ Claim + Invite integration test ━━━\n");

  // Sign in as coach
  console.log("→ Signing in as head coach…");
  const signIn = await coachClient.auth.signInWithPassword({
    email: "coach@rostr.test",
    password: "rostrpilot123!",
  });
  if (signIn.error) return bug("auth", signIn.error.message);
  ok("auth", `Head coach signed in`);

  // Fetch a player + their claim token
  console.log("\n→ Fetching a player to claim…");
  const { data: players, error: pErr } = await coachClient
    .from("players")
    .select("id, first_name, last_name, claim_token, profile_slug")
    .limit(2);
  if (pErr || !players || players.length < 2) return bug("players", "can't fetch players", pErr);
  const player = players[0];
  const player2 = players[1];
  ok("players", `Got ${player.first_name} ${player.last_name} · token=${player.claim_token.slice(0, 8)}…`);

  // Preview claim via RPC (anon-safe)
  console.log("\n→ Testing claim preview RPC (anon)…");
  const anonClient = createClient(URL, ANON);
  const { data: preview, error: previewErr } = await anonClient.rpc(
    "get_player_preview_by_token",
    { _token: player.claim_token },
  );
  if (previewErr) bug("rpc-preview", previewErr.message, previewErr);
  else if (!preview || (Array.isArray(preview) && preview.length === 0))
    bug("rpc-preview", "preview returned empty");
  else {
    const row = Array.isArray(preview) ? preview[0] : preview;
    ok("rpc-preview", `Preview: ${row.first_name} ${row.last_name} · ${row.team_name} · claimed=${row.already_claimed}`);
  }

  // Create a second test user (the "player" who will claim)
  console.log("\n→ Creating a test player auth user…");
  const playerEmail = `player_test_${Date.now()}@rostr.test`;
  const { data: createRes, error: createErr } = await svc.auth.admin.createUser({
    email: playerEmail,
    password: "testpass123!",
    email_confirm: true,
  });
  if (createErr || !createRes?.user) return bug("create-player", "couldn't create", createErr);
  ok("create-player", `Created ${playerEmail}`);

  // Sign in as the new player user
  const playerClient = createClient(URL, ANON);
  const { error: pSignErr } = await playerClient.auth.signInWithPassword({
    email: playerEmail,
    password: "testpass123!",
  });
  if (pSignErr) return bug("player-signin", pSignErr.message);
  ok("player-signin", "Signed in as new player");

  // Claim the player profile
  console.log("\n→ Calling claim_player_by_token RPC…");
  const { data: claimRes, error: claimErr } = await playerClient.rpc(
    "claim_player_by_token",
    { _token: player.claim_token },
  );
  if (claimErr) bug("rpc-claim", claimErr.message, claimErr);
  else {
    const row = Array.isArray(claimRes) ? claimRes[0] : claimRes;
    ok("rpc-claim", `Claim succeeded, profile_slug=${row.profile_slug}`);
  }

  // Verify claim sticks
  const { data: verify } = await svc
    .from("players")
    .select("claimed_by_user_id, claimed_at")
    .eq("id", player.id)
    .maybeSingle();
  if (!verify?.claimed_by_user_id) bug("claim-verify", "claim didn't persist");
  else ok("claim-verify", `claimed_by_user_id set to ${verify.claimed_by_user_id.slice(0, 8)}…`);

  // Try claiming a SECOND player as the same user (should be allowed —
  // a user can claim multiple player rows in theory, e.g. multi-program).
  // For now our UX supports one — but the RPC allows either case.
  // Skipping that test.

  // Try claiming someone else's already-claimed profile (should error)
  console.log("\n→ Testing double-claim error handling…");
  const otherEmail = `player_test2_${Date.now()}@rostr.test`;
  await svc.auth.admin.createUser({
    email: otherEmail,
    password: "testpass123!",
    email_confirm: true,
  });
  const otherClient = createClient(URL, ANON);
  await otherClient.auth.signInWithPassword({
    email: otherEmail,
    password: "testpass123!",
  });
  const { error: doubleClaimErr } = await otherClient.rpc("claim_player_by_token", {
    _token: player.claim_token,
  });
  if (!doubleClaimErr) bug("double-claim", "expected error on already-claimed, got none");
  else if (!/already_claimed/.test(doubleClaimErr.message))
    bug("double-claim", `wrong error: ${doubleClaimErr.message}`);
  else ok("double-claim", "Correctly rejected: already_claimed");

  // ── Coach invite flow ─────────────────────────────────────

  console.log("\n→ Creating a coach invite…");
  const { data: inviteRow, error: iErr } = await coachClient
    .from("coach_invites")
    .insert({
      program_id: (await coachClient.from("coaches").select("program_id").limit(1)).data?.[0]?.program_id,
      invited_email: "assistant@rostr.test",
      invited_name: "Coach Tester",
      role: "assistant_coach",
    })
    .select("id, invite_token")
    .single();
  if (iErr || !inviteRow) return bug("invite-create", iErr?.message ?? "unknown", iErr);
  ok("invite-create", `Token ${inviteRow.invite_token.slice(0, 8)}…`);

  // Preview invite (anon)
  const { data: invPreview, error: invPreviewErr } = await anonClient.rpc(
    "get_invite_preview_by_token",
    { _token: inviteRow.invite_token },
  );
  if (invPreviewErr) bug("invite-preview", invPreviewErr.message, invPreviewErr);
  else if (!invPreview || (Array.isArray(invPreview) && invPreview.length === 0))
    bug("invite-preview", "empty preview");
  else {
    const row = Array.isArray(invPreview) ? invPreview[0] : invPreview;
    ok("invite-preview", `Program=${row.program_name} · role=${row.role}`);
  }

  // Accept invite as a new user
  const assistantEmail = `assistant_${Date.now()}@rostr.test`;
  await svc.auth.admin.createUser({
    email: assistantEmail,
    password: "asstpass123!",
    email_confirm: true,
  });
  const asstClient = createClient(URL, ANON);
  await asstClient.auth.signInWithPassword({
    email: assistantEmail,
    password: "asstpass123!",
  });
  const { data: acceptRes, error: acceptErr } = await asstClient.rpc(
    "accept_coach_invite",
    { _token: inviteRow.invite_token },
  );
  if (acceptErr) bug("invite-accept", acceptErr.message, acceptErr);
  else ok("invite-accept", `Accepted, program_id=${String(acceptRes).slice(0, 8)}…`);

  // Verify the assistant now has a coach row
  const { data: asstUser } = await svc.auth.admin.listUsers();
  const asstAuthId = asstUser?.users?.find((u) => u.email === assistantEmail)?.id;
  if (asstAuthId) {
    const { data: asstCoach } = await svc
      .from("coaches")
      .select("id, role, full_name")
      .eq("user_id", asstAuthId);
    if (!asstCoach || asstCoach.length === 0)
      bug("invite-coach-row", "no coach row after accept");
    else ok("invite-coach-row", `Coach row created · role=${asstCoach[0].role}`);
  }

  // Cleanup: delete test users + unassign claim for re-runs
  console.log("\n→ Cleaning up test users…");
  await svc.from("players").update({
    claimed_by_user_id: null,
    claimed_at: null,
  }).eq("id", player.id);
  for (const email of [playerEmail, otherEmail, assistantEmail]) {
    const user = (await svc.auth.admin.listUsers()).data?.users?.find(
      (u) => u.email === email,
    );
    if (user) await svc.auth.admin.deleteUser(user.id);
  }
  await svc.from("coach_invites").delete().eq("id", inviteRow.id);
  ok("cleanup", "test users + artifacts removed");

  console.log("\n━━━ Results ━━━");
  if (bugs.length === 0) {
    console.log("🎉 Claim + invite flows work end-to-end.");
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
