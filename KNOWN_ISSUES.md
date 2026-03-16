# Known Issues

Tracked issues in the current codebase, ordered by severity.

## Critical (Blocks Real-World Use)

### KI-1: ~~Input validation~~ Resolved for critical MVP paths
**Affected:** Non-critical paths (program setup/settings, coach invitation) still lack validation
**Impact:** All six critical mutation workflows (player creation, score entry, session creation/update, metric creation, PlayerDetail inline eval add/edit) are now validated via service layer with bounds checking. Remaining unvalidated paths are lower-priority program admin flows.
**Mitigation:** Add validation to SettingsPage and CoachManager when those pages are prioritized.
**Status:** Resolved for MVP (2026-03-15) — PlayerDetail eval mutations migrated to service layer (D28).

### KI-2: ~~No error recovery in Score Entry~~ Resolved
**Affected:** ScoreEntry.tsx, src/hooks/useRetryQueue.ts
**Impact:** Previously, network failures during score entry lost data — the coach got a brief "Failed" flash and had to re-enter the value. Now, transient errors are automatically enqueued for background retry with exponential backoff (2s, 4s, 8s, 16s, max 4 retries). The coach's flow continues uninterrupted — value clears, station mode advances. Queue status is visible via an amber banner with pending count, failed items, and retry-all option.
**Remaining:** Queue is in-memory only — a full page reload loses queued items. Future improvement: persist queue to IndexedDB for true offline scoring support.
**Status:** Resolved for MVP (2026-03-15) — retry queue implemented. See D26.

### KI-2a: No unique constraint on evaluations table
**Affected:** evaluations table (PostgreSQL)
**Impact:** Without a DB-level unique constraint on (player_id, metric_id, coach_id, attempt_number, session_id), duplicate rows can theoretically be created by concurrent requests from different browser tabs or API clients. Application layer now has synchronous guard, but DB constraint provides defense-in-depth.
**Mitigation:** Prepared migration at `supabase/migrations/20260315000001_add_evaluation_unique_constraint.sql`. Run after checking for existing duplicates.
**Status:** Migration prepared, not yet applied.

### KI-2b: Seven prepared migrations not yet applied
**Affected:** supabase/migrations/ (20260315000001–000007)
**Impact:** Analytics events table + views, evaluation unique constraint, coach email linking, team management tables, public profile aggregation fix, and practice planning tables are all prepared as SQL migrations but not yet applied to the Supabase instance. Analytics instrumentation code will silently fail (by design — fire-and-forget) until 000003 is applied. Team Management and Game Detail pages will error on data fetch until 000005 is applied. Public profile shows incorrect aggregation (always "best" instead of configured method) and no development trends until 000006 is applied. Practice Plans and Schedule pages will error on data fetch until 000007 is applied.
**Mitigation:** Run all seven migrations before next deployment. Order: 000001 (eval constraint, check for dupes first), 000002 (coach email linking), 000003 (analytics_events table), 000004 (analytics views), 000005 (team management tables), 000006 (public profile aggregation fix + trend data), 000007 (practice planning tables).
**Status:** Open (2026-03-15)

### KI-15: Vite cache dir permissions on mounted filesystem
**Affected:** vite.config.ts, node_modules/.vite/
**Impact:** When `node_modules` lives on a mounted filesystem (e.g., Windows → Docker, FUSE mount), Vite's default cache directory (`node_modules/.vite/deps`) can become undeletable due to filesystem permission differences. This causes `EPERM: operation not permitted` errors when Vite tries to rebuild its dependency cache after `npm install` or lockfile changes.
**Mitigation:** Set `cacheDir` in vite.config.ts to `path.resolve(__dirname, "../.vite-cache")` — a writable directory outside the mount point. This is already implemented.
**Status:** Mitigated (2026-03-15)

### KI-10: roster_assignments enum mismatch with programs.levels
**Affected:** roster_assignments.assignment (Postgres enum), programs.levels (TEXT[])
**Impact:** The `roster_assignment` enum is locked to 4 values (`varsity|jv|freshman|cut`), but `programs.levels` allows coaches to define arbitrary level names. If a coach adds a level like "C" or "Reserve", it can't be stored in `roster_assignments`. RosterBoard UI uses the enum values from the existing Lovable export; LevelsManager edits the TEXT array. The new `games.team_level` column uses TEXT to avoid this problem.
**Mitigation:** Case-insensitive matching workaround implemented (D39) — TeamManagement and GameDetail both resolve enum values to display-level names via `enumToLevel` map. Future migration to convert `roster_assignments.assignment` from enum to TEXT still planned (D37) but no longer urgent for daily use.
**Status:** Mitigated (2026-03-15) — UI workaround in place; schema unification deferred

### KI-10a: Team level invisible on Dashboard, Roster, and PlayerDetail
**Affected:** Dashboard.tsx, Roster.tsx, PlayerDetail.tsx
**Impact:** A player's permanent team level (Varsity, JV, etc.) is only visible on RosterBoard, TeamManagement, and now GameDetail. The three highest-traffic coach pages — Dashboard (rankings), Roster (player list), and PlayerDetail (individual review) — show no team-level context. Coaches making cut or roster decisions must navigate away to check team assignments.
**Mitigation:** Add team level badges to player cards on Dashboard, Roster, and PlayerDetail. Queued in TASK_QUEUE.md under Team Assignment Hardening.
**Status:** Open (2026-03-15) — cosmetic, not blocking

## High (Significant Quality Issues)

### KI-3: AuthContext is monolithic (716 lines)
**Affected:** src/contexts/AuthContext.tsx
**Impact:** Hard to modify, hard to test, hard to debug. Mixes auth state, role detection, program switching, demo provisioning, and player auto-linking.
**Mitigation:** Decompose into focused hooks (useRoleDetection, useProgramSwitcher, useDemoMode). Deferred to Phase 2 — works correctly, high risk of breaking 4-role auth during refactor. See D15.

### KI-4: Test coverage limited to core business logic
**Affected:** Page components, contexts, service layer integration
**Impact:** 67 unit tests now cover metrics aggregation, percentile ranking, sport configs, and all Zod validation schemas. No component tests, no integration tests, no E2E tests yet.
**Mitigation:** Add component tests for ScoreEntry/Roster/Dashboard in Phase 5. Consider E2E tests for critical workflow.
**Status:** Partially resolved (2026-03-15)

### KI-5: React Query installed but underutilized
**Affected:** All data-fetching pages
**Impact:** No caching, no deduplication, no background refresh. Every page mount re-fetches everything. Manual useState/useEffect patterns everywhere.
**Mitigation:** Migrate to React Query incrementally as service layer is introduced. Phase 1-2.

### KI-6: Session lifecycle incomplete
**Affected:** tryout_sessions table, SessionContext, TryoutPlanner
**Impact:** Sessions have no status (draft/active/completed). No player-to-session assignment. No metric-to-session assignment. Scoring page just uses a session name filter.
**Mitigation:** Status model deferred pending pilot feedback (D18). Session deletion path unified and hardened with confirmation dialogs and evaluation count warnings (Phase 2 Step 2, D17). Player/metric assignment per session not needed for MVP — all players and metrics are shared across sessions.
**Status:** Partially improved (2026-03-15) — deletion safe, status deferred.

### KI-5a: DataImport bypasses service layer and lacks score validation
**Affected:** src/components/DataImport.tsx
**Impact:** DataImport uses direct Supabase calls for player creation and evaluation insertion (not service layer). No Zod validation on imported score values — out-of-bounds scores can be imported silently. Within-file duplicate rows are now merged, and re-import creates no duplicate evaluations, but the mutations still bypass the service layer.
**Mitigation:** Migrate DataImport mutations to playerService/evaluationService. Add Zod bounds checking on imported scores using existing `validateScoreValue()`.
**Status:** Partially improved (2026-03-15) — duplicate detection implemented; service layer migration and score validation still pending.

### KI-7a: Coach invitation flow broken (placeholder UUID never linked)
**Affected:** src/components/CoachManager.tsx, src/contexts/AuthContext.tsx
**Impact:** When a head coach invites an assistant, CoachManager creates a placeholder coach record with `user_id: crypto.randomUUID()`. When the invited coach signs up with their email, AuthContext queries `coaches.user_id = auth.uid()` which never matches the placeholder UUID. Invited coaches could never join their program.
**Mitigation:** Created SECURITY DEFINER function `link_coach_by_email` that matches placeholder records by email and updates user_id on login. Added linking logic to AuthContext's `fetchUserRole` path. Migration prepared at `supabase/migrations/20260315000002_coach_email_linking.sql`.
**Status:** Fixed (2026-03-15) — migration prepared, not yet applied. See D25.

### KI-8a: ~~Dashboard filter chain silently ignored downstream filters~~ Fixed
**Affected:** src/pages/Dashboard.tsx
**Impact:** When "Evaluated" or "Not Evaluated" hero button was selected, the filter chain used early returns (`return p.evalCount > 0`) that bypassed position and any future downstream filters. A coach selecting "Evaluated" + "SS" position saw ALL evaluated players, not just evaluated shortstops. Misleading during multi-position tryouts.
**Fix:** Rewrote filter chain using composable `if (condition) return false` guards. All filters now AND correctly. See D29.
**Status:** Fixed (2026-03-15)

### KI-6a: Composite percentile inflated by partial metric data
**Affected:** src/lib/metrics.ts `computePercentiles`, src/pages/Dashboard.tsx
**Impact:** Players with scores on only 1-2 metrics can appear higher ranked than fully-evaluated players because the composite averages only the metrics each player has. This is mathematically correct but misleading during tryouts when coaches are mid-evaluation and not all players have complete data.
**Mitigation:** Added metric coverage indicator ("3/6 metrics"), "partial" label, and dimmed score styling so coaches can see data completeness. Future option: weighted composite that penalizes missing metrics, or minimum-metric threshold filter. See D23.
**Status:** Mitigated with visibility (2026-03-15) — ranking math unchanged, coaches can now see which scores are partial.

### KI-9a: ~~MetricsManager allows metric deletion without confirmation~~ Fixed
**Affected:** src/components/MetricsManager.tsx
**Impact:** Previously, deleting a metric immediately destroyed all associated evaluations via cascade with no confirmation. A coach could accidentally tap the trash icon and lose all data for that metric.
**Fix:** Added AlertDialog confirmation that fetches evaluation count and shows explicit warning with count (e.g., "Delete Metric & 47 Scores"). See D32.
**Status:** Fixed (2026-03-15)

### KI-9c: ~~CoachManager "Send Invitation" button is misleading~~ Fixed
**Affected:** src/components/CoachManager.tsx
**Impact:** The invite form button said "Send Invitation" and "Sending..." but no email was actually sent. A coach record is created in the DB with a placeholder UUID, and the assistant coach had to independently know to sign up with the matching email.
**Fix:** Renamed to "Add Coach" / "Adding...", added two-phase dialog (form → success confirmation with copyable signup link), explicit "no email sent" guidance, and email-must-match instructions. See D41.
**Status:** Fixed (2026-03-15)

### KI-9b: ScoreEntry station mode stationIndex can desync from filtered array
**Affected:** src/pages/ScoreEntry.tsx
**Impact:** If the coach changes the search query while station mode is active, the `filtered` array shrinks but `stationIndex` may now point beyond the array bounds. The component handles this gracefully (resolvedActivePlayer becomes undefined, scoring card disappears) but the coach loses their place. Discovered in Pilot QA Pass (Phase 3 Step 6, finding #11).
**Mitigation:** Clamp `stationIndex` to `filtered.length - 1` when search changes, or reset to 0.
**Status:** Open (2026-03-15)

## Medium (Code Quality)

### KI-7: Page components are oversized
**Affected:** PlayerDetail.tsx (666 lines), PlayerLinkPage.tsx (647 lines), PublicProfile.tsx (577 lines), Roster.tsx (526 lines), ScoreEntry.tsx (493 lines)
**Impact:** Hard to read, hard to maintain, hard to test. Business logic mixed with UI rendering.
**Mitigation:** Extract sub-components and move data logic to service layer. Ongoing during Phase 1-3.

### KI-8: Demo mode entangled with production logic
**Affected:** AuthContext.tsx, SessionContext.tsx, AppLayout.tsx, DevRoleSwitcher.tsx
**Impact:** Demo provisioning code adds complexity and edge cases to core auth flow. DevRoleSwitcher creates coach/player records in production database.
**Mitigation:** Isolate demo logic behind feature flag. Lower priority — functional but messy.

### KI-9: `metric_category` enum is baseball-only
**Affected:** Database enum, metric creation
**Impact:** Categories (running, hitting, fielding, pitching, other) only make sense for baseball. Football, basketball, soccer metrics all fall under "other".
**Mitigation:** Either expand enum per sport or switch to text field with sport-specific presets. Defer to Phase 2.

### KI-10: Supabase types.ts is 57KB auto-generated
**Affected:** src/integrations/supabase/types.ts
**Impact:** File includes types for all 22 tables including out-of-scope scout/social tables. Header says "Do not edit directly."
**Mitigation:** Regenerate with `supabase gen types typescript` when schema changes. Keep as-is for now.

## Low (Cosmetic / Non-Blocking)

### KI-14: Bottom nav has 5 tabs (may be tight on small phones)
**Affected:** src/components/AppLayout.tsx
**Impact:** Adding the Home tab increased the bottom nav from 4 to 5 tabs. On narrow screens (< 360px width), the tab labels may truncate or feel cramped. On typical modern phones (375px+) this is fine.
**Mitigation:** Monitor during pilot. If 5 tabs is too tight, consolidate "More" (Settings) into a hamburger/sheet menu to keep 4 primary tabs. See D45.
**Status:** Open (2026-03-15) — cosmetic, monitor during pilot

### KI-11: `next-themes` is a dependency
**Affected:** package.json
**Impact:** Installed but designed for Next.js. Works in Vite for dark mode toggle but is an unnecessary Next.js dependency.
**Mitigation:** Replace with a simple theme context if issues arise. Low priority.

### KI-12: 29 migrations with UUID filenames
**Affected:** supabase/migrations/
**Impact:** Migration history is unreadable. Can't tell what each migration did from the filename.
**Mitigation:** Consolidate into baseline migration. Requires confirmation that no production data would be lost.

### KI-13: `.lovable/` directory still in repo
**Affected:** .lovable/plan.md
**Impact:** Contains a Lovable UI plan doc. No functional impact but clutters the repo.
**Mitigation:** Delete when appropriate. No rush.
