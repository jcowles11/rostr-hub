import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConsentScope } from "./data-classification";

/**
 * Server-side consent helpers. The lawyer-reviewed flow:
 *
 *   1. Coach adds a player → no consent record yet.
 *   2. Coach clicks "Send consent request to <parent email>" — calls
 *      issueParentalConsentRequest(). A row lands in parental_consent
 *      with consent_token but no granted_at / consent_scope.
 *   3. Parent receives email with /consent/<token> link.
 *   4. Parent submits → grantConsent() runs — sets granted_at,
 *      consent_scope, ip, ua, granting_user_agent. Token cleared.
 *   5. Public-facing surfaces (/p/<handle>, /scout/discover) call
 *      getActiveConsentForPlayer() and check scopes.
 *   6. Parent can revoke at /consent/<token> or coach can mark
 *      revoked. revokeConsent() sets revoked_at + reason. Audit
 *      record stays.
 *
 * The actual email send is deferred (Twilio / SendGrid integration
 * isn't wired this session). issueParentalConsentRequest returns the
 * generated token so the coach UI can copy/paste it for now.
 */

export interface ActiveConsent {
  id: string;
  playerId: string;
  parentEmail: string;
  parentName: string;
  scopes: ConsentScope[];
  grantedAt: string;
  method: "email_verification" | "school_authorized" | "in_person_signature";
}

/**
 * Fetch the active (granted, not-revoked) consent for a player.
 * Returns null when no active consent exists. Used by the public
 * profile renderer + scout search to gate minor-data exposure.
 */
export async function getActiveConsentForPlayer(
  playerId: string,
): Promise<ActiveConsent | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("active_parental_consent")
    .select(
      "id, player_id, parent_email, parent_name, consent_scope, granted_at, consent_method",
    )
    .eq("player_id", playerId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    playerId: data.player_id as string,
    parentEmail: data.parent_email as string,
    parentName: data.parent_name as string,
    scopes: ((data.consent_scope as string[]) ?? []).filter(
      (s): s is ConsentScope =>
        s === "public_profile" ||
        s === "verified_metrics_external" ||
        s === "scout_discovery" ||
        s === "recruiter_outreach",
    ),
    grantedAt: data.granted_at as string,
    method: data.consent_method as ActiveConsent["method"],
  };
}

/**
 * Server-side determination of "is this player a minor?". Wraps the
 * Postgres `player_is_presumed_minor()` function from migration 39.
 * Birth-year based when present; falls back to grade < 12.
 */
export async function isPlayerPresumedMinor(playerId: string): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("player_is_presumed_minor", {
    _player_id: playerId,
  });
  // Fail-safe to true. If we can't determine, treat as minor → require consent.
  if (error || data == null) return true;
  return Boolean(data);
}

/**
 * Combined check used by the /p/<handle> renderer:
 *   - if not a minor, no consent gate (public_profile flag alone gates)
 *   - if a minor, require active consent that includes 'public_profile'
 */
export async function canRenderPublicProfile(
  playerId: string,
): Promise<{ allowed: boolean; reason: string; consent: ActiveConsent | null }> {
  const isMinor = await isPlayerPresumedMinor(playerId);
  if (!isMinor) {
    return { allowed: true, reason: "adult_player", consent: null };
  }
  const consent = await getActiveConsentForPlayer(playerId);
  if (!consent) {
    return { allowed: false, reason: "minor_no_consent", consent: null };
  }
  if (!consent.scopes.includes("public_profile")) {
    return { allowed: false, reason: "minor_consent_missing_scope", consent };
  }
  return { allowed: true, reason: "minor_with_consent", consent };
}

/**
 * Coach action: send a consent request to a parent. Returns the
 * generated token so the coach UI can copy/share it pending email
 * integration.
 *
 * Idempotent-ish: if a pending request already exists for the same
 * (player_id, parent_email), reuses its token rather than creating a
 * second row.
 */
export async function issueParentalConsentRequest(args: {
  playerId: string;
  parentEmail: string;
  parentName: string;
}): Promise<{ token: string | null; error: string | null }> {
  const supabase = createSupabaseServerClient();
  // Reuse existing pending request if one exists.
  const { data: existing } = await supabase
    .from("parental_consent")
    .select("id, consent_token")
    .eq("player_id", args.playerId)
    .eq("parent_email", args.parentEmail)
    .is("granted_at", null)
    .is("revoked_at", null)
    .not("consent_token", "is", null)
    .maybeSingle();
  if (existing?.consent_token) {
    return { token: existing.consent_token as string, error: null };
  }
  // New token. crypto.randomUUID is unguessable; combined with the
  // existence-only public read, sufficient for one-time use.
  const token = crypto.randomUUID();
  const { error } = await supabase.from("parental_consent").insert({
    player_id: args.playerId,
    parent_email: args.parentEmail.trim(),
    parent_name: args.parentName.trim(),
    consent_method: "email_verification",
    consent_token: token,
    consent_scope: [],
  });
  if (error) return { token: null, error: error.message };
  return { token, error: null };
}

/**
 * Parent action: redeem the token + grant consent. Records IP + UA
 * for audit trail. Clears the token (single-use).
 */
export async function grantConsentByToken(args: {
  token: string;
  scopes: ConsentScope[];
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { data: row, error: fetchErr } = await supabase
    .from("parental_consent")
    .select("id, granted_at, revoked_at")
    .eq("consent_token", args.token)
    .maybeSingle();
  if (fetchErr || !row) {
    return { error: "Invalid or expired consent link." };
  }
  if (row.granted_at) {
    return { error: "This consent has already been processed." };
  }
  if (row.revoked_at) {
    return { error: "This consent request has been revoked." };
  }
  const { error: updErr } = await supabase
    .from("parental_consent")
    .update({
      granted_at: new Date().toISOString(),
      consent_scope: args.scopes,
      consent_token: null,
      ip_address: args.ipAddress ?? null,
      user_agent: args.userAgent ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (updErr) return { error: updErr.message };
  return { error: null };
}

/**
 * Parent or coach action: revoke an active consent. Soft-revoke only —
 * the row stays for audit. Visibility cuts immediately because the
 * `active_parental_consent` view filters out revoked rows.
 */
export async function revokeConsent(args: {
  consentId: string;
  reason?: string;
}): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("parental_consent")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: args.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.consentId);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Audit log helper — record every external view of a player's data.
 * Called from the public profile renderer + scout search.
 *
 * Intentionally fire-and-forget at the call site (don't await in the
 * critical render path) — best-effort logging.
 */
export async function logDataAccess(args: {
  playerId: string;
  accessType:
    | "public_profile_view"
    | "scout_search_appearance"
    | "recruiter_dm"
    | "export"
    | "other";
  viewerUserId?: string | null;
  viewerIp?: string | null;
  viewerUserAgent?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.from("data_access_log").insert({
    player_id: args.playerId,
    access_type: args.accessType,
    viewer_user_id: args.viewerUserId ?? null,
    viewer_ip: args.viewerIp ?? null,
    viewer_user_agent: args.viewerUserAgent ?? null,
    context: args.context ?? {},
  });
}
