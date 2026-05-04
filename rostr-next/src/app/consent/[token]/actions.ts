"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { grantConsentByToken } from "@/lib/compliance/consent";
import type { ConsentScope } from "@/lib/compliance/data-classification";

/**
 * Server actions for /consent/[token].
 *
 * Public surface — no auth required (the token IS auth). Forensic
 * context (IP + UA) is captured from request headers and persisted
 * with the consent record per migration 39's parental_consent schema.
 */

const SCOPE_VALUES = [
  "public_profile",
  "verified_metrics_external",
  "scout_discovery",
  "recruiter_outreach",
] as const;

const submitSchema = z.object({
  token: z.string().trim().min(10),
  parentNameConfirmed: z.string().trim().min(1, "Parent name is required."),
  scopes: z.array(z.enum(SCOPE_VALUES)).default([]),
});

export interface SubmitConsentInput {
  token: string;
  parentNameConfirmed: string;
  scopes: ConsentScope[];
}

export async function submitConsentAction(
  input: SubmitConsentInput,
): Promise<{ error: string | null; redirectTo?: string }> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Forensic capture — the parental_consent row records these for the
  // audit trail. x-forwarded-for is Vercel's typical edge header.
  const h = headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent") ?? null;

  const res = await grantConsentByToken({
    token: parsed.data.token,
    scopes: parsed.data.scopes as ConsentScope[],
    ipAddress,
    userAgent,
  });

  if (res.error) {
    return { error: res.error };
  }

  // Bounce to a confirmation page (reuses the AlreadyProcessed branch
  // by pulling the row again on next render).
  return { error: null, redirectTo: `/consent/${parsed.data.token}/done` };
}

/**
 * Wrapper used by the form's `action={submit}` so we can redirect on
 * success. Server actions can't return + redirect cleanly in one
 * payload, so the client awaits the {error, redirectTo} response and
 * handles navigation.
 */
export async function submitAndRedirect(input: SubmitConsentInput) {
  const res = await submitConsentAction(input);
  if (res.error) return res;
  if (res.redirectTo) redirect(res.redirectTo);
  return res;
}
