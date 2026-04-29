import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Player profile extras: media (avatar/header/video), commitment status,
 * and announcement feed. All fields land on the public /p/[handle]
 * profile and on the coach-facing roster.
 */

export interface PlayerProfileMedia {
  avatarUrl: string | null;
  headerUrl: string | null;
  highlightVideoUrl: string | null;
  commitmentStatus: "uncommitted" | "committed" | "decommitted" | "decided" | null;
  commitmentSchool: string | null;
  commitmentYear: number | null;
  commitmentNote: string | null;
}

export async function fetchPlayerProfileMedia(
  playerId: string,
): Promise<PlayerProfileMedia | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select(
      "avatar_url, header_url, highlight_video_url, commitment_status, commitment_school, commitment_year, commitment_note",
    )
    .eq("id", playerId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    avatarUrl: data.avatar_url ?? null,
    headerUrl: data.header_url ?? null,
    highlightVideoUrl: data.highlight_video_url ?? null,
    commitmentStatus: (data.commitment_status ?? null) as
      | PlayerProfileMedia["commitmentStatus"],
    commitmentSchool: data.commitment_school ?? null,
    commitmentYear: data.commitment_year ?? null,
    commitmentNote: data.commitment_note ?? null,
  };
}

export interface PlayerAnnouncement {
  id: string;
  playerId: string;
  postedBy: string | null;
  kind:
    | "commitment"
    | "milestone"
    | "update"
    | "video"
    | "achievement"
    | "offer";
  title: string;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  pinned: boolean;
  createdAt: string;
}

export async function fetchPlayerAnnouncements(
  playerId: string,
  limit = 20,
): Promise<PlayerAnnouncement[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_announcements")
    .select(
      "id, player_id, posted_by, kind, title, body, image_url, link_url, pinned, created_at",
    )
    .eq("player_id", playerId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    postedBy: r.posted_by,
    kind: r.kind as PlayerAnnouncement["kind"],
    title: r.title,
    body: r.body,
    imageUrl: r.image_url,
    linkUrl: r.link_url,
    pinned: r.pinned,
    createdAt: r.created_at,
  }));
}

/**
 * Given a highlight video URL, figure out which provider and build
 * the correct embed URL. Supports YouTube, Hudl, Vimeo. Returns null
 * for unrecognized URLs — the caller should fall back to showing the
 * link as plain text.
 */
export interface VideoEmbed {
  provider: "youtube" | "hudl" | "vimeo" | "unknown";
  embedUrl: string | null;
  thumbnailUrl: string | null;
}

export function resolveVideoEmbed(url: string | null): VideoEmbed | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube: https://youtube.com/watch?v=XXX or https://youtu.be/XXX
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (!id) return { provider: "youtube", embedUrl: null, thumbnailUrl: null };
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (!id) return { provider: "youtube", embedUrl: null, thumbnailUrl: null };
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }

    // Hudl: https://www.hudl.com/video/3/xxxx/yyyy — use their embed hostname
    if (host === "hudl.com" || host.endsWith(".hudl.com")) {
      return {
        provider: "hudl",
        embedUrl: url.replace("/video/", "/embed/video/"),
        thumbnailUrl: null,
      };
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return {
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${id}`,
        thumbnailUrl: null,
      };
    }

    return { provider: "unknown", embedUrl: null, thumbnailUrl: null };
  } catch {
    return { provider: "unknown", embedUrl: null, thumbnailUrl: null };
  }
}
