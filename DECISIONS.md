# Technical Decisions

## D51 — Team Management Productization: Navigation Restructure and Schedule Hub
**Date:** 2026-03-15 | **Status:** Implemented

The app had strong backend capability but felt prototype-like because: (1) TeamHome existed but wasn't the landing page (Roster was), (2) Games, Lineups, Practice Plans were buried behind Settings > Tryout Planning tiles, (3) the bottom nav prioritized tryout-era features (Score, Stats) over daily-use team management features, (4) Quick Actions on TeamHome were generic without contextual awareness. Considered two approaches: (A) redesign the entire app structure with responsive sidebar nav, or (B) focused restructure of navigation hierarchy and landing experience within the existing mobile-first framework. Chose (B) because: the existing UI direction is strong on mobile, a sidebar redesign would risk regression in core workflows, and the highest-impact changes are routing and content hierarchy rather than layout framework. Specific decisions: (1) Route `/` changed from Roster to TeamHome — coaches need a command center, not a player list, on login. (2) Bottom nav gains "Schedule" (combining Games + Practices) replacing "Stats" (moved to Settings > Evaluation & Scoring). Schedule is a daily-use feature; Stats is periodic. (3) TeamHome redesigned with "This Week" section merging games and practices chronologically — coaches think in terms of "what's happening this week" not "games vs practices." (4) Demo data seeder creates 25 realistic baseball players, 11 games, and 9 practices so the product feels alive during demos. The seeder is accessible via Settings to avoid auto-seeding production data.

## D50 — Practice Planning: TEXT Time Storage and Flat Block Schema
**Date:** 2026-03-15 | **Status:** Implemented (migration prepared)

Practice plans need time-blocked schedules with concurrent activities (e.g., IF Defense and OF Defense running 3:10–3:25 simultaneously). Considered three time storage approaches: (A) `timestamptz` columns (full timezone support but introduces UTC conversion headaches for schedules that are always local), (B) `interval` type (semantically correct but poor Supabase JS client support), (C) TEXT "HH:MM" format. Chose (C) because: practice times are purely local (no cross-timezone scheduling needed), TEXT is trivially parseable in JS (`split(":")`), and avoids the timezone bugs that plague every datetime-based scheduling system. For the block schema, considered: (A) a hierarchical model with time slots containing blocks, (B) a flat blocks table with start_time/end_time per block. Chose (B) because: concurrent blocks are just blocks with the same time range — the UI groups them by matching `start_time-end_time` keys without needing a parent slot entity. This keeps the schema simple (one table instead of two) while the UI handles visual grouping. The `assigned_coach_id` FK references coaches with SET NULL on delete — if a coach is removed from the program, their blocks remain but show "—" instead of crashing. The `player_group` TEXT column (e.g., "Infielders", "Group A") is intentionally free-form rather than FK to a groups table — practice groupings are ephemeral and sport-specific, not worth a schema commitment.

## D49 — Player Comparison via Public Profile RPC Over Custom Comparison Endpoint
**Date:** 2026-03-15 | **Status:** Implemented

Scouts and recruiters need to compare players side by side to evaluate recruiting options. Considered three data approaches: (A) a dedicated `compare_players` RPC that accepts multiple player IDs and returns a comparison-optimized payload, (B) fetch each player's data from the existing `get_public_profile` RPC individually, (C) client-side search result caching with metric alignment at render time. Chose (B) because: the `get_public_profile` RPC already returns all needed data (bio, metrics, evaluator data, trend_data), is SECURITY DEFINER for public access, and adding a comparison-specific RPC duplicates the data contract for marginal performance benefit (2-3 parallel requests vs 1 batch request for small N). The comparison page fetches profiles in `Promise.all` for concurrency. Metric alignment is handled client-side: `collectMetricNames` builds the union of all metric names across profiles, preserving insertion order, and each row renders per-player values with "—" for missing data. The "best" value per metric is highlighted green using metric_type-aware comparison (timed = lower is better). The URL format `/compare?players=slug1,slug2,slug3` supports sharing and bookmarking comparisons. The compare selection mode in PlayerSearchResults is a separate UI concern — it toggles card click behavior from "open profile sheet" to "add/remove from compare set" and caps at 3 players.

## D47 — Public Profile Aggregation Fix: RPC Enhancement Over Client-Side Workaround
**Date:** 2026-03-15 | **Status:** Implemented (migration prepared)

The public profile RPC (`get_public_profile`) hardcoded `CASE WHEN metric_type = 'timed' THEN MIN(e.value) ELSE MAX(e.value)` — always using "best" logic regardless of the metric's configured aggregation method. This meant a metric configured as "average" showed the best attempt on the public profile while the coach saw the average internally. This breaks the "verified" promise that is Rostr's core differentiator. Considered three fixes: (A) client-side re-aggregation by fetching raw evals (blocked by RLS for unauthenticated visitors), (B) a separate RPC for corrected aggregation (duplicates logic), (C) update the existing `get_public_profile` RPC to read the metric's `aggregation` column. Chose (C) because: it fixes the problem at the source, maintains a single RPC as the public profile's data contract, and adds two valuable fields (aggregation label per metric, trend_data for sparklines) in the same migration. The `trend_data` field returns session-by-session aggregated values for metrics with 2+ sessions, enabling development sparklines without additional client-side queries. Prepared as migration 000006 — requires `supabase db push` to deploy.

## D48 — Zero-Dependency Client-Side QR Code Over External API or Library
**Date:** 2026-03-15 | **Status:** Implemented

Players and coaches need QR codes for physical recruiting materials (lineup cards, flyers, recruiting packets). Considered three approaches: (A) external QR code API (`api.qrserver.com` — adds network dependency, privacy concern with player URLs), (B) npm library like `qrcode` or `qr.js` (~15-50KB added bundle), (C) minimal client-side QR encoder targeting profile URLs. Chose (C) because: profile URLs are short (typically 30-60 chars), so only QR versions 1-4 are needed, which simplifies encoding dramatically. The implementation covers byte-mode encoding, Reed-Solomon error correction in GF(256), finder/alignment/timing patterns, mask pattern 0, and format info — roughly 200 lines of self-contained code. The SVG output is rendered via `useMemo` for performance and `dangerouslySetInnerHTML` for the SVG string. Tradeoff: the minimal encoder only handles URLs up to ~90 characters (version 6 limit); longer URLs get a graceful fallback message. This is sufficient for all Rostr profile URLs (`/p/slug` where slug is typically 15-25 chars).

## D46 — Player Development Trends: SVG Sparklines Over Chart Library
**Date:** 2026-03-15 | **Status:** Implemented

Coaches needed temporal context for player metrics — seeing whether a player is improving or declining across evaluation sessions. Considered three visualization approaches: (A) a full chart library like Recharts or Chart.js with interactive line charts, (B) a table-based comparison showing session columns, (C) lightweight SVG sparklines with directional indicators. Chose (C) because: chart libraries add significant bundle weight (Recharts is ~200KB gzipped) for a secondary visualization feature, interactive tooltips and axes are overkill for a 3-5 point trend line, and the sparkline pattern fits naturally into the existing card-based PlayerDetail layout. Each trend row shows: metric name, session count + range, an 80×28px SVG sparkline with colored stroke (green/red/gray), latest value with unit, and signed delta. The `computeTrends()` function groups evaluations by metric and session, aggregates per session using the metric's configured aggregation method (min for timed, max for measured/rated, or average), and applies a 2% threshold for "stable" classification. This threshold prevents micro-fluctuations from appearing as meaningful trends. The component receives all data as props — zero data fetching, fully composable, easily testable. Future extension: a standalone `/development/:playerId` page with full interactive charts when coaches need deeper analysis.

## D45 — Team Home as New Nav Entry, Not Route Replacement
**Date:** 2026-03-15 | **Status:** Implemented

Coaches needed a hub page consolidating team state, games, and quick actions. Considered two approaches: (A) replace the `/` route (currently Roster) with Team Home, making Roster a secondary page, or (B) add Team Home as a new `/home` route and a new first tab in the bottom nav, preserving Roster at `/`. Chose (B) because: replacing `/` breaks all existing bookmarks, link references in the pilot runbook, and the deep-link expectations of the auth redirect system (which sends coaches to `/` after login). Adding a new tab is additive — no existing flows break, and coaches who prefer jumping straight to the roster can still do so. The tradeoff is 5 tabs in the bottom nav instead of 4, but the icons are compact and the labels are short (Home, Roster, Score, Stats, More). If 5 tabs feels crowded on small phones, the future fix is to consolidate "More" into a hamburger menu, not to remove Home.

## D43 — Lineup Dirty-State Guard via JSON Snapshot
**Date:** 2026-03-15 | **Status:** Implemented

Coaches editing lineups could lose all work by accidentally tapping "Back" with no warning. Considered three approaches: (A) React Router's `useBlocker`/`unstable_usePrompt` (unstable API, version-dependent), (B) auto-save on every change (adds latency, generates many DB writes for reorder/position changes), (C) JSON snapshot comparison + `beforeunload` + `window.confirm` on in-app navigation. Chose (C) because: it's stable across React Router versions, requires zero additional network requests, and the `beforeunload` event covers browser close/reload while `safeNavigate` covers in-app navigation. The tradeoff is that `window.confirm` is visually plain (no custom styling), but it's universally understood and doesn't require a custom modal component. The Save button doubles as a dirty indicator — showing "Save *" with a subtle pulse when changes exist, "Saved" when clean, and disabled when nothing has changed.

## D44 — Copy Lineup from Previous Game via Existing Data
**Date:** 2026-03-15 | **Status:** Implemented

Coaches typically run similar lineups across games with minor adjustments. Without copy, they re-entered 9 players from scratch every game. Considered: (A) a "lineup template" table in the schema, (B) fetching another game's lineup entries at runtime. Chose (B) because: it requires zero schema changes, uses the existing `fetchGames` + `fetchLineup` service functions, and the game list is small enough (10-30 games per season) to show in a simple dialog. When copying, any source-lineup players not already on the target game's roster are automatically added via upsert. The lineup is loaded into local state as unsaved (dirty), so the coach can review and adjust before saving. A warning banner appears when overwriting an existing lineup.

## D42 — Printable Lineup Cards: Composable Renderer with Inline Print CSS
**Date:** 2026-03-15 | **Status:** Implemented

Coaches need physical lineup cards on game day — no coach is checking a laptop between innings. Considered three approaches: (A) server-side PDF generation via Edge Function, (B) client-side PDF via jsPDF/pdfmake, (C) CSS `@media print` with browser's native print dialog. Chose (C) because: zero new dependencies, works on laptop/tablet/phone, instant preview, and the browser's print dialog already handles page sizing and printer selection. The tradeoff is less pixel-precise control than PDF, but lineup cards are simple tabular data that renders predictably across browsers. Built the `LineupCard` component as a standalone renderer with a `variant` prop ("card" for 4-per-page, "board" for future full-page dugout display) so additional export formats can reuse the same component without duplicating layout logic. Used BEM-style CSS class names instead of Tailwind to ensure print styles aren't affected by Tailwind's purge or dark mode classes. Position format toggle (SS ↔ 6) uses a bidirectional lookup map exported from `LineupCard` for reuse.

## D41 — Coach Invitation Flow: Accurate Messaging Over Email Integration
**Date:** 2026-03-15 | **Status:** Implemented

The "Send Invitation" button in CoachManager implied outbound email delivery that doesn't exist. Considered three approaches: (A) integrate actual email sending (Supabase Edge Function + Resend/SendGrid), (B) rename the button and add a copyable signup link, (C) leave as-is with better toast messaging. Chose (B) because: adding email delivery (A) introduces a new service dependency, requires email template design, sender domain verification, and error handling for a flow that happens once per coach — heavy infrastructure for low frequency. A better toast alone (C) is too easy to miss. Option (B) eliminates the false promise, adds a two-phase dialog (form → confirmation with copyable link), and gives the head coach a ready-to-send message they can text or email manually. The copy button includes the signup URL and email instructions in a single clipboard action. This is the highest trust-per-effort improvement: zero backend changes, zero new dependencies, directly addresses the documented pilot confusion (KI-9c).

## D40 — Player Navigation via React Router location.state
**Date:** 2026-03-15 | **Status:** Implemented

Coaches reviewing multiple players in sequence needed prev/next navigation without back-navigating to the list. Considered four approaches: (A) global context/Redux store holding the current player list, (B) URL search params encoding player IDs, (C) sessionStorage keyed by source page, (D) React Router's `location.state` passed from list pages. Chose (D) because: it's the React Router-idiomatic pattern, requires zero new state management infrastructure, survives within the navigation chain (prev/next uses `navigate(url, { state, replace: true })` to forward the same state to the next player), and gracefully degrades — if a user bookmarks or directly navigates to `/player/:id`, `location.state` is null, so no arrows appear. No broken state, no stale lists. The tradeoff is that state is lost on full page reload, but this is acceptable: the coach simply sees the player without arrows and can back-navigate normally.

## D39 — Case-Insensitive Level Matching Over Enum Migration
**Date:** 2026-03-15 | **Status:** Implemented

The `roster_assignments.assignment` column stores lowercase Postgres enum values (`"varsity"`, `"jv"`) while `programs.levels` stores display-case strings (`"Varsity"`, `"JV"`). TeamManagement was grouping players via exact string match, causing all assigned players to silently appear as "unassigned." Considered two fixes: (A) migrate the enum to TEXT to unify the data model, (B) add case-insensitive matching at the UI layer. Chose (B) because: the enum migration touches RLS policies, existing data, and the RosterBoard page — high risk for a case-sensitivity fix. A `Map<lowercase, displayCase>` lookup in `useMemo` resolves the mismatch at zero schema risk. The enum migration (D37) remains planned but is no longer urgent since all UI paths now handle the mismatch gracefully. GameDetail uses the same approach: `assignments.get(playerId)` returns the enum value, compared case-insensitively against `game.team_level`.

## D38 — Lineup Replace-All Save Strategy
**Date:** 2026-03-15 | **Status:** Implemented

`saveLineup` deletes all existing `lineup_entries` for a game and reinserts the full set. Considered two approaches: (A) diff-based upsert (compare existing vs new, insert/update/delete individually) or (B) delete-all + insert-all. Chose (B) because: lineup changes are infrequent (once per game), the entry count is small (9-15 players), and the implementation is dramatically simpler. The delete + insert runs within Supabase's implicit transaction. The tradeoff is that `created_at` timestamps reset on every save, which is acceptable since lineup history tracking is not a v1 requirement.

## D37 — Team Management Data Model: Extend, Don't Replace
**Date:** 2026-03-15 | **Status:** Implemented

The existing `roster_assignments` table uses a Postgres enum (`roster_assignment: varsity|jv|freshman|cut`) which can't represent arbitrary team levels from `programs.levels`. Considered three approaches: (A) alter the enum to add new values dynamically (fragile, requires migrations per new level), (B) replace `roster_assignments.assignment` column type from enum to TEXT (breaks existing data and RLS policies), (C) leave `roster_assignments` untouched and add new tables using TEXT for team_level. Chose (C) because: `roster_assignments` works correctly for its current purpose (tryout-day cut decisions), changing it risks breaking the RosterBoard which is critical for the pilot, and the new `games.team_level` TEXT column can reference any value from `programs.levels` without constraint migration. This creates a minor inconsistency (two assignment systems) but keeps both stable and allows future unification post-pilot.

## D36 — Pilot Runbook as Repository Documentation
**Date:** 2026-03-15 | **Status:** Implemented

Coaches need a concise, actionable guide for tryout day — not a user manual. Considered three formats: (A) in-app onboarding wizard, (B) external Google Doc shared with coaches, (C) markdown runbook in the repository. Chose (C) because: it's versioned alongside code, always reflects the current UI state, requires zero additional infrastructure, and can be converted to any distribution format later. The runbook is sequential (9 steps matching tryout day order), each section includes "Avoid" items that address known friction points discovered during pilot simulation (Phase 4) and QA (Phase 3 Step 6). Developer monitoring section maps analytics views to actionable signals so the team knows what to watch during the first real tryout.

## D1 — Preserve Vite + React SPA Architecture
**Date:** 2026-03-15 | **Status:** Confirmed

The app is a Vite-powered React SPA with client-side routing. Keep this architecture for MVP. Do not migrate to Next.js. The primary use case (live evaluation entry during tryouts) benefits from a fast, client-rendered SPA. SSR adds complexity with minimal benefit since the app requires auth for nearly all pages.

Re-evaluate post-MVP if public-facing pages (recruiting search) become important.

## D2 — Preserve Supabase as Backend
**Date:** 2026-03-15 | **Status:** Confirmed

Supabase provides PostgreSQL, Auth, RLS, Storage, and Edge Functions. The 22-table schema is deployed and working. Migrating away would be massive with no clear benefit.

## D3 — Preserve shadcn/ui Component Library
**Date:** 2026-03-15 | **Status:** Confirmed

45+ shadcn/ui (Radix-based) components are already installed and used correctly throughout. They provide accessible primitives with full Tailwind customization. Keep them.

## D4 — Preserve Four-Role Account Architecture
**Date:** 2026-03-15 | **Status:** Confirmed

The four roles (Coach, Player, Evaluator, Scout) map to distinct use cases in the long-term platform vision. The role detection and routing system works. Keep it, but isolate the role-detection logic from AuthContext for maintainability.

## D5 — Preserve Existing UI Direction
**Date:** 2026-03-15 | **Status:** Confirmed

The mobile-first UI with gradient hero headers, tap targets, station mode scoring, and bottom navigation reflects deliberate design choices. Preserve these patterns and strengthen them with better validation and error handling rather than redesigning.

## D6 — Remove lovable-tagger Dependency
**Date:** 2026-03-15 | **Status:** Implemented

Removed `lovable-tagger` from devDependencies and vite.config.ts. This plugin tags components for the Lovable visual editor. Since development is now independent, it's dead weight that adds a build dependency on an external service.

## D7 — Introduce Service Layer
**Date:** 2026-03-15 | **Status:** Implemented (core coach pages)

Created `src/services/` with five domain modules (playerService, evaluationService, metricService, teamService, noteService). Rewired Roster, ScoreEntry, and Dashboard to use the service layer. All service functions return `{ data, error }` for a consistent contract.

Remaining direct Supabase access in MVP-critical paths: TryoutPlanner.tsx (session/metric CRUD), SessionContext.tsx (session listing), Dashboard.tsx (realtime subscription only). These will be migrated incrementally.

## D8 — Defer Out-of-Scope Features
**Date:** 2026-03-15 | **Status:** Confirmed

Scout dashboards, social feed, messaging, evaluator marketplace features exist in the codebase but are out of MVP scope. Keep the existing code (it doesn't hurt) but invest zero development time extending it. All effort goes to the coach evaluation workflow.

## D9 — Per-Coach Per-Attempt Evaluation Model
**Date:** 2026-03-15 | **Status:** Confirmed (Inherited)

The evaluation model with `(player_id, metric_id, coach_id, attempt_number, session_id)` uniqueness correctly supports multi-evaluator scenarios and multi-attempt metrics. The aggregation methods (best/average/latest) and percentile scoring in `lib/metrics.ts` are well-implemented. Keep this model.

## D10 — Sport-Specific Templates
**Date:** 2026-03-15 | **Status:** Confirmed (Inherited)

The `lib/sports.ts` sport configs (baseball, football, basketball, soccer) with predefined positions, categories, and default metrics are well-structured. Baseball is the most complete config, which aligns with likely pilot programs. Keep and extend as needed.

## D11 — Zod Validation at Service Layer
**Date:** 2026-03-15 | **Status:** Implemented

Centralized Zod schemas in `lib/validation.ts` for all critical mutations (player, session, metric, score). Validation runs inside service functions (before Supabase writes), not in components. This keeps components clean and ensures all paths through a service get validated.

Schemas enforce: name trimming, UUID format for all foreign keys, enum constraints (metric_type, aggregation, bats/throws), numeric ranges (grade 1-16, attempts 1-10), and min < max for rated metrics.

## D12 — Unit Tests for Core Business Logic First
**Date:** 2026-03-15 | **Status:** Implemented

Prioritized testing pure functions (`lib/metrics.ts`, `lib/sports.ts`) and validation schemas (`lib/validation.ts`) over component or integration tests. These are the functions that directly affect player rankings, score aggregation, and data integrity — the highest-risk areas for correctness. Component tests will come later in Phase 5.

## D13 — SessionContext: Harden Fetch, Keep Mutations Direct
**Date:** 2026-03-15 | **Status:** Implemented

SessionContext's session-fetch now uses `fetchTryoutSessions` from the service layer. Create mutation retains direct Supabase access for optimistic state updates. Delete mutation now uses the unified `deleteTryoutSession` service function (updated in Phase 2 Step 2, see D17).

## D14 — Dashboard Realtime: Keep as Direct Supabase Dependency
**Date:** 2026-03-15 | **Status:** Confirmed

Dashboard.tsx's `supabase.channel()` realtime subscription is an acceptable direct dependency. It's a websocket listener, not a CRUD query. It's tightly coupled to component mount/unmount lifecycle and triggers a service-layer `fetchData()` on change. Abstracting it adds indirection without benefit. Will revisit only if realtime patterns are needed in more components.

## D15 — AuthContext: Defer Decomposition to Phase 2
**Date:** 2026-03-15 | **Status:** Deferred

AuthContext (716 lines) is the largest single file and mixes auth state, role detection, program switching, org switching, demo provisioning, and player auto-linking. However, it works correctly for all four account types. Decomposing it carries high risk of breaking the auth flow for coach, player, evaluator, and scout roles simultaneously. The planned decomposition (extract useRoleDetection, useProgramSwitcher, useDemoMode as separate hooks) is deferred to Phase 2 when the coach evaluation workflow is fully hardened and there's more test coverage to catch regressions.

## D16 — Metric Bounds Validation as First Phase 2 Priority
**Date:** 2026-03-15 | **Status:** Implemented

Rated metrics (e.g., 20-80 fielding scale) carry min_value/max_value in the database but ScoreEntry.tsx accepted any number. This directly corrupts verified athlete data — the core product promise. Chose this as the single highest-value Phase 2 improvement because: (1) it protects data integrity, (2) it's a small, targeted change, (3) it improves coach UX with range hints, (4) it prevents a class of errors that would undermine pilot credibility.

Implementation: `validateScoreValue()` in `lib/validation.ts` checks bounds at runtime. `evaluationService.saveScore` accepts optional `MetricBounds` and validates before write. ScoreEntry passes current metric's bounds and shows range hint UI. HTML min/max attributes provide browser-level first line of defense.

## D17 — Unified Session Deletion with Confirmation Gates
**Date:** 2026-03-15 | **Status:** Implemented

Two code paths deleted sessions differently: SessionContext manually cascaded (3 Supabase calls), TryoutPlanner used raw delete (relying on DB constraints). Neither warned about existing data. Unified into a single `deleteTryoutSession` service function that: (1) unassigns evaluations (SET NULL), (2) deletes attendance, (3) deletes the session. Both UI paths now use this function. Added `getSessionStats` to fetch evaluation/attendance counts before showing a confirmation dialog. TryoutPlanner now has AlertDialog confirmation (previously had none). AppLayout's existing dialog now shows evaluation count.

This also reduces SessionContext's direct Supabase usage — delete is now fully routed through the service layer, leaving only `createSession` as a direct Supabase mutation (justified by optimistic state update requiring `.select().single()`).

## D18 — Session Status Model Deferred
**Date:** 2026-03-15 | **Status:** Deferred

No `status` column on tryout_sessions. For MVP with ≤5 sessions per program, this is manageable — coaches can see dates and distinguish sessions. Adding a formal status model (draft/active/completed) would require a migration and UI for transitions. Deferred until pilot feedback indicates coaches need explicit status tracking. Session date provides implicit status for now.

## D19 — Synchronous Ref Guard for Score Entry Double-Submit Prevention
**Date:** 2026-03-15 | **Status:** Implemented

React's `setSaving(true)` is asynchronous — a second Enter key press within the same tick can bypass the `saving` state check and fire `handleScore` concurrently. Combined with no unique constraint on the evaluations table, this creates duplicate rows. Fixed with a synchronous `useRef` guard (`savingRef`) checked at the top of `handleScore` and in `handleKeyDown`. This is defense-in-depth alongside the existing `disabled={saving}` on the button. A prepared migration adds a partial unique index on evaluations as a DB-level backstop.

## D20 — Save-State Visual Indicators in Score Entry
**Date:** 2026-03-15 | **Status:** Implemented

During live tryouts, coaches need immediate visual confirmation that scores were saved. Previously only a brief toast appeared. Added: (1) a "Saved" / "Failed" flash indicator on the scoring card that auto-clears after 1.5s/3s, (2) a running session save counter ("12 saved" badge), (3) spinner + "Saving..." text on the save button during network round-trip. These give coaches persistent visual confidence without disrupting the rapid-entry flow.

## D21 — Duplicate Detection in RosterUpload via Name Index
**Date:** 2026-03-15 | **Status:** Implemented

RosterUpload had zero duplicate detection — importing a CSV twice created a fully duplicated roster. This is the most likely data corruption scenario for pilot usage, since coaches routinely re-import during tryout prep. Solution: fetch existing roster names on dialog open, build a normalized `Set<string>` for O(1) lookups, and check each imported row for (a) existing roster matches and (b) within-file duplicates. Duplicate rows are flagged in the preview with skip-by-default behavior. Coach can override with a toggle. This is name-based matching (case-insensitive) — sufficient for pilot where rosters are ≤60 players within a single program. Did not add a DB unique constraint on (program_id, first_name, last_name) because legitimate same-name players exist (siblings, common names). Application-layer detection with coach override is the correct approach.

## D22 — DataImport Within-File Row Merging and Re-Import Protection
**Date:** 2026-03-15 | **Status:** Implemented

DataImport had two duplicate gaps: (1) within-file duplicate rows for the same player created colliding attempt_number entries for the same metric, and (2) re-importing the same file doubled all evaluation records. Solution: `buildMatchedRows` now merges rows that map to the same player (by normalized name), with automatic attempt number collision avoidance — if row 7 has FB Velo attempt 1 and row 3 already claimed attempt 1, row 7's value gets bumped to the next available attempt number. `handleImport` now queries existing evaluations for the target (player_id, metric_id, attempt_number, coach_id, session_id) tuples and filters out any that already exist before inserting. This is a pre-insert check, not an upsert — existing scores are never overwritten, only new ones are added. The approach is defensive: it prevents the most common accidental duplication without requiring a DB unique constraint (which would fail the insert and lose all data in the batch).

## D23 — Metric Coverage Indicator over Composite Reweighting
**Date:** 2026-03-15 | **Status:** Implemented

The composite percentile averages per-metric percentiles only for metrics a player has — this inflates rankings for players with partial data. Considered two approaches: (A) reweight composites to penalize missing metrics (e.g., treat missing as 0th percentile), or (B) keep the math and add visibility so coaches know which rankings are reliable. Chose (B) because: reweighting introduces subjective assumptions about what "missing" means (the player might be excellent at un-evaluated metrics), while a coverage indicator gives coaches the raw information to decide themselves. A player with "1/6 metrics" and a 95 composite clearly needs more evaluation — the coach can see this and act. The "partial" label and dimmed score provide the visual signal without changing the underlying calculation.

## D24 — Position Filter on Dashboard
**Date:** 2026-03-15 | **Status:** Implemented

Added a horizontal scrollable pill bar for position filtering on the Dashboard. Positions are derived from the current roster data (no hardcoded list), so they adapt to any sport. During tryouts, coaches frequently need to compare players at the same position — this was the most-missing filter for the core workflow. The `PlayerSearchFilters.tsx` component was not used because it's designed for the scout/recruiting search with many advanced filters; the Dashboard needs a single-tap, minimal-friction filter that doesn't disrupt the ranking view.

## D35 — Client-Side Analytics Aggregation over SQL Views for Monitoring Page
**Date:** 2026-03-15 | **Status:** Implemented

The Pilot Analytics page needed to display event summaries. Two approaches: (A) query the SQL views created in the analytics_views migration, (B) query the raw `analytics_events` table and aggregate in JavaScript. Chose (B) because: Supabase's JS client can't query views without adding them to the TypeScript types file (auto-generated, 57KB, editing it is fragile), and creating RPC functions for each view adds migration complexity. The raw table query is a single `select().eq().limit(5000)` call, and the aggregation logic is trivial `Map`-based grouping in `useMemo`. The SQL views still exist for developers who want to run queries directly in Supabase Studio or psql — they're the primary monitoring tool. The React page is a convenience UI. This dual approach (SQL views for developers + client-side page for coaches) covers both audiences without coupling them.

## D34 — Lightweight Pilot Analytics (Fire-and-Forget)
**Date:** 2026-03-15 | **Status:** Implemented

Before introducing the system to real pilot programs, we need to observe how coaches actually use the product — which workflows are used, how often, and in what order. Considered three approaches: (A) a third-party analytics SDK (Mixpanel, PostHog), (B) browser-side logging to console/localStorage, (C) a simple Supabase table with a fire-and-forget `track()` function. Chose (C) because: third-party SDKs add bundle size, privacy concerns, and configuration overhead for a pilot; browser-side logging requires manual export; and a Supabase table reuses existing infrastructure, supports RLS, and enables SQL queries directly from the dashboard. The `track()` function returns void (not Promise), uses `.then()` internally, and silently drops failures via `console.debug`. This ensures zero UI impact — a failed analytics insert never delays a score save or blocks a filter change. PII sanitization strips name/email/phone fields from properties before insert. Eight events cover the core tryout workflow: roster import, player creation, metric configuration, session creation, score entry, ranking filter, player profile view, and evaluator filtering. Properties capture workflow metadata (count, source surface, filter type) without personal player data.

## D33 — Station Mode Scoring Progress Indicator
**Date:** 2026-03-15 | **Status:** Implemented

Pilot simulation with 40 players revealed that coaches in Station Mode had no way to see how many players had been scored for the current metric. The "Player X of Y" counter shows position in the list, but not completion status. With a large roster and multiple metrics, this creates anxiety about missed players and makes it impossible to know when to switch metrics. Solution: a progress bar below the player name showing "X/Y scored" + percentage with a smooth animated fill bar. The implementation derives scored count from `existingEvals` (already fetched for attempt tracking), using a `useMemo` that builds a Set of player IDs from the eval array and counts how many filtered players are in the Set. Zero additional DB queries. The progress updates live as scores are saved because `existingEvals` re-fetches whenever `recentScores` changes (existing dependency chain). Considered alternatives: (A) showing scored/unscored icons in the player list (too noisy at 40+ players), (B) a separate completion dashboard (too much navigation). The inline progress bar gives at-a-glance confidence without leaving the scoring flow.

## D32 — Metric Deletion Confirmation with Eval Count Warning
**Date:** 2026-03-15 | **Status:** Implemented

Pilot QA finding #12: MetricsManager allowed one-tap metric deletion that cascaded all associated evaluations without warning. A coach with 60 players and 5 attempts each could lose 300 scores with a single accidental tap. Solution: AlertDialog confirmation that fetches the evaluation count for the metric before showing the dialog. If scores exist, the warning is explicit ("47 scores permanently removed") and the confirm button includes the count. Pattern matches the existing session deletion confirmation (AppLayout). The eval count fetch uses `select("id", { count: "exact", head: true })` for a lightweight count-only query.

## D31 — Inline Event Creation on ScoreEntry (Pilot QA Fix)
**Date:** 2026-03-15 | **Status:** Implemented

Pilot QA walkthrough identified ScoreEntry's "Select an event" message as the highest-friction point for new coaches. The previous behavior required the coach to discover the Event dropdown in the AppLayout header — a small, unlabeled control — before they could begin scoring. During a real tryout, this is a dead end. Considered three approaches: (A) auto-create a default session on first visit, (B) redirect to a session creation page, (C) inline event creation directly on ScoreEntry. Chose (C) because: auto-creating a session (A) produces a "Session 1" name with no meaning, and redirecting (B) breaks the coach's mental flow. Inline creation keeps the coach on the scoring page, explains what events are for, and produces a meaningfully-named event. Two states: when no events exist, show CalendarPlus icon with name input and Create button; when events exist but none selected, show quick-select buttons for up to 5 recent events. Both states use amber callout styling consistent with the retry queue banner, signaling "action needed" without being alarming.

## D30 — Metric Threshold Filter (Type-Aware Direction)
**Date:** 2026-03-15 | **Status:** Implemented

Coaches need numeric cutoffs ("sub-7.0 sixty", "exit velo ≥ 80") but the Dashboard had no threshold filtering. The key design decision was handling metric type direction: timed metrics (60-yard dash, shuttle) are lower-is-better, while measured (exit velo, broad jump) and rated (1-10 arm strength) are higher-is-better. The filter must respect this or coaches get inverted results. Solution: threshold input appears only when a specific metric is selected, with a "Max:" label for timed metrics (exclude if score > threshold) and "Min:" label for measured/rated (exclude if score < threshold). The `is_timed` flag from the metric config drives direction — same flag used in percentile ranking (D-series). Players without a score for the selected metric are excluded when threshold is active, which is the honest behavior: if a player hasn't been evaluated on 60-yard time, they shouldn't appear in a "fastest sprinters" filter. Threshold clears on metric change to prevent stale cutoffs carrying over to different scales. The composable guard pattern (D29) made implementation trivial — one additional `if (fail) return false` block.

## D29 — Composable Filter Guards over Early Returns
**Date:** 2026-03-15 | **Status:** Implemented

The Dashboard filter chain had a logic bug: `filterMode === "evaluated"` used `return p.evalCount > 0` which short-circuited all downstream filters (position, grade). Rewrote the chain using composable `if (condition) return false` guards that AND correctly in every combination. This pattern makes adding new filters trivial — one more guard line — and prevents future filter-bypass bugs. The grade filter was the first new filter added using this pattern.

## D28 — PlayerDetail Eval Mutations via Service Layer with Dedicated Functions
**Date:** 2026-03-15 | **Status:** Implemented

PlayerDetail's inline score add/edit/delete used direct Supabase calls with no validation — a backdoor for invalid data. Considered two approaches: (A) reuse `saveScore()` (which requires session_id and attempt_number that PlayerDetail doesn't have), or (B) create dedicated service functions (`addAdHocScore`, `updateScoreValue`, `deleteScore`) that validate bounds without requiring full session context. Chose (B) because: PlayerDetail's inline add is intentionally ad-hoc (no session, no attempt tracking), and forcing it through the session-scoped `saveScore` would require either making session_id optional in the Zod schema (weakening ScoreEntry validation) or adding fake session data. Three focused functions with bounds-only validation keep both paths clean. All three use `validateScoreValue()` from the shared validation library — same bounds logic as ScoreEntry.

## D27 — Evaluator Filter on Dashboard (Pre-Aggregation)
**Date:** 2026-03-15 | **Status:** Implemented

Multi-coach tryouts produce blended rankings where the head coach cannot distinguish evaluator perspectives. Considered two approaches: (A) post-aggregation annotation (show evaluator names/badges on each score) or (B) pre-aggregation filtering (filter evals by evaluator before computing rankings). Chose (B) because: it's simpler, reuses the existing aggregation + percentile pipeline without modification, and provides the most actionable view — "what would rankings look like based on Coach Smith's scores alone?" Post-aggregation annotation would require restructuring `PlayerRow` to carry per-evaluator breakdowns, which is future work for a comparison view. The filter applies before the `evalsByPlayerMetric` grouping loop, so all downstream math (aggregation, composites, percentiles, sort) recomputes correctly on the filtered subset. Only programs with 2+ coaches see the filter bar — single-coach programs are unaffected.

## D26 — Retry Queue for Score Entry Network Failures
**Date:** 2026-03-15 | **Status:** Implemented

Score entry during live tryouts is the single most critical workflow. Network failures on gym Wi-Fi or cellular connections are expected. The previous behavior — toast error, "Failed" flash, coach must re-enter — is unacceptable at tryout pace. Considered three approaches: (A) offline-first with IndexedDB persistence, (B) service worker background sync, (C) in-memory retry queue with exponential backoff. Chose (C) because: it's the smallest change that solves the immediate problem, requires no new dependencies, works within the existing React component lifecycle, and is architecturally extensible to (A) later. The queue uses a composite key `player_id|metric_id|attempt_number|coach_id` for dedup — if a coach re-enters a score while a previous attempt for the same slot is queued, the latest value replaces the queued one (last-write-wins is correct here since the coach is correcting their own entry). Exponential backoff (2s, 4s, 8s, 16s) prevents hammering a flaky connection. Max 4 retries before surfacing to coach as permanently failed with manual retry option. The `saveScore` function now returns a `retryable` flag distinguishing validation errors (not retryable — coach must fix) from Supabase errors (retryable — queue handles).

## D25 — SECURITY DEFINER Function for Coach Email Linking
**Date:** 2026-03-15 | **Status:** Implemented (migration prepared)

The coach invitation flow was completely broken: CoachManager created placeholder records with `user_id: crypto.randomUUID()`, but no code existed to link the placeholder to the real user on signup. The UPDATE RLS policy on coaches only allows head coaches, so the newly signed-up assistant can't update their own placeholder. Solution: a `link_coach_by_email` SECURITY DEFINER function that bypasses RLS for this specific controlled operation. The function validates the authenticated user, finds a matching placeholder by email, prevents duplicate program membership, and atomically links the record. Called from AuthContext during role detection — if `fetchCoaches` fails (no matching user_id), we try `link_coach_by_email` before falling through to other roles. This is safe because: (1) it only matches records where email matches auth email, (2) it prevents creating duplicate coach records in the same program, (3) it runs atomically in a single transaction.
