/**
 * Pure types + framework-free helpers for the player profile.
 *
 * Lives separately from `player-profile.ts` because that module imports
 * `@/lib/supabase/server`, which pulls `next/headers` — server-only.
 * Client components can't transit that without webpack throwing.
 *
 * Anything safe to use from BOTH client + server goes here.
 * Anything that talks to Supabase goes in `player-profile.ts`.
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

export type IntendedLevel = "D1" | "D2" | "D3" | "NAIA" | "Juco" | "Open" | "Other";

export interface PlayerAcademics {
  gpa: string | null;
  satScore: number | null;
  actScore: number | null;
  classRankNumerator: number | null;
  classRankDenominator: number | null;
  intendedLevel: IntendedLevel | null;
  schoolLogoUrl: string | null;
  bio: string | null;
}

/**
 * Privacy switches per profile (migration 34).
 * - profilePublic: required before anything renders publicly
 * - showAcademics: gates GPA / SAT / ACT / class rank / intended level
 *   even when the profile is public
 * - showContactInfo: gates phone / email / social handles
 *
 * All default false. Player flips them explicitly from /me/profile.
 */
export interface PlayerPrivacy {
  profilePublic: boolean;
  showAcademics: boolean;
  showContactInfo: boolean;
}

/**
 * Player-reported career stats from BEFORE Rostr (or any season the
 * player wants to claim that wasn't tracked here). Always rendered
 * under a "Player Reported" header — never mixed with verified game
 * stats produced by the Live scoring engine. Migration 34, JSONB
 * column on `players`.
 */
export interface PlayerPriorStat {
  /** Free-form season label, e.g. "2024" or "Sophomore". */
  season: string;
  /** Free-form team / level, e.g. "JV", "Varsity", "Travel". */
  level: string | null;
  /** Hitting line — text so any format flows. */
  ba: string | null;
  ops: string | null;
  hr: string | null;
  rbi: string | null;
  /** Pitching summary text. */
  pitching: string | null;
  /** Free-form notes (league rank, awards, etc.). */
  context: string | null;
}

export interface PlayerHighlight {
  id: string;
  playerId: string;
  url: string;
  caption: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  createdAt: string;
  /**
   * Coach-verified signal (migration 35). When true, a coach in the
   * player's program reviewed and vouched for this clip — the public
   * profile shows the VerifiedBadge atom; otherwise PlayerReportedBadge.
   * Defaults false.
   */
  verifiedByCoach: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  /**
   * Display name of the coach who verified this clip, resolved at
   * fetch time via coaches.full_name. May be null when:
   *   - clip is not verified
   *   - the verifying coach has been removed from the program
   *   - the coach record can't be found for any reason
   * UI falls back to "Coach Verified" when null.
   */
  verifiedByName: string | null;
}

/**
 * Player-typed public contact + social handles (migration 35).
 *
 * All fields optional, all stored as plain strings (free-form so a
 * player can paste "@handle" or a full URL — render layer normalizes
 * to a clickable link). Visibility is gated on the public profile by
 * BOTH `profile_public` AND `show_contact_info` — defaults all-OFF.
 *
 * Card is always rendered with the PlayerReportedBadge atom — never
 * verified.
 */
export interface PlayerContactInfo {
  email: string | null;
  phone: string | null;
  twitter: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  /** Reserved for X (formerly Twitter) when the user wants to disambiguate. */
  x: string | null;
  website: string | null;
}

/**
 * Empty contact-info object — safe default for fetchers when the
 * column is missing or all-null. Centralized so the editor + public
 * render don't drift.
 */
export function emptyContactInfo(): PlayerContactInfo {
  return {
    email: null,
    phone: null,
    twitter: null,
    instagram: null,
    tiktok: null,
    youtube: null,
    x: null,
    website: null,
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

export interface VideoEmbed {
  provider:
    | "youtube"
    | "hudl"
    | "vimeo"
    | "tiktok"
    | "instagram"
    | "x"
    | "unknown";
  /**
   * Embed URL for an iframe. Some providers (TikTok / Instagram / X)
   * don't expose a clean iframe embed without their script SDKs, so we
   * leave embedUrl null and the public render falls back to a thumb +
   * "Open" link. Better than embedding a broken iframe.
   */
  embedUrl: string | null;
  thumbnailUrl: string | null;
}

/**
 * Pure URL parser — figures out the video provider and builds the
 * correct embed URL. No DB / Supabase / cookies — safe to call from
 * client components.
 */
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

    // TikTok — https://www.tiktok.com/@user/video/1234... — embed
    // requires their JS SDK which we don't load. Recognize the provider
    // so we can badge + link, and render a placeholder thumbnail.
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      return { provider: "tiktok", embedUrl: null, thumbnailUrl: null };
    }

    // Instagram — Reels / posts. Same story as TikTok: embed requires
    // their SDK. Link out instead of breaking iframe.
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      return { provider: "instagram", embedUrl: null, thumbnailUrl: null };
    }

    // X (formerly Twitter). Recognize x.com + twitter.com.
    if (
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com")
    ) {
      return { provider: "x", embedUrl: null, thumbnailUrl: null };
    }

    return { provider: "unknown", embedUrl: null, thumbnailUrl: null };
  } catch {
    return { provider: "unknown", embedUrl: null, thumbnailUrl: null };
  }
}
