/**
 * Data classification registry — the authoritative inventory of every
 * field Rostr collects on a player or coach, with sensitivity tier and
 * consent requirement.
 *
 * This file is the lawyer-reviewable surface. It exists in code (not a
 * Postgres table) for two reasons:
 *
 *   1. Reviewable in version control. Every change is a PR with a diff.
 *   2. Importable from the public-profile renderer so the same source
 *      of truth drives both legal documentation AND the runtime field
 *      filter that decides what's visible to anonymous viewers.
 *
 * The renderer in /p/[handle]/page.tsx calls `filterFieldsForPublic()`
 * (declared below) before sending any data to the client. The filter
 * keeps `public` fields, requires explicit consent for `consent-gated`
 * fields, and drops the rest.
 *
 * Adding a new player field? Register it here. Forgetting to register
 * is failure-safe: unknown fields are dropped from the public payload.
 */

// ── Sensitivity model ────────────────────────────────────────────

/**
 * Five tiers, ordered most-public → least-public.
 *
 *   public
 *     Always renderable on /p/<handle>. Examples: profile_slug,
 *     positions array, current grade. These are the equivalent of a
 *     yearbook entry — public-knowledge by convention in HS sports.
 *
 *   consent-gated
 *     Renderable on /p/<handle> ONLY when active parental consent
 *     covers the appropriate scope (e.g. "verified_metrics_external").
 *     Examples: verified measurables, verified prior-stat rows, the
 *     "Verified by Coach Martinez" attribution.
 *
 *   contact-gated
 *     Renderable ONLY when active consent includes 'recruiter_outreach'
 *     or 'public_profile' AND the player's `show_contact_info` flag is
 *     on. Examples: parent email, parent phone, social handles.
 *
 *   program-only
 *     Visible to coaches in the player's program. NEVER on /p/<handle>
 *     regardless of consent. Examples: coach evaluation notes,
 *     internal flags, medical notes.
 *
 *   pii-restricted
 *     Highest tier. Never on /p/<handle>. Visible only to head coach +
 *     program admin + the player themselves. Examples: SSN-equivalent
 *     identifiers (Rostr does not collect any today), full DOB if we
 *     ever collect it, parental contact info before consent.
 */
export type DataSensitivity =
  | "public"
  | "consent-gated"
  | "contact-gated"
  | "program-only"
  | "pii-restricted";

/**
 * Consent scopes used in parental_consent.consent_scope[]. Aligned to
 * the bands in the parent-facing /consent/[token] page.
 */
export type ConsentScope =
  | "public_profile"
  | "verified_metrics_external"
  | "scout_discovery"
  | "recruiter_outreach";

export interface PlayerDataField {
  /** Database column name (or composite key). */
  key: string;
  /** Human-readable label for the lawyer + the consent UI. */
  displayName: string;
  /** Sensitivity tier — drives the public-profile filter. */
  sensitivity: DataSensitivity;
  /**
   * Consent scope required to render this field publicly. Only
   * applicable when sensitivity is "consent-gated" or "contact-gated".
   * Multiple scopes = ANY of them grants access.
   */
  requiredConsent?: ConsentScope[];
  /**
   * Does this field plausibly constitute an "education record" under
   * FERPA when collected by a school-affiliated coach? Lawyer reviews.
   */
  schoolFERPAImpact: boolean;
  /**
   * Days to retain after the player leaves the program (released_at
   * is set or program is deleted). Null = indefinite (with annual
   * audit). Most operational data is short-retention; verified record
   * data is long-retention because it's the recruiting moat.
   */
  retentionDaysAfterRelease: number | null;
  /** Brief plain-English description for the lawyer's review. */
  notes?: string;
}

/**
 * The registry. EVERY player-touching field that's persisted in any
 * surface should be listed here. Filtering / consent / takedown all
 * key off this list.
 */
export const PLAYER_DATA_REGISTRY: Record<string, PlayerDataField> = {
  // ── Identity (mostly public — yearbook-level information) ──
  first_name: {
    key: "first_name",
    displayName: "First name",
    sensitivity: "public",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: null,
    notes: "Yearbook-public. Required for basic recognition.",
  },
  last_name: {
    key: "last_name",
    displayName: "Last name",
    sensitivity: "public",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: null,
  },
  profile_slug: {
    key: "profile_slug",
    displayName: "Profile URL handle",
    sensitivity: "public",
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: null,
    notes: "Player-chosen handle for /p/<handle>. Public by definition.",
  },
  player_number: {
    key: "player_number",
    displayName: "Jersey number",
    sensitivity: "public",
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 730,
  },
  positions: {
    key: "positions",
    displayName: "Positions",
    sensitivity: "public",
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 730,
  },
  bats: {
    key: "bats",
    displayName: "Bats (L/R/S)",
    sensitivity: "public",
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 730,
  },
  throws: {
    key: "throws",
    displayName: "Throws (L/R)",
    sensitivity: "public",
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 730,
  },

  // ── Demographics (FERPA-impacting) ──
  grade: {
    key: "grade",
    displayName: "Current grade",
    sensitivity: "public",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 730,
    notes: "Required for class-year context. Considered yearbook-level.",
  },
  birth_year: {
    key: "birth_year",
    displayName: "Birth year (year only)",
    sensitivity: "program-only",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 365,
    notes:
      "Optional. Used to determine adult vs minor for consent gating. We deliberately do NOT collect full DOB.",
  },
  graduation_year: {
    key: "graduation_year",
    displayName: "Expected graduation year",
    sensitivity: "public",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 730,
  },

  // ── Profile media (public when consented) ──
  avatar_url: {
    key: "avatar_url",
    displayName: "Profile photo URL",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 730,
  },
  header_url: {
    key: "header_url",
    displayName: "Profile header image URL",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 730,
  },
  highlight_video_url: {
    key: "highlight_video_url",
    displayName: "Single highlight video URL",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 1825,
  },
  school_logo_url: {
    key: "school_logo_url",
    displayName: "School logo URL",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 1825,
  },

  // ── Academic data (FERPA strict) ──
  gpa: {
    key: "gpa",
    displayName: "GPA",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 1825,
    notes:
      "FERPA-touching. Renders publicly only when show_academics flag is on AND parental consent for public_profile is active.",
  },
  sat_score: {
    key: "sat_score",
    displayName: "SAT score",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 1825,
  },
  act_score: {
    key: "act_score",
    displayName: "ACT score",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 1825,
  },
  class_rank_numerator: {
    key: "class_rank_numerator",
    displayName: "Class rank (numerator)",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 1825,
  },
  class_rank_denominator: {
    key: "class_rank_denominator",
    displayName: "Class rank (class size)",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 1825,
  },
  intended_level: {
    key: "intended_level",
    displayName: "Intended college level (D1/D2/etc.)",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 1825,
  },
  bio: {
    key: "bio",
    displayName: "Player-typed bio",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 1825,
  },

  // ── Verified game data (the recruiting moat) ──
  game_stats_verified: {
    key: "game_stats_verified",
    displayName: "Live-scored game stats (BA/OPS/ERA/etc.)",
    sensitivity: "consent-gated",
    requiredConsent: ["verified_metrics_external", "public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: null,
    notes: "Verified-by-construction (computed from coach-recorded events). Long retention — it's the long-term recruiting record.",
  },
  tryout_measurables: {
    key: "tryout_measurables",
    displayName: "Tryout measurables (60yd, EV, Velo, Pop, etc.)",
    sensitivity: "consent-gated",
    requiredConsent: ["verified_metrics_external", "public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: null,
  },
  verified_highlights: {
    key: "verified_highlights",
    displayName: "Coach-verified highlight clips",
    sensitivity: "consent-gated",
    requiredConsent: ["verified_metrics_external", "public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 1825,
  },
  verified_prior_stats: {
    key: "verified_prior_stats",
    displayName: "Coach-verified prior-season stats",
    sensitivity: "consent-gated",
    requiredConsent: ["verified_metrics_external", "public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 1825,
  },
  prior_stats_self_reported: {
    key: "prior_stats_self_reported",
    displayName: "Player-typed prior-season stats",
    sensitivity: "consent-gated",
    requiredConsent: ["public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 1825,
    notes: "Always badged 'Player Reported' — never as verified.",
  },

  // ── Contact + socials (most-restricted public-facing tier) ──
  contact_email: {
    key: "contact_email",
    displayName: "Contact email",
    sensitivity: "contact-gated",
    requiredConsent: ["recruiter_outreach", "public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 365,
  },
  contact_phone: {
    key: "contact_phone",
    displayName: "Contact phone",
    sensitivity: "contact-gated",
    requiredConsent: ["recruiter_outreach", "public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 365,
  },
  contact_socials: {
    key: "contact_socials",
    displayName: "Social handles (IG/TikTok/X/YouTube)",
    sensitivity: "contact-gated",
    requiredConsent: ["recruiter_outreach", "public_profile"],
    schoolFERPAImpact: false,
    retentionDaysAfterRelease: 365,
  },

  // ── Internal evaluation (program-only, never public) ──
  evaluation_notes: {
    key: "evaluation_notes",
    displayName: "Coach evaluation notes",
    sensitivity: "program-only",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 1825,
  },
  player_flag: {
    key: "player_flag",
    displayName: "Player flag (standout / needs-look / concern)",
    sensitivity: "program-only",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 730,
  },

  // NOTE: medical_notes, emergency_contact_name, emergency_contact_phone
  // were dropped from the schema by migration 40 per privacy counsel
  // review. Rostr does not collect health information or emergency
  // contact data. Schools and coaches must use other channels for those.

  // ── Roster / operational (program-only) ──
  roster_assignment: {
    key: "roster_assignment",
    displayName: "Roster level (Varsity/JV/Freshman)",
    sensitivity: "program-only",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 730,
    notes:
      "Could be public for adult athletes; conservatively program-only to avoid leaking cuts/JV demotions.",
  },
  released_at: {
    key: "released_at",
    displayName: "Released-from-program timestamp",
    sensitivity: "program-only",
    schoolFERPAImpact: true,
    retentionDaysAfterRelease: 730,
  },
};

// ── Filter helpers ───────────────────────────────────────────────

/**
 * Given a player record (any object) and the active consent scopes,
 * return a copy with only the fields the public viewer is allowed to
 * see. Unknown / unregistered keys are dropped — fail-safe behavior.
 */
export function filterFieldsForPublic<T extends Record<string, unknown>>(
  record: T,
  activeScopes: ConsentScope[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(record)) {
    const field = PLAYER_DATA_REGISTRY[key];
    if (!field) continue; // unregistered — drop

    if (field.sensitivity === "public") {
      out[key as keyof T] = value as T[keyof T];
      continue;
    }
    if (field.sensitivity === "consent-gated" || field.sensitivity === "contact-gated") {
      const required = field.requiredConsent ?? [];
      const allowed = required.some((s) => activeScopes.includes(s));
      if (allowed) {
        out[key as keyof T] = value as T[keyof T];
      }
      continue;
    }
    // program-only + pii-restricted are NEVER returned by this filter
  }
  return out;
}

/**
 * For a quick render-time check: is this field allowed to show given
 * the active consent scopes? Useful when the consumer is iterating a
 * known schema rather than spreading a record.
 */
export function isFieldVisibleToPublic(
  fieldKey: string,
  activeScopes: ConsentScope[],
): boolean {
  const field = PLAYER_DATA_REGISTRY[fieldKey];
  if (!field) return false;
  if (field.sensitivity === "public") return true;
  if (field.sensitivity === "consent-gated" || field.sensitivity === "contact-gated") {
    const required = field.requiredConsent ?? [];
    return required.some((s) => activeScopes.includes(s));
  }
  return false;
}

/**
 * For COMPLIANCE.md generation. Lists every field with FERPA-impact
 * marked so the lawyer can review the school-data subset.
 */
export function ferpaImpactingFields(): PlayerDataField[] {
  return Object.values(PLAYER_DATA_REGISTRY).filter((f) => f.schoolFERPAImpact);
}
