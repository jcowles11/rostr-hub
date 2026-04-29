"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentRecruiter,
  searchPlayers,
  markSavedSearchViewed,
} from "@/lib/services/recruiter";
import type { SearchFilters } from "@/lib/services/recruiter";

/**
 * Recruiter server actions — /scout surface.
 */

// ── Onboarding ────────────────────────────────────────────────────

export interface CreateRecruiterInput {
  fullName: string;
  organizationName: string;
  organizationShort?: string;
  organizationDivision:
    | "d1"
    | "d2"
    | "d3"
    | "naia"
    | "juco"
    | "pro"
    | "club"
    | "other";
  title?: string;
  sport?: string;
  region?: string;
}

export async function createRecruiterAction(
  input: CreateRecruiterInput,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (!input.fullName.trim() || !input.organizationName.trim()) {
    return { error: "Name and organization are required." };
  }

  // Seed an initials short-code from org name if not provided
  const initials =
    input.organizationShort?.trim() ||
    input.organizationName
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 4)
      .toUpperCase();

  const { error } = await supabase.from("recruiters").insert({
    user_id: user.id,
    full_name: input.fullName.trim(),
    organization_name: input.organizationName.trim(),
    organization_short: initials,
    organization_division: input.organizationDivision,
    title: input.title?.trim() || null,
    sport: input.sport?.trim() || "Baseball",
    region: input.region?.trim() || null,
    contact_email: user.email,
    avatar_color: "#3a6ea8", // sky for recruiters by default
  });
  if (error) return { error: `Couldn't create profile: ${error.message}` };

  revalidatePath("/scout", "layout");
  redirect("/scout");
}

// ── List CRUD ─────────────────────────────────────────────────────

export async function createListAction(input: {
  name: string;
  emoji?: string;
  color?: string;
  description?: string;
}): Promise<{ error: string | null; listId?: string }> {
  const rec = await getCurrentRecruiter();
  if (!rec) return { error: "Not a recruiter." };
  if (!input.name.trim()) return { error: "List name required." };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("recruiter_lists")
    .insert({
      recruiter_id: rec.id,
      name: input.name.trim(),
      emoji: input.emoji ?? null,
      color: input.color ?? "#c83a3a",
      description: input.description?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't create." };

  revalidatePath("/scout/lists");
  revalidatePath("/scout");
  return { error: null, listId: data.id };
}

export async function deleteListAction(
  listId: string,
): Promise<{ error: string | null }> {
  const rec = await getCurrentRecruiter();
  if (!rec) return { error: "Not a recruiter." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("recruiter_lists")
    .delete()
    .eq("id", listId)
    .eq("recruiter_id", rec.id);
  if (error) return { error: error.message };
  revalidatePath("/scout/lists");
  return { error: null };
}

export async function togglePlayerInListAction(
  listId: string,
  playerId: string,
  add: boolean,
): Promise<{ error: string | null }> {
  const rec = await getCurrentRecruiter();
  if (!rec) return { error: "Not a recruiter." };
  const supabase = createSupabaseServerClient();

  if (add) {
    const { error } = await supabase
      .from("recruiter_list_players")
      .insert({ list_id: listId, player_id: playerId });
    if (error && !/duplicate key/.test(error.message)) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("recruiter_list_players")
      .delete()
      .eq("list_id", listId)
      .eq("player_id", playerId);
    if (error) return { error: error.message };
  }

  revalidatePath(`/scout/lists/${listId}`);
  revalidatePath("/scout/lists");
  revalidatePath("/scout");
  return { error: null };
}

// ── Saved searches ────────────────────────────────────────────────

export async function saveSearchAction(input: {
  name: string;
  filters: SearchFilters;
  alertEmail?: boolean;
}): Promise<{ error: string | null; searchId?: string }> {
  const rec = await getCurrentRecruiter();
  if (!rec) return { error: "Not a recruiter." };
  if (!input.name.trim()) return { error: "Search name required." };
  const supabase = createSupabaseServerClient();

  // Seed the baseline: snapshot the current match set so the first
  // "new matches" diff reflects players added AFTER the search was
  // saved, not the ones already visible to the recruiter.
  const { players } = await searchPlayers({ ...input.filters, limit: 500 });
  const baselineIds = players.map((p) => p.id);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("recruiter_saved_searches")
    .insert({
      recruiter_id: rec.id,
      name: input.name.trim(),
      filters: input.filters,
      alert_email: input.alertEmail ?? false,
      last_run_at: now,
      last_viewed_at: now,
      last_result_count: baselineIds.length,
      last_run_player_ids: baselineIds,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't save." };
  revalidatePath("/scout/searches");
  revalidatePath("/scout");
  return { error: null, searchId: data.id };
}

/**
 * Called after the recruiter opens a saved search and sees the
 * results. Rolls the baseline forward so subsequent diffs only show
 * players newly matching since now.
 */
export async function markSavedSearchViewedAction(
  searchId: string,
  currentPlayerIds: string[],
): Promise<{ error: string | null }> {
  const rec = await getCurrentRecruiter();
  if (!rec) return { error: "Not a recruiter." };
  // Double-check ownership — markSavedSearchViewed doesn't enforce it,
  // only RLS does, so we sanity-check here.
  const supabase = createSupabaseServerClient();
  const { data: owned } = await supabase
    .from("recruiter_saved_searches")
    .select("id")
    .eq("id", searchId)
    .eq("recruiter_id", rec.id)
    .maybeSingle();
  if (!owned) return { error: "Not your search." };

  await markSavedSearchViewed(searchId, currentPlayerIds);
  revalidatePath("/scout/searches");
  revalidatePath("/scout");
  return { error: null };
}

export async function deleteSavedSearchAction(
  searchId: string,
): Promise<{ error: string | null }> {
  const rec = await getCurrentRecruiter();
  if (!rec) return { error: "Not a recruiter." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("recruiter_saved_searches")
    .delete()
    .eq("id", searchId)
    .eq("recruiter_id", rec.id);
  if (error) return { error: error.message };
  revalidatePath("/scout/searches");
  return { error: null };
}

// ── View tracking ─────────────────────────────────────────────────

export async function trackPlayerViewAction(
  playerId: string,
): Promise<{ error: string | null }> {
  const rec = await getCurrentRecruiter();
  if (!rec) return { error: null }; // silent no-op if not a recruiter
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("recruiter_views")
    .insert({ recruiter_id: rec.id, player_id: playerId });
  if (error) return { error: error.message };
  return { error: null };
}
