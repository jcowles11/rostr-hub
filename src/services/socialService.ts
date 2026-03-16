/**
 * Social Service
 *
 * Extracts social-related mutations (posts, likes, comments, follows)
 * from page/component files into a service layer.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

export interface ServiceResult<T = null> {
  data?: T;
  error: string | null;
}

// ── Posts ───────────────────────────────────────────────────────────

/** Upload media files for a post and return public URLs. */
export async function uploadPostMedia(
  userId: string,
  files: File[]
): Promise<ServiceResult<string[]>> {
  const mediaUrls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("post-media")
      .upload(path, file);
    if (uploadErr) return { data: [], error: uploadErr.message };
    const { data: urlData } = supabase.storage
      .from("post-media")
      .getPublicUrl(path);
    mediaUrls.push(urlData.publicUrl);
  }
  return { data: mediaUrls, error: null };
}

/** Look up the player_id for a given user_id. */
export async function getPlayerIdForUser(
  userId: string
): Promise<ServiceResult<string | null>> {
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data?.id || null, error: null };
}

/** Insert a new post. */
export async function createPost(params: {
  authorId: string;
  playerId: string | null;
  postType: string;
  caption: string | null;
  mediaUrls: string[];
}): Promise<ServiceResult> {
  const { error } = await supabase.from("posts").insert({
    author_id: params.authorId,
    player_id: params.playerId,
    post_type: params.postType,
    caption: params.caption,
    media_urls: params.mediaUrls,
  });
  if (error) return { error: error.message };
  return { error: null };
}

/** Delete a post by id. */
export async function deletePost(postId: string): Promise<ServiceResult> {
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId);
  if (error) return { error: error.message };
  return { error: null };
}

// ── Likes ──────────────────────────────────────────────────────────

/** Add a like to a post. */
export async function likePost(
  postId: string,
  userId: string
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("post_likes")
    .insert({ post_id: postId, user_id: userId });
  if (error) return { error: error.message };
  return { error: null };
}

/** Remove a like from a post. */
export async function unlikePost(
  postId: string,
  userId: string
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  return { error: null };
}

// ── Comments ───────────────────────────────────────────────────────

/** Add a comment to a post, returns the inserted row. */
export async function addComment(
  postId: string,
  userId: string,
  content: string
): Promise<ServiceResult<{ id: string; user_id: string; content: string; created_at: string; post_id: string }>> {
  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: userId, content })
    .select()
    .single();
  if (error) return { error: error.message };
  return { data, error: null };
}

// ── Follows ────────────────────────────────────────────────────────

/** Follow a player. */
export async function followPlayer(
  followerId: string,
  followedPlayerId: string
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, followed_player_id: followedPlayerId });
  if (error) return { error: error.message };
  return { error: null };
}

/** Unfollow a player. */
export async function unfollowPlayer(
  followerId: string,
  followedPlayerId: string
): Promise<ServiceResult> {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followed_player_id", followedPlayerId);
  if (error) return { error: error.message };
  return { error: null };
}
