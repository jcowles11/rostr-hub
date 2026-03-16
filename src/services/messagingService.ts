/**
 * Messaging Service
 *
 * Extracts messaging-related Supabase mutations from page components.
 * Used by: PlayerMessagesPage.tsx
 */
import { supabase } from "@/integrations/supabase/client";

// ── Mutations ──────────────────────────────────────────────────────

/** Send a message in a conversation. */
export async function sendPlayerMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_role: "player",
    sender_id: senderId,
    body,
  });
  return { error: error?.message ?? null };
}

/** Send a message in a conversation (scout role). */
export async function sendScoutMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: params.conversationId,
    sender_role: "scout",
    sender_id: params.senderId,
    body: params.body,
  });
  return { error: error?.message ?? null };
}

/** Send a single conversation request (scout to player). */
export async function sendConversationRequest(params: {
  scoutId: string;
  playerId: string;
  initialMessage: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("conversation_requests").insert({
    scout_id: params.scoutId,
    player_id: params.playerId,
    initial_message: params.initialMessage,
  });
  return { error: error?.message ?? null };
}

/** Send bulk conversation requests (scout to multiple players). */
export async function bulkSendConversationRequests(params: {
  scoutId: string;
  playerIds: string[];
  initialMessage: string;
}): Promise<{ error: string | null }> {
  const inserts = params.playerIds.map((player_id) => ({
    scout_id: params.scoutId,
    player_id,
    initial_message: params.initialMessage,
  }));
  const { error } = await supabase
    .from("conversation_requests")
    .insert(inserts);
  return { error: error?.message ?? null };
}
