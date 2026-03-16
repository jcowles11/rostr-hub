/**
 * Scout Service
 *
 * Extracts scout-related mutations (lists, saved prospects, profile updates)
 * from page/component files into a service layer.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

export interface ServiceResult<T = null> {
  data?: T;
  error: string | null;
}

// ── Scout Lists ────────────────────────────────────────────────────

/** Create a new scout list. */
export async function createScoutList(params: {
  scoutId: string;
  name: string;
  description: string | null;
}): Promise<ServiceResult> {
  const { error } = await supabase.from("scout_lists").insert({
    scout_id: params.scoutId,
    name: params.name,
    description: params.description,
  });
  if (error) return { error: error.message };
  return { error: null };
}

/** Delete a scout list. */
export async function deleteScoutList(listId: string): Promise<ServiceResult> {
  const { error } = await supabase
    .from("scout_lists")
    .delete()
    .eq("id", listId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Remove a member from a scout list by member id. */
export async function removeScoutListMember(memberId: string): Promise<ServiceResult> {
  const { error } = await supabase
    .from("scout_list_members")
    .delete()
    .eq("id", memberId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Add a single player to a scout list. */
export async function addToScoutList(
  listId: string,
  playerId: string
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("scout_list_members")
    .insert({ list_id: listId, player_id: playerId });
  if (error) return { error: error.message };
  return { error: null };
}

/** Add multiple players to a scout list (bulk). */
export async function bulkAddToScoutList(
  listId: string,
  playerIds: string[]
): Promise<ServiceResult> {
  const inserts = playerIds.map((player_id) => ({ list_id: listId, player_id }));
  const { error } = await supabase
    .from("scout_list_members")
    .insert(inserts);
  if (error) return { error: error.message };
  return { error: null };
}

// ── Saved Prospects ────────────────────────────────────────────────

/** Save a player as a prospect. */
export async function saveProspect(
  scoutId: string,
  playerId: string
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("scout_saved_prospects")
    .insert({ scout_id: scoutId, player_id: playerId });
  if (error) return { error: error.message };
  return { error: null };
}

/** Update the status of a saved prospect. */
export async function updateProspectStatus(
  prospectId: string,
  status: string
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("scout_saved_prospects")
    .update({ status })
    .eq("id", prospectId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Update the notes of a saved prospect. */
export async function updateProspectNotes(
  prospectId: string,
  notes: string
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("scout_saved_prospects")
    .update({ notes })
    .eq("id", prospectId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Remove a saved prospect. */
export async function removeProspect(prospectId: string): Promise<ServiceResult> {
  const { error } = await supabase
    .from("scout_saved_prospects")
    .delete()
    .eq("id", prospectId);
  if (error) return { error: error.message };
  return { error: null };
}

// ── Scout Profile ──────────────────────────────────────────────────

/** Update a scout's profile. */
export async function updateScoutProfile(
  scoutId: string,
  fields: {
    full_name: string;
    organization_name: string;
    title: string | null;
    sport: string;
    division: string | null;
    location_city: string | null;
    location_state: string | null;
    recruiting_territories: string[];
    positions_recruiting: string[];
    contact_email: string | null;
    contact_phone: string | null;
  }
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("scouts")
    .update(fields)
    .eq("id", scoutId);
  if (error) return { error: error.message };
  return { error: null };
}
