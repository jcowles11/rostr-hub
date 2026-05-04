import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ROLE_PERMISSIONS,
  type Permission,
  type Role,
} from "./role-matrix";

/**
 * Server-only authorization helpers. Imported from server actions to
 * gate destructive operations.
 *
 * Pattern at every server action site:
 *
 *   "use server";
 *   import { requirePermission } from "@/lib/permissions/server";
 *
 *   export async function verifyHighlightAction(highlightId: string) {
 *     const ctx = await requirePermission("verify_highlight");
 *     // ctx is { userId, role: 'head_coach' | 'assistant_coach', programId }
 *     // proceed with the action
 *   }
 *
 * If the user is not signed in OR doesn't have the permission for ANY
 * program they belong to, requirePermission throws a structured error
 * the action catches and returns to the client.
 *
 * Note: this checks "do you have this permission for SOME program?"
 * Per-program scoping (e.g. "only head_coach of THIS player's program
 * can release them") is the action's responsibility — fetch the
 * player's program_id, verify it matches one the user is head_coach
 * for. requirePermission gives you the user + roles; the action
 * applies them to the specific resource.
 */

export interface PermissionContext {
  userId: string;
  /**
   * All program memberships the user has, with the role at each.
   * Most users have one. Multi-program coaches have several.
   */
  memberships: Array<{ programId: string; role: Role }>;
  /**
   * The highest privilege the user holds across ALL their programs.
   * Useful for non-program-scoped permissions; for program-scoped
   * actions, the action should look up the role for the SPECIFIC
   * program the resource belongs to.
   */
  bestRole: Role;
}

/**
 * Sentinel error type. Server actions should catch by message and
 * return { error: msg } to the client.
 */
export class PermissionDeniedError extends Error {
  permission: Permission;
  reason: "not_signed_in" | "no_program" | "insufficient_role";
  constructor(args: {
    permission: Permission;
    reason: PermissionDeniedError["reason"];
    message?: string;
  }) {
    super(args.message ?? `Permission denied: ${args.permission} (${args.reason})`);
    this.name = "PermissionDeniedError";
    this.permission = args.permission;
    this.reason = args.reason;
  }
}

/**
 * Loads the calling user + their program memberships, and verifies
 * they hold `permission` in at least one program. Throws on failure.
 *
 * Returns the full context so the caller can apply per-resource
 * checks (e.g. "is the player in a program where I'm head_coach?").
 */
export async function requirePermission(
  permission: Permission,
): Promise<PermissionContext> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new PermissionDeniedError({
      permission,
      reason: "not_signed_in",
      message: "You must be signed in.",
    });
  }

  const { data: rows, error } = await supabase
    .from("coaches")
    .select("program_id, role")
    .eq("user_id", user.id);

  if (error || !rows || rows.length === 0) {
    throw new PermissionDeniedError({
      permission,
      reason: "no_program",
      message: "You don't have a coach record in any program.",
    });
  }

  const memberships = rows.map((r) => ({
    programId: (r as { program_id: string }).program_id,
    role: (r as { role: string }).role as Role,
  }));

  // Highest-privilege role across all memberships
  const ROLE_RANK: Record<Role, number> = {
    admin: 100,
    head_coach: 50,
    assistant_coach: 30,
    evaluator: 20,
    player: 10,
    parent: 5,
    scout: 5,
  };
  const bestRole = memberships
    .map((m) => m.role)
    .sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0))[0];

  // At least ONE membership must have the permission
  const allowed = memberships.some((m) =>
    ROLE_PERMISSIONS[m.role]?.has(permission),
  );
  if (!allowed) {
    throw new PermissionDeniedError({
      permission,
      reason: "insufficient_role",
      message: `Your role doesn't permit ${permission.replace(/_/g, " ")}.`,
    });
  }

  return {
    userId: user.id,
    memberships,
    bestRole,
  };
}

/**
 * Convenience: checks per-program permission. Throws if user doesn't
 * have the permission specifically for `programId`. Use this when an
 * action targets a specific program and you want the role check
 * scoped accordingly.
 */
export async function requirePermissionForProgram(
  permission: Permission,
  programId: string,
): Promise<PermissionContext> {
  const ctx = await requirePermission(permission);
  const allowedHere = ctx.memberships.some(
    (m) =>
      m.programId === programId &&
      ROLE_PERMISSIONS[m.role]?.has(permission),
  );
  if (!allowedHere) {
    throw new PermissionDeniedError({
      permission,
      reason: "insufficient_role",
      message: `Your role in this program doesn't permit ${permission.replace(/_/g, " ")}.`,
    });
  }
  return ctx;
}
