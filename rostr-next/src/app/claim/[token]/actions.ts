"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * claimPlayerAction — called after a visitor signs up / in on the
 * /claim/[token] page. Invokes the DB-side claim_player_by_token
 * function which atomically:
 *   1. Verifies the token matches an unclaimed player row
 *   2. Sets claimed_by_user_id = auth.uid()
 *   3. Returns the player's profile_slug for redirect.
 */
export async function claimPlayerAction(
  token: string,
): Promise<{ error: string | null; redirectTo?: string }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to sign in first." };

  const { data, error } = await supabase.rpc("claim_player_by_token", {
    _token: token,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/invalid_token/.test(msg)) return { error: "This claim link isn't valid." };
    if (/already_claimed/.test(msg))
      return { error: "This profile is already linked to another account." };
    if (/not_signed_in/.test(msg)) return { error: "Sign in before claiming." };
    return { error: msg || "Couldn't claim profile." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const slug = row?.profile_slug as string | undefined;

  revalidatePath("/me");
  revalidatePath(`/p/${slug ?? ""}`);
  return {
    error: null,
    redirectTo: slug ? `/me?claimed=${slug}` : "/me",
  };
}

/**
 * fetchClaimPreview — public read (via SECURITY DEFINER RPC) so the
 * claim page can show "Claim profile for Marcus Johnson · #21" before
 * the visitor authenticates.
 */
export async function fetchClaimPreview(
  token: string,
): Promise<{
  firstName: string;
  lastName: string;
  jersey: number | null;
  grade: number | null;
  teamName: string;
  alreadyClaimed: boolean;
} | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_player_preview_by_token", {
    _token: token,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    jersey: row.jersey,
    grade: row.grade,
    teamName: row.team_name,
    alreadyClaimed: Boolean(row.already_claimed),
  };
}

/**
 * regenerateClaimTokenAction — coach-only. Rotates a player's claim
 * token (e.g. if the old link was shared with the wrong person or the
 * player already claimed but you want a new link for a different
 * parent/guardian).
 */
export async function regenerateClaimTokenAction(
  playerId: string,
): Promise<{ error: string | null; newToken?: string }> {
  const supabase = createSupabaseServerClient();
  // Relies on existing "Coaches can update player" policies. The token
  // column has a DEFAULT that generates a new value — setting it to
  // DEFAULT via an UPDATE with the default expression.
  const { data, error } = await supabase
    .from("players")
    .update({
      // Explicitly generate a new token in SQL via a subquery would
      // require rpc; simpler path: do it client-side as base64 of
      // random bytes, then update.
      claim_token: randomHexToken(),
      claimed_by_user_id: null,
      claimed_at: null,
    })
    .eq("id", playerId)
    .select("claim_token")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't rotate token." };
  revalidatePath(`/app/roster`);
  return { error: null, newToken: data.claim_token };
}

function randomHexToken(): string {
  // 24 hex chars = 12 random bytes — matches the SQL default.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * fetchClaimTokenAction — coach-only. Reads a player's current claim
 * token so the Roster slideover can build the shareable URL to copy.
 */
export async function fetchClaimTokenAction(
  playerId: string,
): Promise<{ error: string | null; token?: string; claimed?: boolean }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("claim_token, claimed_by_user_id")
    .eq("id", playerId)
    .maybeSingle();
  if (error || !data) return { error: error?.message ?? "Couldn't fetch claim token." };
  return {
    error: null,
    token: data.claim_token as string,
    claimed: Boolean(data.claimed_by_user_id),
  };
}

/**
 * After a successful claim, redirect the user to their /me page where
 * they can see their schedule + profile. Wrapped so the claim page can
 * issue a server-side redirect.
 */
export async function redirectAfterClaim(redirectTo: string): Promise<never> {
  redirect(redirectTo);
}
