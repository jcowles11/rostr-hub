/**
 * Role-permission matrix.
 *
 * Pure types + a lookup function. Importable from anywhere — no
 * runtime dependencies. The server-side enforcement lives in
 * `./server.ts` (which IS server-only because it pulls auth context).
 *
 * Aligned to the actual coach_role enum from migration 1:
 *
 *   ('head_coach', 'assistant_coach')
 *
 * The matrix anticipates future roles (player, parent, scout, admin)
 * but only enforces what the schema currently supports. Adding a new
 * role means adding a coach_role enum value AND a matrix entry here
 * AND any RLS policies that need to differentiate.
 *
 * Permissions are deliberately fine-grained per-action rather than
 * coarse "manage roster" buckets. This makes it easy to retag a
 * single action's required permission without touching everything.
 */

export type Role =
  | "head_coach"
  | "assistant_coach"
  // Reserved for future schema additions. Listed so the matrix
  // documents the intended model; not currently enforceable at
  // database level until coach_role is extended.
  | "evaluator"
  | "player"
  | "parent"
  | "scout"
  | "admin";

/**
 * Every distinct permission Rostr's app actions check against. Naming
 * convention: `verb_object` in snake_case. Adding a new permission
 * means: (1) add to this union, (2) add to ROLE_PERMISSIONS for each
 * role that should have it, (3) call requirePermission() from the
 * server action.
 */
export type Permission =
  // Verified-data integrity (the recruiting moat — head_coach default)
  | "verify_highlight"
  | "unverify_highlight"
  | "verify_prior_stat"
  | "unverify_prior_stat"
  | "verify_measurable"

  // Roster management (head_coach for destructive, assistant for additive)
  | "add_player"
  | "edit_player_basics"
  | "release_player"
  | "delete_player"
  | "import_roster_csv"

  // Tryout operations
  | "create_tryout"
  | "edit_tryout"
  | "delete_tryout"
  | "configure_tryout_stations"
  | "enter_tryout_score"
  | "edit_tryout_score" // editing existing — head_coach only (auditable)
  | "delete_tryout_score"

  // Game / live scoring
  | "create_game"
  | "edit_game"
  | "delete_game"
  | "score_game_event" // append-only event entry
  | "edit_game_event" // editing past events — head_coach only

  // Rankings + scouting
  | "view_rankings"
  | "view_scout_signal"

  // Program admin
  | "configure_program_levels"
  | "invite_coach"
  | "remove_coach"

  // Compliance
  | "issue_parental_consent_request"
  | "view_consent_records"
  | "process_takedown_request"
  | "view_data_access_log";

const HEAD_COACH_PERMISSIONS: Set<Permission> = new Set<Permission>([
  // Head coach has everything an assistant has + the destructive set.
  "verify_highlight",
  "unverify_highlight",
  "verify_prior_stat",
  "unverify_prior_stat",
  "verify_measurable",

  "add_player",
  "edit_player_basics",
  "release_player",
  "delete_player",
  "import_roster_csv",

  "create_tryout",
  "edit_tryout",
  "delete_tryout",
  "configure_tryout_stations",
  "enter_tryout_score",
  "edit_tryout_score",
  "delete_tryout_score",

  "create_game",
  "edit_game",
  "delete_game",
  "score_game_event",
  "edit_game_event",

  "view_rankings",
  "view_scout_signal",

  "configure_program_levels",
  "invite_coach",
  "remove_coach",

  "issue_parental_consent_request",
  "view_consent_records",
  "process_takedown_request",
  "view_data_access_log",
]);

const ASSISTANT_COACH_PERMISSIONS: Set<Permission> = new Set<Permission>([
  // Assistants can ADD + ENTER but cannot EDIT-PAST or DELETE.
  // They CAN verify highlights/prior-stats — that's a coaching judgment
  // that assistants are expected to exercise (unverify is also fine).

  "verify_highlight",
  "unverify_highlight",
  "verify_prior_stat",
  "unverify_prior_stat",
  "verify_measurable",

  "add_player",
  "edit_player_basics",
  // NOT release_player, NOT delete_player, NOT import_roster_csv

  // NOT create_tryout / edit_tryout / delete_tryout / configure_stations
  "enter_tryout_score",
  // NOT edit_tryout_score, NOT delete_tryout_score

  // NOT create/edit/delete_game
  "score_game_event",
  // NOT edit_game_event

  "view_rankings",
  "view_scout_signal",

  // NOT configure_program_levels, invite_coach, remove_coach

  "issue_parental_consent_request",
  "view_consent_records",
  // NOT process_takedown_request, NOT view_data_access_log
]);

// Future roles — declared but NOT yet schema-backed. Each ships when
// the matching coach_role enum value is added by a migration.
const EVALUATOR_PERMISSIONS: Set<Permission> = new Set<Permission>([
  "enter_tryout_score",
  "view_rankings",
]);

const PLAYER_PERMISSIONS: Set<Permission> = new Set<Permission>([
  // Players act on their own profile — those actions are gated by
  // claimed_by_user_id checks in the actions, not by the matrix.
]);

const PARENT_PERMISSIONS: Set<Permission> = new Set<Permission>([]);
const SCOUT_PERMISSIONS: Set<Permission> = new Set<Permission>([]);
// Admin = Rostr-staff role. Inherits the full head-coach set.
// Array.from() sidesteps tsconfig's downlevelIteration flag for Sets.
const ADMIN_PERMISSIONS: Set<Permission> = new Set<Permission>(
  Array.from(HEAD_COACH_PERMISSIONS),
);

export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  head_coach: HEAD_COACH_PERMISSIONS,
  assistant_coach: ASSISTANT_COACH_PERMISSIONS,
  evaluator: EVALUATOR_PERMISSIONS,
  player: PLAYER_PERMISSIONS,
  parent: PARENT_PERMISSIONS,
  scout: SCOUT_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
};

/**
 * Pure check — does the given role have the given permission?
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
