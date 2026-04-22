import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-only helper — returns the current signed-in user or null.
 * Use in server components and route handlers.
 */
export async function getSessionUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Pull a friendly display name from Supabase user metadata.
 * Falls back to the part of the email before @.
 */
export function displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  if (typeof meta.full_name === "string" && meta.full_name.trim().length > 0) {
    return meta.full_name;
  }
  return user.email?.split("@")[0] ?? "";
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
