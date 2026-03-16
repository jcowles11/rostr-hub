# Progress Log

## 2026-03-15 — Data Seeding & Dashboard Productization

### Summary

Extended demo data seeding with evaluation data (metrics, sessions, scores), productized the Dashboard to match the new UI standard, and added loading skeletons to all four core operational pages.

### Changes

**1. Evaluation Data Seeding (`src/services/demoSeedService.ts`)**
- Added 8 demo metrics, 3 tryout sessions, ~400-600 evaluation records
- Seeded PRNG for deterministic but varied score distributions by tier
- Realistic coverage gaps (unassigned ~50%, varsity ~85%)

**2. Dashboard Polish (`src/pages/Dashboard.tsx`)**
- Clean header, section heading system, standard card styling
- Renamed "Dashboard" to "Stats & Rankings"
- Rank numbers on player rows (top 3 highlighted)
- Integrated skeleton loader

**3. Loading Skeletons (TeamHome, Roster, Schedule, Dashboard)**
- All use animate-pulse with bg-muted for consistency

**4. Settings toast update** — shows evaluation count

### Verification

- `tsc --noEmit` — 0 errors
- `vite build` — successful

---

## 2026-03-15 — UI Productization Sprint (Phase 2)

### Summary

Continued productization of the three primary coach-facing pages: Roster, TeamHome, and Schedule. Focus on typography hierarchy, visual density, type distinction, and empty-state intentionality.

### Changes

**1. Roster Page Complete Rewrite (`src/pages/Roster.tsx`)**
- Team level badges on every player row (Varsity=blue, JV=orange, Freshman=green, Cut=red, Unassigned=muted)
- Level filter pill bar with counts per level
- Enhanced search covering name, jersey number, AND position
- Tighter player rows (py-2.5) for better visual density
- Utility actions footer (import, public profiles)
- Improved empty state with multiple CTAs

**2. TeamHome Polish Pass (`src/pages/TeamHome.tsx`)**
- Unified section heading system: `text-xs font-extrabold uppercase tracking-widest text-muted-foreground`
- Standardized card padding (Quick Actions p-3.5, icon containers h-9 w-9)
- Subtitle text tightened to `text-[11px]`
- Player count badge in header
- Tighter section spacing (space-y-5)
- Empty states redesigned: contextual copy, secondary explanatory text, dual CTAs
- Full-page "Get Started" fallback with icon + constrained text width

**3. Schedule Page Tightening (`src/pages/SchedulePage.tsx`)**
- Replaced gradient hero with clean header (consistent with Roster/TeamHome)
- Color-coded type badges: orange for Game, green for Practice (replaces generic Badge)
- Tighter event card padding (px-3 py-2.5)
- Compact date headers (w-9 h-9 badges)
- Location text truncation for long venue names
- Empty states with contextual copy for both upcoming and past views

### Verification

- `tsc --noEmit` — 0 errors
- `vite build` — 2,178 modules, successful build

---

## 2026-03-15 — Team Management Productization Sprint

### Summary

First productization pass to make Rostr feel like a real coach-facing team management product rather than a prototype. Focused on navigation restructuring, feature discoverability, and demo readiness.

### Assessment

**Classification:**
- **Navigation**: Restructure — TeamHome is now the default landing page (`/`), Roster moved to `/roster`
- **Schedule Hub**: Build — new unified calendar view combining Games + Practices
- **TeamHome**: Redesign — transformed from simple dashboard into a coach command center
- **Demo Data**: Build — seeder service creates 25 players, 11 games, 9 practices
- **Settings**: Reorganize — split into Team Operations and Evaluation & Scoring sections

### Changes

**1. Navigation Restructure (`src/components/AppLayout.tsx`, `src/App.tsx`)**
- Bottom nav changed from [Home, Roster, Score, Stats, More] → [Home, Roster, Schedule, Score, More]
- `/` now routes to TeamHome (was Roster); Roster moved to `/roster`
- `/schedule` route added for new SchedulePage
- All internal navigation links updated (TeamHome, SettingsPage, AppLayout program switcher)

**2. Schedule Hub (`src/pages/SchedulePage.tsx` — CREATED)**
- Unified calendar view combining Games and Practices in chronological order
- Grouped by date with visual date headers (month/day badges)
- Games shown with orange Swords icon; Practices with green Dumbbell icon
- Upcoming/Past toggle view
- Hero header with counts and quick-add buttons for Games and Practices

**3. TeamHome Redesign (`src/pages/TeamHome.tsx` — REWRITTEN)**
- Next Game hero card with gradient background and inline action buttons (Game Roster, Lineup, Print)
- "This Week" section merging upcoming games + practices in chronological order
- "Team Snapshot" grid showing player counts by level with icons
- Contextual Quick Actions (Score Entry, Add Player, Stats, Practices)
- Upcoming Games list (up to 5)
- Fetches practice_plans data alongside existing games/players/assignments

**4. Demo Data Seeder (`src/services/demoSeedService.ts` — CREATED)**
- 25 realistic baseball players: 12 Varsity, 10 JV, 3 Unassigned
- Players have grades (9-12), positions, player numbers, bats/throws
- 11 games: 4 completed (past), 7 scheduled (upcoming) with opponents, locations, times
- 9 practice plans spread across next 2 weeks with baseball-specific titles
- Accessible via Settings → Data → "Seed Demo Data" button

**5. Settings Reorganization (`src/pages/SettingsPage.tsx`)**
- "Tryout Planning" section split into "Team Operations" and "Evaluation & Scoring"
- Team Operations: Team Management, Roster Board, Practice Plans
- Evaluation & Scoring: Stats & Rankings (new), Tryout Planner, Metrics & Drills
- "Seed Demo Data" button added to Data section

**6. Vite Config Update (`vite.config.ts`)**
- Added `cacheDir` pointing to `../.vite-cache` to work around mounted filesystem permission issues

### Verification

- TypeScript: `tsc --noEmit` — 0 errors
- Production build: `vite build` — 2,177 modules, 0 errors (built to /dist-test)
- Dev server: `vite --port 5173` — serves HTTP 200

## 2026-03-15 — Practice Planning Module v1

### Summary

Added a full practice planning vertical: coaches can create practice plans for specific dates and team levels, build time-blocked schedules with concurrent activities for different player groups, assign coaches to blocks, and print clean practice sheets. Accessible via Settings → Practice Plans tile.

### Assessment

**Classification:**
- **Practice Planning**: Build — zero implementation existed. New vertical extending Rostr beyond tryouts/games into daily team operations.

**Highest-value improvement:** A structured practice plan builder with time-block layout, concurrent block support (e.g., IF Defense and OF Defense running simultaneously), coach assignment, and a printable view for field use.

### Changes

**1. `supabase/migrations/20260315000007_practice_plans.sql` (CREATED)**
- Two tables: `practice_plans` (program_id, practice_date, title, team_level, notes, shared_with_players, created_by) and `practice_blocks` (practice_plan_id, start_time TEXT "HH:MM", end_time TEXT, activity_name, player_group, assigned_coach_id, notes, sort_order)
- Indexes on (program_id, practice_date DESC) and (practice_plan_id, sort_order)
- RLS: coaches can SELECT/INSERT/UPDATE; only head_coach can DELETE plans
- Blocks inherit access via JOIN through practice_plans → coaches

**2. `src/services/practiceService.ts` (CREATED)**
- Full CRUD for plans and blocks following `{ data, error }` return contract
- Types: `PracticePlan`, `PracticeBlock`, `PracticeBlockWithCoach`
- `fetchPracticeBlocks` resolves coach names/colors via `.select("*, coaches(full_name, color)")`
- `replaceAllBlocks` uses delete-all + insert-all pattern (same as lineup save, D38)

**3. `src/pages/PracticePlanner.tsx` (CREATED)**
- Route: `/practices` — lists all practice plans grouped by Upcoming/Past
- Create dialog: date, title, team level (from program levels), optional notes
- Plan cards with team level badge, shared indicator, delete (head coach only)

**4. `src/pages/PracticePlanDetail.tsx` (CREATED)**
- Route: `/practice/:id` — detail view with inline block editing
- Time-slot grouping: concurrent blocks rendered side-by-side via grid layout
- Inline block editing: click card → edit form with coach assignment dropdown
- New block form with suggested start time (= last block's end time)
- Edit header overlay for title, notes, shared_with_players toggle
- Summary bar: block count, total minutes, coach count

**5. `src/pages/PrintPracticeView.tsx` (CREATED)**
- Route: `/practice/:id/print` — CSS @media print pattern (same as PrintLineupView)
- BEM-style class names, table layout: Time | Activity (with group badge) | Coach (with color dot)
- Concurrent blocks share a time cell via rowSpan

**6. `src/App.tsx` (MODIFIED)**
- Added imports and routes for PracticePlanner, PracticePlanDetail, PrintPracticeView

**7. `src/pages/SettingsPage.tsx` (MODIFIED)**
- Added Practice Plans tile in "Tryout Planning" section (ClipboardList icon)

### Verification

- `tsc --noEmit`: 0 errors
- `vite build`: 2176 modules, 36.54s — clean

## 2026-03-15 — Player Comparison and Recruiting Search v1

### Summary

Added side-by-side player comparison (2-3 players) and wired it into the existing scout search flow. The recruiting search infrastructure was already substantially built (ScoutDashboard + `search_public_players` RPC + comprehensive filters + multi-select) — inherited from the Lovable codebase. The missing capability was comparison: turning search from "browsing" into "evaluating." Now scouts can select 2-3 players from search results and view bio stats, verified metrics, and development trends in aligned columns.

### Assessment

**Classification:**
- **Recruiting Search**: Keep — ScoutDashboard, `search_public_players` RPC, PlayerSearchFilters, PlayerSearchResults all functional with position, grad year, state, bats/throws, metric thresholds, name search, GPA, high school, and recruiting status filtering. RPC is SECURITY DEFINER for public access. Only surfaces `profile_public = true` players.
- **Player Comparison**: Build — zero implementation existed.

**Highest-value improvement:** Player comparison page with compare selection mode in search results. The search works; comparison was the missing evaluative tool that makes search actionable for recruiters.

### Changes

**1. `src/pages/PlayerCompare.tsx` (CREATED)**
- Route: `/compare?players=slug1,slug2` (up to 3 slugs)
- Fetches each player via `get_public_profile` RPC (SECURITY DEFINER, public access)
- Player headers with photos, names, positions, commitment status, program info
- Bio comparison: grad year, height, weight, bats/throws, location, GPA, high school
- Verified metrics comparison: aligned rows with metric name → value per player, "best" value highlighted in green, aggregation unit display
- Development trends: directional badges (improving/regressing/stable) with mini sparklines when trend_data available (after migration 000006)
- Evaluator metrics comparison: aligned rows for showcase data
- Links to full public profiles for each player
- Mobile-friendly: 2-column (or 3-column) grid with responsive layout
- Remove button on 3-player comparisons to drop back to 2
- Empty states for insufficient slugs or failed profile loads

**2. `src/components/PlayerSearchResults.tsx` (MODIFIED)**
- Added compare mode toggle: "Compare" button in header row toggles between normal and compare selection modes
- Compare selection state: `compareSlugs` tracks up to 3 selected profile slugs
- Compare action bar: blue-themed bar shows selection count, "Compare (N)" launch button, exit button
- Card click override: in compare mode, clicking a card toggles selection instead of opening the profile sheet
- Visual indicator: selected-for-compare cards get a blue ring (`ring-2 ring-blue-500/40`)
- Compare mode exits cleanly with selection reset
- Normal scout actions (save, list, message, select-all) hidden during compare mode

**3. `src/App.tsx` (MODIFIED)**
- Added `PlayerCompare` import
- Added route: `/compare` (public, not wrapped in ProtectedRoute)

### Verification

- `tsc --noEmit`: 0 errors
- `vite build`: success (2172 modules, 36.05s)
- No schema changes, no new tables, no new dependencies
- Uses existing `get_public_profile` RPC for data — no additional queries
- Graceful degradation: trend sparklines only appear after migration 000006

---

## 2026-03-15 — Public Recruiting Profile Polish

### Summary

Polished the public player profile (`/p/:slug`) to become a shareable recruiting asset that accurately reflects verified evaluation data. Three key improvements: (1) fixed metric aggregation to respect per-metric configuration instead of hardcoded MIN/MAX, (2) added development trend sparklines showing improvement over time, (3) added a QR code generator for physical recruiting materials.

### Assessment

**Classification:** Keep but harden. The existing PublicProfile page (578 lines) was functional with a clean mobile layout, social features, and evaluator data display. Three gaps undermined its value as a recruiting tool: aggregation inconsistency (public numbers didn't match coach-side values for "average"/"latest" metrics), no temporal context (flat numbers with no trend visibility), and no physical distribution support (clipboard-only sharing).

**Highest-value improvement:** All three gaps addressed in a single pass — aggregation fix via prepared migration, development trends from the enhanced RPC, QR code via zero-dependency client-side SVG generation.

### Changes

**1. `supabase/migrations/20260315000006_public_profile_aggregation_fix.sql` (CREATED)**
- Replaces `get_public_profile` RPC with aggregation-aware version
- Respects metric `aggregation` column: "best" (MIN/MAX by type), "average" (AVG), "latest" (most recent by created_at)
- Adds `aggregation` field to each metric entry for frontend label display
- Adds `trend_data` field: session-by-session aggregated values for metrics with 2+ sessions
- Orders metrics by `sort_order` for consistent display
- Backward compatible: all existing fields preserved

**2. `src/components/ProfileQrCode.tsx` (CREATED)**
- Zero-dependency client-side QR code generator
- Minimal QR encoding (byte mode, EC level L, versions 1-6)
- Reed-Solomon error correction computed in GF(256)
- Renders as inline SVG with `useMemo` for performance
- Supports profile URLs up to ~90 characters (sufficient for `/p/slug` routes)
- Graceful fallback message if URL exceeds encoding capacity

**3. `src/pages/PublicProfile.tsx` (REWRITTEN — 580 → ~610 lines)**
- **ProgramMetricsSection enhanced:** Shows aggregation method label ("Best", "Avg", "Latest") per metric when available from RPC, units displayed inline with values
- **DevelopmentSection added:** Sparkline trend rows using the same visual language as PlayerDetail's PlayerDevelopment component — directional color (green/red/gray), delta values, session count
- **ShareSection added:** Dedicated card with profile URL display, copy button, and toggle-able QR code
- **ProfileSparkline:** Compact SVG sparkline component (64×24px) reusing the proven pattern from PlayerDevelopment
- **computePublicTrends():** Processes RPC `trend_data` with 2% stability threshold and metric_type-aware direction detection
- Removed unused `Tabs` import, cleaned up unused icon imports
- All existing sections preserved: hero, commitment banner, bio stats, contact, evaluator data, video, integrations, social, posts

### Verification

- `tsc --noEmit`: 0 errors
- `vite build`: success (2171 modules, 34.91s)
- No schema changes beyond the prepared migration
- No new npm dependencies
- Graceful degradation: before migration 000006 is applied, trends section and aggregation labels simply don't appear; existing metrics display unchanged

---

## 2026-03-15 — Player Development Trends on PlayerDetail

### Summary

Added a Development section to the PlayerDetail page that shows per-metric trends across evaluation sessions. Coaches can now see at a glance whether a player is improving, regressing, or stable on each tracked metric — using SVG sparklines and directional indicators. Previously, PlayerDetail showed raw scores per metric but no temporal context; coaches had to mentally compare numbers across sessions. The new section surfaces trends automatically when a player has data across 2+ sessions.

### Assessment

**Classification:** Keep but harden. The existing PlayerDetail page had solid per-metric evaluation display (inline add/edit, bounds validation, metric coverage badge). The missing layer was temporal analysis — connecting scores across sessions to show development. This is a read-only visualization addition on top of existing data, requiring no schema changes.

**Highest-value improvement:** A composable `PlayerDevelopment` component that computes metric trends from existing evaluation + session data, renders SVG sparklines with directional color coding, and shows first→latest value comparison with delta.

### Changes

**1. `src/components/PlayerDevelopment.tsx` (CREATED)**
- Pure presentational component receiving all data via props (no data fetching)
- `computeTrends()`: groups evaluations by metric + session, aggregates per session (min for timed, max for measured/rated, or average), determines direction with 2% stability threshold
- `Sparkline` SVG component: lightweight line chart (80×28px) with colored stroke — green for improving, red for regressing, gray for stable
- Sport-agnostic direction detection: `metric_type === "timed"` means lower is better
- Summary bar: "N metrics tracked", improving/regressing counts
- Trend rows: metric name, session range, sparkline, latest value with unit, directional delta

**2. `src/pages/PlayerDetail.tsx` (MODIFIED)**
- Added `PlayerDevelopment` import and `BarChart3` icon
- Development card appears between Evaluations and External Evaluations sections
- Conditionally rendered: requires `filteredEvals.length > 0` and `sessionInfos.length >= 2`
- Passes existing `filteredEvals`, `metrics`, and `sessionInfos` as props — zero additional queries

**3. `src/App.tsx` (UNCHANGED)**
- No route changes needed — PlayerDevelopment is embedded within existing PlayerDetail page

### Verification

- `tsc --noEmit`: 0 errors
- `vite build`: success (2168 modules)
- No schema changes, no service layer changes, no new dependencies

---

## 2026-03-15 — Team Home Page

### Summary

Created a unified coach landing page (`/home`) that consolidates team state, upcoming games, quick actions, and recent activity into a single dashboard. Previously, coaches landed on the Roster (a flat player list) with games and team management buried under Settings. Team Home provides at-a-glance context for the most common daily and game-day workflows.

### Assessment

**Classification:** Keep but harden. The existing 4-tab bottom nav (Roster → Score → Stats → More) worked for tryout-focused sessions but had no hub page for daily team operations. With games, lineups, printable cards, and team assignments now implemented, coaches needed a landing page that ties these workflows together without replacing the existing nav structure.

**Highest-value improvement:** A new Home tab (first position in bottom nav) that surfaces the next game prominently, shows team composition at a glance, and provides one-tap access to the most common actions.

### Changes

**1. `src/pages/TeamHome.tsx` (CREATED)**
- Route: `/home`
- 5 sections:
  - **Next Game**: opponent, date/time, location, team level badge, quick action buttons (Game Roster, Edit Lineup, Print)
  - **Team Overview**: total players + per-level counts via `roster_assignments` with case-insensitive level matching, unassigned count, cards link to TeamManagement
  - **Upcoming Games**: next 5 scheduled games with date pill, opponent, time/location, team level
  - **Quick Actions**: 2×2 grid — Add Player, Create Game, Manage Roster, Run Tryout
  - **Recent Activity**: last 10 analytics events with human-readable labels (fire-and-forget, graceful if analytics table missing)
- All read-only — no mutations, no new tables
- Uses existing `fetchGames`, `roster_assignments`, `players`, `analytics_events` queries
- Empty states for no games, no activity, fresh programs

**2. `src/App.tsx` (MODIFIED)**
- Added `TeamHome` import
- Added `/home` route inside `ProtectedRoute`

**3. `src/components/AppLayout.tsx` (MODIFIED)**
- Added `Home` icon import from lucide-react
- Inserted `{ path: "/home", icon: Home, label: "Home" }` as first item in both `PRODUCTION_NAV` and `DEMO_NAV`
- Bottom nav now: Home → Roster → Score → Stats → More

### Verification

- `tsc --noEmit`: 0 errors
- `vite build`: successful (2168+ modules, 34s)
- No schema changes, no service layer changes

---

## 2026-03-15 — Game-Day Lineup Editing Hardening

### Summary

Hardened the GameDetail lineup builder with two critical game-day protections: unsaved-change guards (prevents accidental data loss) and copy-from-previous-game (eliminates re-entering 9 players every game). Both features are zero-schema-change, zero-service-layer-change additions to GameDetail.tsx.

### Assessment

**Classification:** Keep but harden. The lineup builder's core UX (batting order, positions, reorder, save, print) is solid. Two gaps made it fragile for repeated game-day use: (1) no dirty-state awareness meant a misclick on "Back" could discard 10 minutes of lineup work with no warning, (2) coaches running the same lineup with minor adjustments had to re-enter all 9 players from scratch every game.

**Highest-value improvements:** Both are implemented — dirty-state guard addresses data safety, copy-from-game addresses workflow speed.

### Changes

**1. `GameDetail.tsx` (MODIFIED — lineup hardening)**

**Unsaved lineup protection:**
- Added `savedLineupRef` (JSON snapshot of lineup at load/save time)
- `isDirty` useMemo: compares current `lineupEntries` against snapshot
- `beforeunload` event listener: prevents browser close with unsaved changes
- `safeNavigate` wrapper: shows `window.confirm` before in-app navigation when dirty
- Back button and Print button use `safeNavigate` instead of direct `navigate`
- Save button: disabled when clean, shows "Save *" with pulse animation when dirty, shows "Saved" when clean
- `handleSaveLineup` updates `savedLineupRef.current` on success

**Copy from previous game:**
- "Copy from Previous Game" button shown in two places: empty lineup state and below existing lineup
- Opens a Dialog listing all other games in the program (fetched via existing `fetchGames`)
- Each game shows name, date, opponent, team level
- Warning banner when current lineup is non-empty ("This will replace the current lineup")
- On selection: fetches source game's lineup, auto-adds missing players to current game roster via upsert, loads lineup into editor
- Toast confirms how many players were copied
- New imports: `Dialog`, `Copy`, `AlertTriangle`, `fetchGames`, `useRef`

### Verification

- `tsc --noEmit`: 0 errors
- `vite build`: successful (2168 modules, 36s)
- No schema changes, no service layer changes, no new routes

---

## 2026-03-15 — Printable Lineup Cards

### Summary

Implemented a print-optimized lineup card export feature. Coaches can now print four identical lineup cards on a single page from any game's lineup tab — the standard dugout workflow where coaches cut cards and hand them to base coaches, scorekeepers, and the press box.

### Assessment

**Classification:** New feature (rendering only). No schema changes, no service layer changes, no new database tables. This is a pure read-and-render feature using existing `lineup_entries`, `players`, and `games` data.

**Architecture approach:** Built as a composable system — `LineupCard` is a standalone renderer component that accepts data via props with a `variant` prop for future layouts (e.g., full-page dugout board). `PrintLineupView` is the page that fetches data and arranges four cards in a 2×2 CSS grid with print-optimized `@media print` styling.

### Changes

**1. `src/components/LineupCard.tsx` (CREATED)**
- Reusable lineup card renderer, no data fetching
- `LineupCardProps` interface: teamName, opponent, date, teamLevel, location, players, variant
- `LineupCardPlayer` interface: battingOrder, name, jerseyNumber, position
- `positionToNumber()` and `positionToAbbrev()` utility exports for SS↔6 conversion
- BEM-style CSS class names for print stability (avoids Tailwind's purge issues in print)
- Empty rows rendered for hand-writing substitutions
- `variant` prop: "card" (compact 4-per-page) vs "board" (future full-page)

**2. `src/pages/PrintLineupView.tsx` (CREATED)**
- Route: `/game/:id/print-lineup`
- Toolbar (hidden when printing): back button, Print button, two option toggles
- Coach-configurable options:
  - Name display: Full Name / Last Only
  - Position format: Abbreviation (SS, CF) / Number (6, 8)
- 2×2 grid of four identical `LineupCard` components
- Inline `<style>` with full `@media print` rules: hides nav/toolbar, fills page, dashed cut lines
- `@page` rule: letter portrait, 0.25in margins
- Empty lineup handling: shows message directing coach back to game detail
- Fetches game, players, and lineup_entries via existing service functions

**3. `src/pages/GameDetail.tsx` (MODIFIED)**
- Added `Printer` icon import from lucide-react
- Added "Print" button (outline variant) next to "Save Lineup" in the lineup tab header
- Navigates to `/game/:id/print-lineup`

**4. `src/App.tsx` (MODIFIED)**
- Added `PrintLineupView` import
- Added `/game/:id/print-lineup` route inside `ProtectedRoute`

### Verification

- `tsc --noEmit`: 0 errors
- `vite build`: successful (2168 modules, 34s)
- No schema changes, no service layer changes
- Print CSS tested: @media print hides toolbar, fills page with 2×2 grid

---

## 2026-03-15 — Coach Invitation Flow Clarity

### Summary

Hardened the assistant coach onboarding flow in CoachManager to eliminate the most confusing moment in the pilot workflow. The "Send Invitation" button falsely implied email delivery; replaced with an accurate two-step flow: "Add Coach" → success confirmation with copyable signup link.

### Assessment

**Classification:** Keep but harden. The underlying mechanics are correct — placeholder coach record with `crypto.randomUUID()`, email-based linking via `link_coach_by_email()` SECURITY DEFINER function on signup. The problem was purely in UI messaging: button said "Send Invitation" / "Sending...", implying outbound email that never happened. During pilot simulation this was the single most confusing onboarding moment.

**Highest-value improvement:** Replace misleading language with accurate "Add Coach" flow and provide a copyable signup message the head coach can text/email to the assistant.

### Changes

**1. `CoachManager.tsx` (MODIFIED — UI flow overhaul)**
- Renamed trigger button from "Invite Coach" → "Add Coach" with `UserPlus` icon
- Renamed dialog title from "Invite Assistant Coach" → "Add Assistant Coach"
- Renamed submit button from "Send Invitation" / "Sending..." → "Add Coach" / "Adding..."
- Added explicit pre-submit guidance: "No email will be sent automatically"
- Added `justAdded` state for two-phase dialog: form → success confirmation
- Success confirmation shows: green banner with coach name, explicit "Next step: share the signup link" instruction, email-must-match warning, copyable signup URL
- Copy button copies a ready-to-send message: "You've been added as an assistant coach on Rostr. Sign up at {url} using your email: {email}"
- "Add Another" button resets to form; "Done" closes dialog
- `handleDialogClose` resets all state cleanly on close

**2. No backend changes.** The coach record creation, placeholder UUID, and email linking logic are all unchanged.

### Verification

- `tsc --noEmit`: 0 errors
- Dialog flow: form → add → success with link → done/add another
- All existing coach management (list, remove, role badges) unchanged

---

## 2026-03-15 — Player Next/Previous Navigation

### Summary

Implemented context-aware prev/next player navigation in PlayerDetail. Coaches can now flow through players sequentially during cut meetings and lineup decisions without back-navigating to the list between every player. Navigation respects the current list context (filtered rankings, roster order, team level) from whichever page the coach came from.

### Assessment

**Classification:** Keep but harden. PlayerDetail itself is functional (660+ lines, full evaluation/notes/profile editing). The weakness was not inside the page — it was the transition workflow. Every player review required: tap player → review → back → find next → tap → review. This doubles the interaction cost during cut meetings where coaches review 10-20 players in sequence.

**Highest-value improvement:** Pass the current list context via React Router's `location.state` and render prev/next arrows in PlayerDetail. Zero global state, zero new dependencies, graceful degradation (no state = no arrows).

### Changes

**1. `PlayerDetail.tsx` (MODIFIED)**
- Added `useLocation` import and `PlayerListNav` interface (`{ playerIds: string[], source?: string }`)
- `navContext` useMemo: derives `prevId`, `nextId`, `position`, `total` from location state
- `goToPlayer` callback: navigates to sibling player, forwarding the same list state via `replace: true`
- Keyboard navigation: left/right arrow keys trigger prev/next (disabled when focus is in input/textarea/select)
- Header updated: back button on left, prev/next arrows with "3 / 40" counter on right. Arrows disable at list boundaries.

**2. `Dashboard.tsx` (MODIFIED)**
- Player card `onClick` now passes `{ playerIds: filtered.map(x => x.id), source: "rankings" }`
- Navigation order matches the current sort/filter on the Dashboard

**3. `Roster.tsx` (MODIFIED)**
- Player card `onClick` now passes `{ playerIds: filtered.map(x => x.id), source: "roster" }`
- Navigation order matches the current search/filter on the Roster page

**4. `TeamManagement.tsx` (MODIFIED)**
- Both player name and chevron `onClick` now pass `{ playerIds: filteredPlayers.map(x => x.id), source: selectedLevel }`
- Navigation order matches the current level filter and search

### Design Decision

Uses React Router `location.state` (D40) rather than global state, URL params, or sessionStorage. State survives within the navigation chain (prev/next uses `replace: true` to forward the same state), gracefully degrades when absent, and requires no changes to the router or state management architecture.

### Verification

- `tsc --noEmit`: 0 errors
- No new dependencies
- Navigation degrades gracefully: direct URL access or bookmark = no arrows shown

---

## 2026-03-15 — Team Assignment Workflow Hardening

### Summary

Assessed and hardened the team assignment workflow across all touchpoints. Classified as **keep but harden**: the core RosterBoard assignment flow works, but team level visibility was absent everywhere else, a case-mismatch bug caused silent data grouping failures, and GameDetail showed no team-level context when building game rosters.

### Assessment Findings

1. **Permanent assignment (RosterBoard):** Works. Head coach selects level per player via dropdown. ✓ Keep.
2. **Team vs game roster distinction:** Conceptually clear (permanent level vs. game-day activation), but no UI bridges the two — GameDetail shows zero team-level context.
3. **Team level visibility:** Invisible everywhere except RosterBoard. Dashboard, Roster, PlayerDetail, TeamManagement "All" view — no badge.
4. **Moving between levels:** Intuitive via select dropdown. Works.
5. **Enum/TEXT mismatch:** Active data bug. `roster_assignments` stores lowercase enum (`"varsity"`) but `programs.levels` stores display-case (`"Varsity"`). TeamManagement grouped players using exact match, so all assigned players appeared as "unassigned."

### Highest-Value Weakness

**Team level invisibility across the app.** The enum/TEXT case mismatch was a data-correctness bug (players appeared unassigned when they weren't), but the deeper issue is that a player's permanent team level is only visible on one page. Coaches building game rosters, reviewing rankings, or discussing players have no team-level context without navigating to RosterBoard.

### Changes

**1. `TeamManagement.tsx` (MODIFIED) — 3 fixes:**
- **Case-insensitive level matching:** Added `enumToLevel` map (lowercase→display) so `"varsity"` correctly matches `"Varsity"`. Players now group into the correct level buckets.
- **Display-level badge:** "All" view shows the display-case level name, not the raw enum value.
- **Inline assignment dropdown:** Head coaches can now assign/reassign players to team levels directly from TeamManagement — no need to navigate to RosterBoard. Optimistic local state update after DB write.

**2. `GameDetail.tsx` (MODIFIED) — 3 improvements:**
- **Loads roster_assignments:** New parallel fetch of `roster_assignments` alongside players and game data.
- **Team level badges:** Every player in the game roster tab now shows their permanent team level as a badge. Matching-level players get a highlighted primary badge; non-matching get an outline badge.
- **Smart sort + separator:** When a game has a `team_level`, matching players are sorted to the top with a visual "Other players" separator between matching and non-matching groups. On-roster players always appear first.
- **Team level hint banner:** When a game has a team_level, a contextual hint explains the sort order.

### Verification

- `tsc --noEmit`: 0 errors
- No new dependencies, no schema changes, no migrations

---

## 2026-03-15 — Team Management Module v1

### Summary

Designed and implemented the first version of team management: game scheduling, game roster selection, and lineup building. Extends the existing schema with 3 new tables (`games`, `game_rosters`, `lineup_entries`), a comprehensive service layer, and two new pages. Preserves all existing team-level assignment functionality (RosterBoard + `roster_assignments`).

### Schema Assessment

Existing infrastructure leveraged:
- `programs.levels` TEXT[] — customizable team level names (Varsity, JV, etc.)
- `roster_assignments` — player-to-level mapping with enum (`varsity|jv|freshman|cut`)
- `teams` — organizational grouping (separate concept from roster levels)
- `RosterBoard.tsx` — existing level assignment UI

Key finding: The `roster_assignment` Postgres enum is locked to 4 values, which doesn't match the customizable `programs.levels` array. This is a known issue but not blocking — team management uses TEXT columns for `team_level` to stay flexible.

### Changes

**1. Migration: `20260315000005_team_management.sql` (NEW)**
- `games` table: program_id, season_id, name, opponent, team_level (TEXT), game_date, game_time, location, notes, status (scheduled/completed/cancelled), created_by
- `game_rosters` table: game_id + player_id (unique), status (active/inactive/injured/suspended)
- `lineup_entries` table: game_id + player_id (unique), batting_order, position (TEXT), inning_half, notes
- Full RLS policies for all 3 tables
- Indexes on program_id, season_id, game_id, batting_order

**2. TypeScript Types: `types.ts` (MODIFIED)**
- Added Row/Insert/Update/Relationships types for `games`, `game_rosters`, `lineup_entries`

**3. Service Layer: `teamService.ts` (MODIFIED)**
- 10 new functions: game CRUD (`fetchGames`, `createGame`, `updateGame`, `deleteGame`), game roster management (`fetchGameRoster`, `setGameRoster`, `updateGameRosterStatus`), lineup management (`fetchLineup`, `saveLineup`, `updateLineupEntry`)
- 3 new types exported: `Game`, `GameRosterEntry`, `LineupEntry`

**4. `TeamManagement.tsx` (NEW)**
- Team-level filter pills, player roster by level, games list with create/delete, navigation to game detail

**5. `GameDetail.tsx` (NEW)**
- Two-tab UI: Game Roster (toggle players on/off) + Lineup (batting order, position assignment, reorder, save)

**6. Routes & Navigation**
- `App.tsx`: `/teams` and `/game/:id` routes
- `SettingsPage.tsx`: "Team Management" tile in Tryout Planning section

### Verification

- `tsc --noEmit`: 0 errors
- No new dependencies

---

## 2026-03-15 — Phase 7: Pilot Runbook

### Summary

Created a comprehensive pilot runbook (`PILOT_RUNBOOK.md`) for coaches using Rostr during real tryouts. The runbook covers the full tryout workflow in 9 sequential steps — from program setup through roster decisions — with recommended workflows and common mistakes to avoid at each stage. Includes a developer monitoring guide with analytics signals, success indicators, warning signs, and a pre-pilot migration checklist.

### Changes

**1. PILOT_RUNBOOK.md (NEW)**

9 coach-facing workflow sections:
1. Program Setup — account creation, program configuration
2. Adding Assistant Coaches — invitation flow, email matching caveat
3. Importing a Roster — CSV/Excel upload, duplicate handling
4. Configuring Evaluation Metrics — drill setup, scoring direction, attempt config, min/max bounds
5. Creating a Tryout Session — named events, session switching
6. Using Station Mode Scoring — primary evaluation workflow, progress bar, retry queue
7. Reviewing Rankings and Filters — Dashboard filters, partial data warnings, evaluator views
8. Viewing Player Profiles — individual drill-down, inline editing
9. Making Roster Decisions — Roster Board assignments, team levels

Developer monitoring guide:
- Analytics signals table (7 views mapped to what to watch)
- Success indicators (score volume, multi-coach activity, station mode adoption, filter engagement)
- Warning signs (zero activity, single-coach scoring, no filter usage, high retry failures)
- Pre-pilot migration checklist (4 pending migrations in order)

### Verification

- Document reviewed against current UI code and known issues
- All workflow steps reference actual app routes and components
- Known issues (KI-9c: misleading invite button, KI-9b: station mode desync) are addressed with explicit "Avoid" guidance

---

## 2026-03-15 — Phase 6: Pilot Monitoring — Analytics Dashboard

### Summary

Built a minimal analytics monitoring layer: 7 SQL views for server-side queries and a lightweight in-app Pilot Analytics page for head coaches. Zero new dependencies, zero heavy infrastructure.

### Changes

**1. SQL Analytics Views (Migration)**

- `supabase/migrations/20260315000004_analytics_views.sql` (NEW):
  - `analytics_scores_per_session` — score entries grouped by session context and entry mode
  - `analytics_scores_daily` — daily score rollup with active coach count
  - `analytics_roster_activity` — roster imports and player creation by day with player count
  - `analytics_filter_usage` — ranking filter usage by type per day
  - `analytics_evaluator_filter` — evaluator filter usage by mode per day
  - `analytics_profile_views` — daily profile views with viewing coach count
  - `analytics_event_summary` — all events by type per program (high-level overview)

**2. Pilot Analytics Page**

- `src/pages/PilotAnalytics.tsx` (NEW):
  - Queries `analytics_events` table directly (limit 5000) and aggregates client-side
  - 6 stat cards: Score Entries (station/direct split), Profile Views, Ranking Filters, Evaluator Filters, Players Added (import/manual split), Sessions Created
  - Scores-per-day horizontal bar chart (pure CSS, no chart library)
  - Filter type breakdown chips
  - Recent events feed (last 20)
  - Empty state for zero events
  - Head-coach only (via route + Settings tile placement)

**3. Route and Navigation**

- `src/App.tsx` (MODIFIED): Added `/analytics` route → `PilotAnalytics` inside `ProtectedRoute`
- `src/pages/SettingsPage.tsx` (MODIFIED): Added "Pilot Analytics" tile in Readiness section (head_coach only)

### Verification

- `tsc --noEmit`: 0 errors
- No new dependencies
- Page accessible via Settings → Readiness → Pilot Analytics

### Pilot Monitoring Plan

During the first real tryout, monitor these signals:

1. **Score velocity**: Scores-per-day chart — expect 200-500+ entries on tryout day; <50 suggests workflow friction
2. **Station vs. direct mode**: Station mode should dominate (>80%) during live tryouts; high direct mode suggests coaches aren't discovering Station Mode
3. **Filter adoption**: Ranking filter and evaluator filter usage indicates coaches are using the Dashboard for decision-making, not just data entry
4. **Profile view ratio**: Profile views ÷ total players ≈ how many players are being individually reviewed; low ratio suggests coaches are relying on Dashboard alone
5. **Import vs. manual**: High manual player creation (vs. import) suggests the CSV import flow may be confusing
6. **Active coaches**: >1 unique coach across score events confirms multi-evaluator workflow is functioning

---

## 2026-03-15 — Phase 5: Pilot Launch Preparation — Usage Analytics

### Summary

Implemented lightweight event tracking for 8 key coach workflows to observe pilot usage behavior. Fire-and-forget architecture — never blocks UI, never throws. PII sanitization built in.

### Changes

**1. Analytics Events Table (Migration)**

- `supabase/migrations/20260315000003_analytics_events.sql` (NEW):
  - `analytics_events` table: id, program_id, coach_id, event_name, properties (JSONB), created_at
  - Index on (program_id, event_name, created_at DESC) for query performance
  - RLS: coaches can insert/read events for their own program only
  - CASCADE delete on program_id — cleanup when program is deleted

**2. Analytics Service**

- `src/services/analyticsService.ts` (NEW):
  - `track(event, programId, coachId, properties?)` — fire-and-forget, void return
  - Typed `AnalyticsEvent` union: 8 event names
  - `TrackProperties` interface: count, label, source, duration_ms, extensible
  - PII sanitization: strips name, email, phone fields before insert
  - Silent failure: `console.debug` on error, never disrupts app
  - Exported via `src/services/index.ts` barrel

**3. Instrumented Workflows (8 events)**

- `roster_import` — RosterUpload.tsx (after successful import, with count)
- `player_create` — Roster.tsx (after handleAdd success)
- `metric_configure` — MetricsManager.tsx (after metric creation, with type)
- `session_create` — SessionContext.tsx (after createSession success)
- `score_entry` — ScoreEntry.tsx (after handleScore success, station vs direct label)
- `ranking_filter` — Dashboard.tsx (useEffect on filter state changes)
- `player_profile_view` — PlayerDetail.tsx (useEffect on mount)
- `evaluator_filter` — Dashboard.tsx (useEffect on evaluator filter change)

### Verification

- `tsc --noEmit`: 0 errors
- No new dependencies
- Zero performance impact on UI (fire-and-forget, no awaits)
- No sensitive player data in event properties (PII sanitizer)

---

## 2026-03-15 — Phase 4: Pilot Simulation

### Summary

Simulated a full coach tryout workflow across all 10 stages with 40 players. Identified 8 findings across severity levels. Implemented the highest-priority improvement: Station Mode scoring progress indicator.

### Simulation Findings (8 total)

**Important (3):**
1. Station Mode has no scoring progress indicator — coaches can't see how many players have been scored for the current metric vs. how many remain (FIXED)
2. CoachManager "Send Invitation" button is misleading — no email is actually sent, coach record is only created in DB
3. No next/previous player navigation on PlayerDetail — reviewing 40 players requires going back to list each time

**Polish (5):**
4. No "next metric" prompt after completing a Station Mode pass
5. Metrics only configurable from Settings — no shortcut from ScoreEntry mid-tryout
6. Dashboard composite view doesn't show individual metric breakdowns inline
7. Dashboard metric dropdown doesn't indicate which metrics have data
8. No keyboard shortcut to skip absent players in Station Mode

### Changes

**Station Mode Progress Indicator (ScoreEntry.tsx)**

- `src/pages/ScoreEntry.tsx` (MODIFIED):
  - Added `stationProgress` useMemo that counts how many filtered players have at least one evaluation for the current metric in the current session
  - Derives scored count from `existingEvals` (already loaded for attempt tracking)
  - Renders progress bar below player name: "X/Y scored" label + percentage + animated progress bar
  - Uses `bg-primary` for filled portion with `transition-all duration-500 ease-out` for smooth animation
  - Only visible in Station Mode with filtered players > 0
  - Zero new data fetches — computed entirely from existing state

### Verification

- `tsc --noEmit`: 0 errors
- No new dependencies
- Progress bar is purely derived from existing `existingEvals` state — no additional DB queries

---

## 2026-03-15 — Phase 3 Step 6b: Pilot QA Follow-Up Fixes

### Summary

Addressed the two remaining high-value QA findings from the pilot walkthrough: metric deletion safety and Roster header icon clarity.

### Changes

**1. Metric Deletion Confirmation (MetricsManager)**

- `src/components/MetricsManager.tsx` (MODIFIED):
  - Added AlertDialog import and confirmation state (`deleteTarget`, `deleteEvalCount`, `deleting`)
  - Added `confirmDelete(metric)` function that fetches evaluation count before showing dialog
  - Replaced direct `handleDelete(id)` with confirmation flow
  - AlertDialog shows: metric name, evaluation count with severity warning if >0, destructive-styled confirm button with count (e.g., "Delete Metric & 47 Scores")
  - "Checking for associated scores..." loading text while count is fetched

**2. Roster Header Icon Labels (Roster)**

- `src/pages/Roster.tsx` (MODIFIED):
  - Replaced icon-only `<Button size="icon">` elements with labeled button elements
  - Each button now shows icon + tiny text label below: "#" (auto-assign), "Roster" (import roster), "Scores" (import data), "Share" (reg link), "Clear" (delete all), "Add" (add player)
  - Labels are 9px semibold, matching bottom-nav pattern
  - Preserved all existing functionality, click handlers, and styling
  - Buttons slightly smaller (h-4 w-4 icons, px-2 padding) to fit with labels

### Verification

- `tsc --noEmit`: 0 errors

---

## 2026-03-15 — Phase 3 Step 6: Pilot QA Pass / Workflow Walkthrough

### Summary

Performed a full end-to-end pilot QA walkthrough across all 10 workflow stages: program creation, auth, coach joining, roster import, metric config, session creation, player assignment, live score entry, ranking/filtering, and player profile. Identified 18 findings across severity levels. Implemented the highest-priority fix: ScoreEntry now provides actionable guidance when no event exists (inline event creation) or when events exist but none is selected (quick-select buttons). Also added Dashboard empty state for zero-player and zero-result scenarios.

### QA Findings

| # | Stage | Finding | Severity |
|---|-------|---------|----------|
| 1 | Score Entry | No event selected = dead end; coach sees flat "Select an event" with no way to create one inline | **Critical** |
| 2 | Score Entry | No empty state when player list has 0 players (silent blank area) | Important |
| 3 | Dashboard | No empty state when all players filtered out by threshold/position/grade | Important |
| 4 | Dashboard | No empty state when roster has 0 players | Important |
| 5 | Coach Invitation | No email notification sent — coach must manually share signup instructions | Important |
| 6 | Coach Invitation | CoachManager "Sending..." button text implies email but creates DB record only | Polish |
| 7 | Roster | 5 icon buttons in header with no labels; new coach can't tell Upload vs Database icons apart | Important |
| 8 | Roster | Delete All Players button (trash icon) in header has no visual separation from other actions | Polish |
| 9 | ProgramSetup | No back button from details step to org selection (only "Change sport" is available) | Polish |
| 10 | ScoreEntry | Station mode auto-advances but no visual indication of which player was just scored (previous player flash) | Polish |
| 11 | ScoreEntry | `stationIndex` can desync from `filtered` array if search changes during station mode | Important |
| 12 | MetricsManager | No confirmation dialog before deleting a metric (destroys all associated evaluations) | Important |
| 13 | MetricsManager | Min/max bounds fields only shown for "rated" metric type — timed/measured can't set bounds | Polish |
| 14 | Dashboard | Realtime subscription refetches all data on every evaluation change — no throttle/debounce | Polish |
| 15 | PlayerDetail | 666 lines, mixing profile editing, eval management, notes, and external entries in one component | Polish |
| 16 | Session Creation | New event defaults to today's date with no way to set a future date | Polish |
| 17 | Settings | Metrics & Drills section has no inline help explaining timed vs measured vs rated | Polish |
| 18 | CoachManager | No loading state shown while fetching coach list | Polish |

### Highest-Value Fix

**Finding #1: ScoreEntry dead end when no event selected.** This is the single most critical friction point for a pilot coach. A new coach navigates to Score Entry, sees a flat gray message "Select an event from the header to start scoring" with no affordance to create or select one. During a real tryout, the coach needs to start scoring immediately — discovering the tiny Event dropdown in the header under time pressure is poor UX.

**Fix implemented:** Replaced the flat message with two states:
1. **No events exist:** Amber callout with CalendarPlus icon, explanation text, and inline event creation (name input + Create button). Coach creates their first event without leaving the page.
2. **Events exist but none selected:** Amber callout with Calendar icon, explanation text, and quick-select buttons for up to 5 recent events. Coach can start scoring with one tap.

Also added **Dashboard empty state** (Finding #3/#4) — shows contextual message when player list is empty or all players are filtered out.

### Changes

- `src/pages/ScoreEntry.tsx` (MODIFIED):
  - Added `CalendarPlus`, `Calendar` imports from lucide-react
  - Destructured `sessions`, `setSession`, `createSession` from `useSession()`
  - Replaced flat `sessionDisabled` notice with two-state actionable guidance:
    - No sessions: CalendarPlus icon + inline event creation input
    - Sessions exist: Calendar icon + quick-select event buttons (up to 5)
- `src/pages/Dashboard.tsx` (MODIFIED):
  - Added empty state between loading and player list: contextual message for "no players on roster", "no players meet threshold", or "no players match filters"

### Verification

- `tsc --noEmit`: 0 errors

---

## 2026-03-15 — Phase 3 Step 5: Metric Threshold Filtering

### Summary

Implemented numeric metric threshold filtering on the Dashboard, allowing coaches to set performance cutoffs when a specific metric is selected. The filter is metric-type-aware: timed metrics use "Max" (lower-is-better, exclude if score > threshold), measured/rated metrics use "Min" (higher-is-better, exclude if score < threshold). Players without a score for the selected metric are excluded when a threshold is active.

### Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Metric threshold filter | **Implement** | No threshold filtering existed. Coaches had no way to set numeric cutoffs. |
| Metric-type awareness | **Implement** | Timed metrics (60-yard dash) need "at most X" while measured (exit velo) need "at least X". |
| Partial data handling | **Implement** | Players missing the filtered metric are excluded — honest behavior, no inflated results. |
| Filter chain integration | **Keep** | Composable guard pattern (from D29) made adding the new filter trivial — one more `if (fail) return false`. |

### Highest-Value Weakness

**No metric threshold filtering.** During tryouts, the most natural coach behavior after reviewing rankings is: "Show me everyone who ran a sub-7.0 sixty" or "Show me everyone with exit velo above 80." Without threshold filtering, coaches must mentally scan the ranked list — slow and error-prone with 60+ players. The threshold filter turns this into a one-step action.

### Changes

- `src/pages/Dashboard.tsx` (MODIFIED):
  - **State:** Added `scoreThreshold: string` state (string to allow empty/partial input)
  - **Computed values:** `parsedThreshold` (float parse), `thresholdActive` (valid number + specific metric selected)
  - **Metric dropdown callbacks:** Both dropdowns now clear threshold on metric change
  - **Filter guard:** Added threshold check to composable filter chain — timed: `score > threshold → false`; measured/rated: `score < threshold → false`; no score → `false`
  - **UI:** Inline threshold input between metric dropdown and evaluator filter. Shows only when specific metric selected. Filter icon, "Max:"/"Min:" label based on metric type, unit display, clear button, match count badge.
  - **Import:** Added `Filter` from lucide-react

### Verification

- `tsc --noEmit`: 0 errors

### Recruiting Search Compatibility Note

The metric threshold filter maps directly to future college-coach search parameters (e.g., "60-yard ≤ 7.0 AND exit velo ≥ 85"). The metric-type-aware direction logic (timed = max, measured/rated = min) would carry over unchanged to a federated search API. The composable guard pattern generalizes to any filter predicate. The main structural change for recruiting search would be querying across programs rather than within one — but per-metric threshold logic remains identical.

### Next Priority Recommendation

**Option C: Pilot QA pass / workflow walkthrough** should be the next priority.

Reasoning: The core coach workflow now has all the mechanical pieces — score entry with retry, multi-evaluator filtering, grade/position/metric threshold filtering, verified profiles, and validated mutations on every critical path. Sessions A (status model) and B (coach invitation email) are improvements to secondary flows — session status adds lifecycle clarity but coaches can work without it, and invitation email is a convenience over manually sharing a link. Neither blocks a real tryout.

What does block a real tryout is undiscovered friction. After five steps of targeted hardening, the highest-risk unknowns are now in the seams between features: Does the full flow from "create program → import roster → configure metrics → create session → enter scores → review rankings → view profiles" work smoothly end-to-end? Are there mobile layout issues on the devices coaches actually use? Do empty states and loading transitions feel right? A structured walkthrough of the complete pilot workflow will surface these issues before a real coach does. This is the last step before handing the system to a real program.

---

## 2026-03-15 — Phase 3 Step 4: Grade / Threshold Filtering Reliability

### Summary

Assessed and hardened the Dashboard filtering workflow. Discovered a logic bug where position and grade filters were silently ignored when "Evaluated" or "Not Evaluated" was selected — the filter chain used early returns that bypassed downstream checks. Fixed the filter chain to AND all conditions correctly. Added a grade filter pill bar for mixed-grade tryouts.

### Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Filter chain correctness | **Keep but harden (bug)** | `filterMode === "evaluated"` returned early, skipping position filter. All filters now AND'd. |
| Grade filter | **Implement** | Grade displayed on cards but not filterable. Added pill bar with GraduationCap icon. |
| Score threshold filter | Defer | Complex UX across metric types (timed = lower-is-better, measured = higher-is-better). Not blocking pilot. |
| Flag filter | Defer | Flags visible on cards, filtering adds UI complexity. |
| Partial data in filters | Keep | Metric coverage indicator + evaluated/not-evaluated buttons sufficient. |
| Multi-sport flexibility | Keep | All filters data-driven: positions from roster, grades from player records, metrics from config. |

### Highest-Value Weakness

**Filter chain logic bug.** The `filtered` computation had three early-return paths:
```js
if (filterMode === "evaluated") return p.evalCount > 0;  // skips position + grade
if (filterMode === "not_evaluated") return p.evalCount === 0;  // skips position + grade
```
A coach who selected "Evaluated" + "SS" position thought they were seeing evaluated shortstops — but actually saw ALL evaluated players. During a tryout with 60+ players across 8 positions, this produces a misleadingly large list. Fixed by converting all checks to `if (condition) return false` guards that compose correctly.

### Changes

- `src/pages/Dashboard.tsx` (MODIFIED):
  - **Bug fix:** Rewrote filter chain to use composable `if (fail) return false` guards instead of early returns. All filters (search, evaluation status, position, grade) now AND correctly in every combination.
  - **Grade filter state:** Added `gradeFilter: number | "all"` state
  - **Grade computation:** `allGrades` derived from roster data, sorted ascending. Only shows when 2+ distinct grades exist.
  - **Grade filter UI:** Horizontal scrollable pill bar with GraduationCap icon, matching position filter pattern. "All Grades" + individual grade buttons.
  - **Import:** Added `GraduationCap` from lucide-react

### Verification

- `tsc --noEmit`: 0 errors

### College-Coach Search Filtering Note

The current filter model — data-driven pills derived from roster attributes (position, grade) and evaluation data (metrics, evaluator) — maps directly to the parameters a college coach would search by: position, graduation year, metric thresholds. The grade filter is analogous to graduation year. Position is already data-driven and sport-agnostic. Adding metric threshold filters (e.g., "60-yard < 7.0") would layer on top as an additional filter bar or slider without restructuring. The filter chain's composable guard pattern makes adding new filters trivial: one more `if (fail) return false` line. The main structural change for college search would be making these filters work across programs (federated query) rather than within a single program — but the per-program filter logic would remain the same.

---

## 2026-03-15 — Phase 3 Step 3: Verified Player Profile Reliability

### Summary

Assessed and hardened the player profile workflow (PlayerDetail.tsx coach-facing + PublicProfile.tsx public-facing). The highest-value weakness was that PlayerDetail's inline score add/edit/delete bypassed the service layer entirely — direct Supabase calls with no bounds validation. A coach could enter a score of 999 on a metric with max_value 100 from the profile page, corrupting rankings. Fixed by migrating all three mutation functions to new service-layer functions with bounds checking. Also added a metric coverage summary badge to the Evaluations card header.

### Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Data freshness | Keep | Realtime subscription on evaluations + player_notes — updates instantly. |
| Metric display & aggregation | Keep | Uses `aggregateValues()` (same as Dashboard) — correct. |
| Inline score mutations | **Keep but harden** | Direct Supabase calls with no validation. Migrated to service layer. |
| Missing data handling | Keep but harden | "No scores yet" per metric, but no overall coverage indicator. Added metric coverage badge. |
| Coach attribution | Keep | Coach filter, color-coded chips, own-coach-only edit/delete — solid. |
| Public profile aggregation | Keep but harden (deferred) | `get_public_profile` SQL uses hard-coded MIN/MAX instead of per-metric `aggregation` config. Lower priority. |
| Profile structure for recruiting | Keep | Schema has slug, public flag, graduation year, height, weight, social, video, commitment — strong foundation. |

### Highest-Value Weakness

PlayerDetail inline mutations (add/edit/delete evaluations) used direct `supabase.from("evaluations").insert/update/delete` with zero validation. ScoreEntry enforces bounds via `validateScoreValue()` — but the same coach editing from the profile page had no guardrails. This created a backdoor for invalid data.

### Changes

- `src/services/evaluationService.ts` (MODIFIED):
  - Added `deleteScore(evalId)` — simple validated delete
  - Added `updateScoreValue(evalId, value, metricBounds?)` — update with optional bounds validation
  - Added `addAdHocScore(input, metricBounds?)` — insert without session/attempt (for profile inline adds)
  - All three validate inputs and return `{ error }` consistently

- `src/pages/PlayerDetail.tsx` (MODIFIED):
  - Imports: added `addAdHocScore`, `updateScoreValue`, `deleteScore`, `MetricBounds`
  - Expanded `Metric` interface to include `min_value`, `max_value`
  - Updated metrics query to fetch `min_value, max_value`
  - Added `getMetricBounds(metricId)` helper
  - `handleAddEval` → uses `addAdHocScore` with bounds
  - `handleUpdateEval` → uses `updateScoreValue` with bounds (now receives `metricId` param)
  - `handleDeleteEval` → uses `deleteScore`
  - Added metric coverage badge in Evaluations card header: "N/M metrics" with amber/green coloring

### Verification

- `tsc --noEmit`: 0 errors

### Public/Shareable Profile Note

The current player profile model is well-positioned for public/shareable recruiting profiles. The schema already has `profile_slug` (unique URL path), `profile_public` (visibility toggle), and `get_public_profile` (SECURITY DEFINER RPC that returns only permitted data respecting `show_contact_info` and `visible_to_players` flags). The PublicProfile page handles not-found gracefully. To support shareable links: the slug-based URL (`/p/{slug}`) already works. Future enhancements (QR code generation, SEO meta tags, PDF export) would layer on top without schema changes.

---

## 2026-03-15 — Phase 3 Step 2: Multi-Evaluator Dashboard Filtering

### Summary

Added evaluator-based filtering to the Dashboard so coaches can isolate scores by evaluator. During multi-coach tryouts, the head coach needs to see each evaluator's perspective independently or combined. The filter appears as a horizontal pill bar (matching the position filter pattern) with "All Coaches", "My Scores", and individual coach names. Filtering is applied before aggregation — rankings recompute correctly based on the filtered evaluation subset.

### Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Eval attribution in DB | Keep | Every eval row has `coach_id` FK. Schema is correct. |
| Dashboard fetches coach_id | Keep but harden | `fetchAllEvaluations` selected only `player_id, metric_id, value, created_at` — no `coach_id`. Added it. |
| Coach list for filter | Implement | No coach data was fetched on Dashboard. Created `coachService.ts` with `fetchProgramCoaches`. |
| Filter UI | Implement | No evaluator filter existed. Added pill bar: All Coaches / My Scores / [individual coaches]. |
| Ranking math with filter | Keep but harden | Evals are now filtered before the aggregation loop — percentiles, composites, and sort all recompute correctly on the filtered subset. |
| Score authorship in cards | Keep | Individual player cards don't show evaluator name. Acceptable for MVP — the filter itself is the primary need. |

### Highest-Value Weakness

No way to distinguish who entered which scores. In a 3-coach tryout, the head coach sees blended rankings with no visibility into evaluator agreement or disagreement. Filtering by evaluator lets the head coach ask "what did Coach Smith see?" — critical for making final roster decisions.

### Changes

- `src/services/evaluationService.ts` (MODIFIED):
  - Added `coach_id` to `EvaluationRaw` interface and `fetchAllEvaluations` select clause

- `src/services/coachService.ts` (CREATED):
  - `fetchProgramCoaches(programId)` → `{ data: CoachSummary[], error }` — lightweight query for evaluator filter

- `src/pages/Dashboard.tsx` (MODIFIED):
  - Imports: added `fetchProgramCoaches`, `CoachSummary`, `EvaluationRaw`, `Users` icon
  - State: added `coaches` (CoachSummary[]), `evaluatorFilter` ("all" | "mine" | coach_id)
  - Data fetch: coaches loaded in parallel; evals filtered by evaluator before aggregation loop
  - UI: horizontal scrollable pill bar with Users icon, "All Coaches", "My Scores", individual coach pills
  - Filter only shows when program has 2+ coaches (single-coach programs see no change)
  - `evaluatorFilter` added to useEffect deps so rankings recompute on filter change

### Verification

- `tsc --noEmit`: 0 errors

### Scout/Evaluator Note

The evaluator filter is based on `coach_id` in the evaluations table. Future scout/evaluator account types would just need a record in the `coaches` table (or a parallel `evaluators` table with FK to evaluations). The filter logic uses `coach_id` generically — it doesn't assume the role is "coach". Adding a `scout` role or separate evaluator entity would work without Dashboard changes as long as evaluations carry the evaluator's ID.

---

## 2026-03-15 — Phase 3 Step 1: Score Entry Retry Queue

### Summary

Implemented a lightweight retry queue for score entry network failures. During live tryouts, coaches may be on unstable Wi-Fi or mobile connections. Previously, a failed save showed a "Failed" flash and the coach had to re-enter the value manually. Now, transient (network/Supabase) errors are automatically enqueued for background retry with exponential backoff, while validation errors (bounds, missing fields) still show immediately for the coach to correct.

### Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Network failure detection | **Implement** | saveScore now distinguishes retryable (post-validation Supabase) errors from non-retryable (validation) errors via `retryable` flag. |
| Failed score storage | **Implement** | New `useRetryQueue` hook stores failed payloads in a ref-backed Map with composite dedup key. |
| Background retry | **Implement** | 1-second tick interval with exponential backoff (2s, 4s, 8s, 16s). Respects `navigator.onLine`. |
| Duplicate prevention | **Keep** | Composite key (player+metric+attempt+coach) ensures only latest value per slot is queued. Existing synchronous ref guard prevents concurrent initial saves. |
| Coach communication | **Implement** | Amber queue status banner shows pending count, retry spinner, failed items with dismiss/retry-all. Toast warns on enqueue, celebrates on retry success. |
| UI responsiveness | **Keep** | Queue runs in background interval. UI state updated only on queue changes, not on every tick. Value clears and station mode advances even when enqueued — coach flow is uninterrupted. |

### Highest-Value Weakness

No retry mechanism existed. Network failures during rapid score entry in station mode meant the coach had to notice the brief "Failed" flash, remember which player it was for, and re-enter the value — completely unrealistic during a live tryout with 50+ players cycling through a station.

### Changes

- `src/services/evaluationService.ts` (MODIFIED):
  - Added `SaveScoreResult` interface with `retryable: boolean` field
  - `saveScore` returns `retryable: false` for validation errors, `retryable: true` for Supabase errors

- `src/hooks/useRetryQueue.ts` (CREATED, ~150 lines):
  - `useRetryQueue` hook with `enqueue`, `dismissFailed`, `retryAllFailed` API
  - Background interval retries with exponential backoff (2s base, 4 max retries)
  - `navigator.onLine` check pauses retries when browser reports offline
  - Composite key dedup: latest value wins for same player/metric/attempt/coach slot
  - Callbacks for retry success and exhaustion (toast notifications)

- `src/pages/ScoreEntry.tsx` (MODIFIED):
  - Integrated `useRetryQueue` hook
  - `handleScore` now enqueues retryable errors instead of just showing toast
  - On enqueue: value clears, station mode advances — coach flow continues uninterrupted
  - Retry queue status banner (amber, WifiOff icon) shows pending count, failed items, retry-all button
  - Retry success callback updates recentScores and sessionSaveCount

### Verification

- `tsc --noEmit`: 0 errors

### Offline Scoring Note

The retry queue architecture is designed to support future offline scoring. The `useRetryQueue` hook stores payloads in memory with full serializable data. To add true offline support: (1) persist the queue to IndexedDB or localStorage on enqueue, (2) rehydrate on page load, (3) extend the `navigator.onLine` check to also listen for `online`/`offline` events and trigger a flush on reconnect. The core queue logic, dedup, and backoff would remain unchanged.

---

## 2026-03-15 — Phase 2 Step 7: Assistant Coach Permissions & Multi-Evaluator Workflow

### Summary

Assessed and hardened the assistant coach and multi-evaluator workflow. Discovered a critical blocker: the coach invitation system is completely broken — invited coaches can never join the program. CoachManager creates placeholder records with random `user_id` values, but no code exists to link the placeholder to the real user when they sign up. Fixed with a SECURITY DEFINER database function and AuthContext linking logic.

### Multi-Evaluator Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Coach joining a program | **Rebuild (targeted)** | Invitation creates placeholder with random UUID; no linking code exists. Invited coaches cannot join. Total blocker. |
| Role permissions (CRUD) | Keep | RLS policies correct: all coaches SELECT, own-only UPDATE/DELETE. Head coach manages staff. |
| Multi-evaluator concurrency | Keep | Each eval has `coach_id` FK. ScoreEntry scoped per-coach. No write conflicts possible. |
| Evaluator attribution | Keep but harden | Evals carry `coach_id`. Dashboard aggregates all coaches (correct for rankings). No per-coach view yet. |
| Overwrite/ambiguity risk | Keep | RLS prevents cross-coach edits. Each coach sees only own scores in ScoreEntry. |
| Scaling to large tryouts | Keep | Per-coach model scales naturally. Adding coaches = more rows, no contention. |

### Highest-Value Weakness

Coach invitation is completely broken. Flow: Head coach invites assistant via CoachManager → placeholder record created with `user_id: crypto.randomUUID()` and correct email → assistant signs up → `AuthContext.fetchCoaches` queries `.eq("user_id", userId)` → never matches the placeholder UUID → assistant is not recognized as a coach → cannot access program, enter scores, or see data. Additionally, `JoinProgram.tsx` is player-only and registration codes only create player records. There is literally no mechanism for an invited coach to join.

### Changes

- `supabase/migrations/20260315000002_coach_email_linking.sql` (CREATED):
  - New `link_coach_by_email(target_email text)` function with `SECURITY DEFINER`
  - Safely links a placeholder coach record to the authenticated user by matching email
  - Validates: user is authenticated, placeholder exists with different user_id, user doesn't already have a coach record in the same program
  - Returns JSON `{ success: true/false, coach_id?, error? }`
  - Bypasses coaches UPDATE RLS (which only allows head coach) for this specific controlled operation

- `src/contexts/AuthContext.tsx` (MODIFIED):
  - In `fetchUserRole`: after `fetchCoaches` returns false, calls `supabase.rpc("link_coach_by_email")` with the user's auth email
  - If linking succeeds, re-fetches coaches and sets role to "coach"
  - Falls through silently if no placeholder matches (normal for non-invited users)

- `src/integrations/supabase/types.ts` (MODIFIED):
  - Added `link_coach_by_email` function type to the Functions section

### Scout/Evaluator Attribution Note

The current evaluation attribution model (`coach_id` FK on evaluations table) supports future scout/evaluator accounts without schema changes. The `evaluators` table and `evaluator_entries` table already exist as a separate system for third-party evaluators with their own attribution chain. The evaluator model stores `evaluator_id`, `metric_name`, `metric_value` directly (denormalized by design, since evaluators don't use program-specific metric definitions). For the recruiting platform vision, this dual-attribution model (coaches via `evaluations.coach_id`, external evaluators via `evaluator_entries.evaluator_id`) is already the right architecture. No schema changes needed.

### Verification

- `tsc --noEmit` passes with zero errors
- Migration prepared but requires `supabase db push` or equivalent to deploy
- AuthContext flow: existing users unaffected (fetchCoaches succeeds on first try); invited coaches now linked on signup; non-coach users fall through to evaluator/player/scout detection as before

---

## 2026-03-15 — Phase 2 Step 6: Ranking and Filtering Reliability — Partial Data Clarity

### Summary

Assessed and hardened the ranking and filtering workflow on the Dashboard. Identified that composite percentile rankings are misleading when players have partial metric data — a player with one standout metric and no other data appears to outrank fully-evaluated players. Added metric coverage indicators, stable sort tiebreakers, and a position filter to give coaches the context needed for reliable tryout decisions.

### Ranking/Filtering Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Ranking calculation correctness | Keep | `computePercentiles` is well-tested (8 cases), handles ties, respects metric direction |
| Sort stability | Keep but harden | Equal composite scores had no tiebreaker → unstable ordering between renders |
| Filtering by position/grade | Keep but harden | Name search and eval status exist; no position filter despite `PlayerSearchFilters.tsx` existing for scout page |
| Partial/missing metric data | **Keep but harden** | Composite averages only metrics player has → inflates partial-data players; highest-value weakness |
| Ranking clarity | Keep but harden | No indication of how many metrics underlie a composite score |
| Aggregation misleading | Keep but harden | Tied to partial data; `aggregation` per metric is correctly applied |

### Highest-Value Weakness

Composite percentile inflated by partial data. `computePercentiles` averages the percentiles across only the metrics a player has. In a 40-player tryout with 6 metrics: Player A with 5/5 metrics → composite 60. Player B with 1 standout metric → composite 100. Player B appears higher ranked despite having almost no data. Coaches cannot distinguish reliable rankings from partial-data artifacts without seeing metric coverage.

### Changes

- `src/pages/Dashboard.tsx`:
  - Added `metricCount` to `PlayerRow` interface — tracks how many distinct metrics each player has scores for
  - Player cards now show **"N/M metrics"** indicator (e.g., "3/6 metrics") in amber when partial, muted when complete
  - Composite score label now says **"partial"** instead of "overall" when player has incomplete metric data
  - Partial-data composite scores are rendered in `text-muted-foreground` (dimmed) to visually deprioritize them
  - Sort tiebreakers added: (1) more metrics = rank higher when scores are equal, (2) alphabetical as final deterministic tiebreaker, (3) null-score players sorted alphabetically instead of random
  - **Position filter** added as a horizontal scrollable pill bar below the metric selector — coaches can filter by position (e.g., "P", "C", "SS") with one tap

### Multi-Sport Ranking Note

The current ranking logic is sport-agnostic — `computePercentiles` works with any set of metrics regardless of sport context. The `metric_type` field (timed/measured/rated) determines sort direction, and `aggregation` (best/average/latest) determines how attempts are combined. Multi-sport metric systems would work without any changes to the ranking math. The only consideration is that composite percentiles across sports (e.g., a baseball player's batting metrics mixed with football metrics) may not be meaningful — but that's a product decision about how to scope composites, not a technical limitation. The per-metric percentile view already works correctly for any sport.

### Verification

- `tsc --noEmit` passes with zero errors
- All existing Dashboard behavior preserved — changes are additive (coverage indicator, position filter, tiebreakers)
- Existing metrics.test.ts tests still valid (ranking math unchanged)

---

## 2026-03-15 — Phase 2 Step 5: DataImport Hardening — Duplicate Prevention

### Summary

Assessed and hardened DataImport.tsx, the complex tryout data import wizard that handles players + evaluation scores + metric mapping. Identified two duplicate-related gaps as the highest-value weakness: (1) within-file duplicate rows for the same player were not detected, creating duplicate evaluations with colliding attempt numbers, and (2) re-importing the same file created fully duplicate evaluation records with no protection.

### DataImport Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Direct Supabase access | Keep but harden | 6 direct calls; fetches are fine, mutations could use service layer but work correctly with error handling |
| Validation gaps | Keep but harden | No Zod/bounds on imported scores; `stripUnitsFromValue` parses but doesn't validate ranges |
| Duplicate detection | **Rebuild (targeted)** | No within-file dedup; no re-import protection; highest-value weakness |
| Row-level failure handling | Keep | Batched inserts with error per batch; matched/new/skipped preview counts |
| Consistency with RosterUpload | Keep but harden | Both now share `playerService` for name lookups; DataImport now has dedup matching RosterUpload pattern |
| Merge with RosterUpload? | Keep separate | Fundamentally different purposes; merging would bloat both |

### Highest-Value Weakness

Two duplicate scenarios:
1. **Within-file duplicates**: A CSV with the same player on multiple rows (common with long-format timing data) created multiple evaluation records with colliding attempt numbers for the same metric. This corrupts aggregation.
2. **Re-import duplicates**: Importing the same file twice created fully duplicate evaluation rows. Coaches commonly re-import after corrections or to assign to a different session.

### Changes

- `src/components/DataImport.tsx`:
  - `buildMatchedRows()` now merges within-file duplicate rows for the same player (case-insensitive name match). When duplicate rows are found, metric values are merged with automatic attempt number collision avoidance. Profile data fills gaps from later rows. A toast informs the coach how many rows were merged.
  - `handleImport()` now deduplicates evaluations against existing DB records before inserting. Fetches existing evaluations for the target players+metrics+session+coach, builds a key set, and filters out any candidate evaluations that already exist. Skipped duplicates are counted and shown in the done step.
  - Import result now tracks `skippedDupes` count alongside `players` and `evals`.
  - Done step shows amber "N duplicate scores skipped (already existed)" when applicable.
  - Added `fetchPlayerNames` and `buildPlayerNameIndex` imports from playerService (available for future use).

### Verification

- `tsc --noEmit` passes with zero errors
- All existing DataImport UI and behavior preserved — changes are additive (merge logic, dedup check, feedback)
- RosterUpload unchanged

---

## 2026-03-15 — Phase 2 Step 4: Player Import and Roster Reliability — Duplicate Detection

### Summary

Assessed and hardened the player import and roster management workflow. Identified RosterUpload's complete lack of duplicate detection as the highest-value weakness. A coach re-importing the same CSV (common during tryout prep) would create a fully duplicated roster, corrupting all downstream evaluation data.

### Player Import Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| CSV import reliability | Keep | SheetJS + PapaParse handle 30–60 rows well. importUtils.ts preprocessing is sophisticated. |
| Column mapping & validation | Keep but harden | Mapping works; no validation on imported score values (no Zod, no bounds). |
| Duplicate player detection | **Rebuild (targeted)** | RosterUpload has zero duplicate detection. DataImport only matches existing roster, not within-file duplicates. |
| Error handling & feedback | Keep but harden | DataImport shows row errors; RosterUpload gives generic toast on bulk failure. |
| Safe correction/edit flows | Keep | Roster page has inline editing; PlayerDetail has full edit. |
| Roster stability during eval | Keep | Player records stable once created; ScoreEntry references by ID. |

### Highest-Value Weakness

RosterUpload blindly inserts all CSV rows as new players with zero duplicate checking — against existing roster or within the imported file. A coach who imports a 40-player roster twice gets 80 player records with identical names. Score Entry then shows duplicate names, evaluations split across records, and aggregation/ranking are corrupted.

### Changes

- `src/services/playerService.ts`:
  - Added `fetchPlayerNames()` — lightweight query returning just first/last names for a program
  - Added `buildPlayerNameIndex()` — builds a `Set<string>` of normalized `"first|last"` keys for O(1) duplicate lookups

- `src/components/RosterUpload.tsx`:
  - Fetches existing roster names on dialog open via `fetchPlayerNames` + `buildPlayerNameIndex`
  - Computes `playerDuplicateInfo` for each imported row: marks `isExistingDuplicate` (already on roster) and `isFileDuplicate` (earlier row in same file has same name)
  - Preview step shows amber "on roster" / "duplicate in file" badges on duplicate rows
  - Duplicate warning banner with count and skip toggle (Switch component)
  - When skip is enabled (default), duplicates are dimmed with line-through and excluded from import
  - Coach can toggle skip off to force-import duplicates if intentional
  - Import button count dynamically reflects actual players to import
  - Done step shows "N duplicates skipped" when applicable

### Multi-Sport Athlete Profile Note

The current player model (first_name, last_name, grade, positions[], bats, throws, jersey_number_preference, photo_url, profile_slug, etc.) is sport-agnostic enough for multi-sport support. The `positions` array and `bats`/`throws` fields are baseball-flavored but nullable. Future multi-sport profiles could add a sport-specific metadata JSON column or a player_sport_profiles junction table without breaking the core schema. No changes needed now.

### Verification

- `tsc --noEmit` passes with zero errors
- Existing import UI preserved — changes are additive (duplicate indicators, skip toggle)
- DataImport unchanged — separate hardening task for later

---

## 2026-03-15 — Phase 2 Step 3: Score Entry Reliability — Duplicate Prevention + Save Clarity

### Summary

Hardened the Score Entry workflow to prevent duplicate scores and improve coach confidence during rapid data entry. Identified a critical race condition: rapid Enter key presses could fire `handleScore` concurrently because React state updates are asynchronous. Combined with no unique constraint on the evaluations table, this could create duplicate rows that corrupt aggregation/ranking.

### Score Entry Assessment

| Sub-area | Classification | Finding |
|----------|---------------|---------|
| Save-state clarity | Keep but harden | Only toast indicated success — no persistent visual feedback |
| Failure handling | Keep but harden | Error shown but no retry mechanism |
| Duplicate protection | **Refactor (targeted)** | No sync guard on handleScore, no DB unique constraint |
| Responsiveness | Keep | Station mode, auto-advance, keyboard flow all work well |
| User confidence | Keep but harden | No save counter, no persistent status indicator |
| Multi-evaluator readiness | Keep | Evals scoped by coach_id; data model supports multi-evaluator |

### Highest-Value Weakness

Rapid double-submit via Enter key could create duplicate evaluation rows. The `saving` state prevented button double-click (via `disabled`), but the Enter key handler (`handleKeyDown`) called `handleScore()` without checking `saving` — and `setSaving(true)` is async, so a second Enter within the same tick could bypass the guard. No DB unique constraint existed as a safety net.

### Changes

- `src/pages/ScoreEntry.tsx`:
  - Added `savingRef` (useRef) for synchronous double-submit prevention — checked at the top of `handleScore` and in `handleKeyDown`
  - Added `lastSaveStatus` state with timed flash: shows "Saved" (green) or "Failed" (red) indicator on the scoring card
  - Added `sessionSaveCount` — running counter of saves for coach confidence ("12 saved" badge)
  - Save button now shows spinner + "Saving..." text during save
  - Wrapped `handleScore` and `handleKeyDown` in `useCallback` for stable references
  - Session save count resets when session changes

- `supabase/migrations/20260315000001_add_evaluation_unique_constraint.sql`:
  - Prepared migration to add unique partial index on `(player_id, metric_id, coach_id, attempt_number, session_id) WHERE session_id IS NOT NULL`
  - Includes instructions for checking/resolving existing duplicates before running
  - App works without this migration; it provides DB-level defense-in-depth

### Verification

- `tsc --noEmit` passes with zero errors
- Existing UI behavior preserved — all changes are additive (new visual indicators, guards)
- Station mode, attempt auto-advance, and player list all unchanged

---

## 2026-03-15 — Phase 2 Step 2: Session Lifecycle Hardening — Safe Deletion

### Summary

Assessed and hardened the session lifecycle workflow. Identified two inconsistent, unguarded session deletion paths as the highest-value weakness blocking pilot reliability. Unified deletion into a single safe service function with cascade handling, and added confirmation dialogs with evaluation count warnings to both deletion UIs.

### Session Lifecycle Assessment

| Sub-area | Classification | Rationale |
|----------|---------------|-----------|
| Session status model | Keep but harden | No status column. For MVP with ≤5 sessions, derive from date. Not blocking. |
| Player assignment | Keep | session_attendance table exists; scoring uses full roster. Correct for tryout flow. |
| Metric assignment | Keep | All metrics active for all sessions. Programs define once, use everywhere. |
| Session readiness | Keep | ScoreEntry requires session selection. Sufficient for MVP. |
| Session deletion | **Refactor (targeted)** | Two inconsistent paths, no data-loss warning. Highest risk for pilot. |

### Problem

Two different code paths deleted sessions:
1. **SessionContext.deleteSession** — manually nullified evaluations, deleted attendance, then deleted session (3 direct Supabase calls)
2. **TryoutPlanner.handleDeleteSession** — called `deleteTryoutSession()` which did a raw delete, relying on DB constraints (ON DELETE SET NULL / CASCADE)

Neither path warned the coach about existing evaluation data. TryoutPlanner had NO confirmation dialog — a single click permanently deleted a session.

### Changes

- `src/services/sessionService.ts` — Added `getSessionStats()` (evaluation + attendance counts), enhanced `deleteTryoutSession()` to handle cascade cleanup (unassign evaluations, delete attendance, then delete session)
- `src/contexts/SessionContext.tsx` — `deleteSession` now uses the unified `deleteTryoutSession` service function instead of 3 direct Supabase calls; removed one of two remaining direct Supabase dependencies
- `src/components/AppLayout.tsx` — Delete event dialog now fetches and displays evaluation count before confirmation ("This event has N scores recorded")
- `src/pages/TryoutPlanner.tsx` — Added AlertDialog confirmation before session deletion with evaluation count warning; replaced instant-delete with `promptDeleteSession` → `confirmDeleteSession` flow

### Multi-Sport Template Note

The current session model (id, name, date, notes, program_id, season_id) is sport-agnostic and adequately supports multi-sport evaluation templates. Metrics are defined at the program level and sports templates are configured via `lib/sports.ts`. No session-level changes are needed to support multi-sport evaluation later — just ensure metrics carry sport/category metadata (which they already do).

### Verification

- `tsc --noEmit` passes with zero errors
- All existing behavior preserved — only added confirmation gates and unified the delete path

---

## 2026-03-15 — Phase 2 Step 1: Rated Metric Range Validation in Score Entry

### Summary

First Phase 2 improvement: enforce metric min/max bounds during score entry. Previously, rated metrics (e.g., 20-80 scale fielding grades) accepted any numeric value, allowing coaches to accidentally enter out-of-range scores that corrupt verified athlete data — Rostr's core product promise.

### Workflow Assessment (Phase 2 Kickoff)

| # | Workflow | Classification | Notes |
|---|---------|---------------|-------|
| 1 | Program/org setup | Keep | Works, low risk |
| 2 | Coach invitation | Keep but harden | Join code works, email invite missing |
| 3 | Player creation/edit/import | Keep | Validated in Phase 1 |
| 4 | Session lifecycle | Keep but harden | No status, no player/metric assignment |
| 5 | Score entry | Refactor (targeted) | **Highest priority** — no bounds enforcement |
| 6 | Ranking/filtering | Keep | Aggregation/percentiles work correctly |
| 7 | Player profiles | Keep | Functional for MVP |

### Changes

- `src/lib/validation.ts` — Added `MetricBounds` interface and `validateScoreValue()` function for runtime metric bounds checking
- `src/services/evaluationService.ts` — `saveScore` now accepts optional `MetricBounds` parameter, validates before Supabase write
- `src/pages/ScoreEntry.tsx` — Passes current metric's min/max bounds to saveScore; shows range hint text below input for bounded metrics; sets HTML min/max attributes on input
- `src/lib/__tests__/validation.test.ts` — Added 8 new tests for validateScoreValue (within bounds, below min, above max, no bounds, NaN, Infinity, only-min, only-max)

### Verification

- `tsc --noEmit` passes with zero errors
- validateScoreValue logic verified: 10/10 boundary cases pass
- All existing validation schemas unchanged

---

## 2026-03-15 — Phase 1 Step 4: Complete MVP Service Layer + Architectural Assessment

### Summary

Migrated TryoutPlanner (the last critical coach workflow page) to the service layer with validation. Hardened SessionContext's fetch path. Assessed remaining direct Supabase dependencies and classified each as keep/harden/defer.

### Files Created

- `src/services/sessionService.ts` — fetchTryoutSessions, createTryoutSession (validated), updateTryoutSession (validated), deleteTryoutSession

### Files Modified

- `src/services/metricService.ts` — Added fetchMetricsFull, createMetric (validated), updateMetric, deleteMetric
- `src/services/index.ts` — Added sessionService to barrel export
- `src/pages/TryoutPlanner.tsx` — Replaced all 7 direct Supabase calls with service functions; removed `supabase` import entirely
- `src/contexts/SessionContext.tsx` — Fetch path now uses fetchTryoutSessions from sessionService; retains `supabase` import for create/delete mutations that do optimistic state updates

### Architectural Classifications

| Area | Classification | Rationale |
|------|---------------|-----------|
| SessionContext fetch | **Hardened** | Now uses sessionService. Create/delete retain direct Supabase because they do optimistic list updates + cascading deletes that belong in the context. |
| Dashboard realtime | **Keep as-is** | Websocket subscription is fundamentally different from CRUD. Tightly coupled to component lifecycle. No benefit from abstraction. |
| AuthContext (716 lines) | **Keep, defer decomposition** | Works correctly for all 4 roles. High risk of breaking auth flow during decomposition. Defer to Phase 2 when coach workflow is fully stable. |

### Validation Now Active On All Critical Mutations

- Player creation → createPlayerSchema
- Score entry → scoreEntrySchema
- Session creation → createSessionSchema
- Session update → updateSessionSchema
- Metric creation → createMetricSchema

### Verification

- `tsc --noEmit` passes
- `vite build` succeeds (33s)
- 67/67 unit tests pass

---

## 2026-03-15 — Phase 1 Step 3: Zod Validation + Unit Tests

### Summary

Added Zod validation schemas for all critical mutation workflows and wrote 67 unit tests covering core business logic and validation rules.

### Files Created

- `src/lib/validation.ts` — Zod schemas for createPlayer, createSession, updateSession, createMetric, scoreEntry + generic `validate()` helper
- `src/lib/__tests__/metrics.test.ts` — 18 tests: aggregateValues (empty, best/avg/latest, timed/measured/rated), computePercentiles (ranking, ties, composites, partial scores)
- `src/lib/__tests__/sports.test.ts` — 15 tests: config completeness, metric-category consistency, rated metric bounds, all helper functions, unknown sport fallbacks
- `src/lib/__tests__/validation.test.ts` — 34 tests: every schema (valid/invalid cases), edge cases (whitespace trimming, NaN, Infinity, UUID format, range bounds)

### Files Modified

- `src/services/playerService.ts` — createPlayer now validates with createPlayerSchema before writing
- `src/services/evaluationService.ts` — saveScore now validates with scoreEntrySchema before writing

### Validation Coverage

Schemas active in services: createPlayerSchema (player creation), scoreEntrySchema (score entry).
Schemas defined but not yet wired: createSessionSchema, updateSessionSchema, createMetricSchema — these will be integrated when TryoutPlanner is migrated to the service layer.

### Verification

- 67/67 tests pass
- `tsc --noEmit` passes with zero errors

### Next Steps

1. Wire session/metric validation into TryoutPlanner (requires extracting TryoutPlanner queries to service layer)
2. Decompose AuthContext into focused modules
3. Migrate remaining coach workflow pages to service layer

---

## 2026-03-15 — Phase 1 Step 2: Introduce Service Layer

### Summary

Created `src/services/` with five domain-specific modules that extract all direct Supabase queries out of page components. Rewired the three core coach pages (Roster, ScoreEntry, Dashboard) to use the service layer instead of calling Supabase directly.

### Files Created

- `src/services/playerService.ts` — fetchRosterPlayers, fetchPlayerSummaries, fetchDashboardPlayers, createPlayer, autoAssignPlayerNumbers, deleteAllPlayers, getRegistrationCode
- `src/services/evaluationService.ts` — fetchSessionEvaluations, fetchAllEvaluations (paginated), fetchPreviousSessionScores, saveScore (insert or update)
- `src/services/metricService.ts` — fetchMetricsForScoring, fetchMetricsForDashboard
- `src/services/teamService.ts` — fetchTeams, fetchSeasons
- `src/services/noteService.ts` — fetchPlayerFlags
- `src/services/index.ts` — barrel export

### Files Modified

- `src/pages/Roster.tsx` — replaced 6 direct Supabase calls with service functions; removed `supabase` import; uses PlayerListItem type from service
- `src/pages/ScoreEntry.tsx` — replaced 4 direct Supabase calls with service functions; removed `supabase` import; uses service types
- `src/pages/Dashboard.tsx` — replaced 4 direct Supabase calls (including paginated eval fetcher) with service functions; retained `supabase` import for realtime channel only

### Design Decisions

- Each service function returns `{ data, error }` — consistent contract, easy to test
- Service types are exported and reused as page-level types via aliases (e.g., `type Player = PlayerListItem`)
- Dashboard retains its own `supabase` import solely for the realtime subscription channel — realtime will be extracted in a future step
- No functional behavior was changed — same queries, same data shapes, same UI

### Verification

- `tsc --noEmit` passes with zero errors
- `vite build` succeeds (2148 modules, 25s)

### Next Steps

1. Add Zod validation schemas for player creation and score entry
2. Write unit tests for `lib/metrics.ts` and `lib/sports.ts`
3. Decompose AuthContext into focused modules

---

## 2026-03-15 — Phase 1 Step 1: Remove Lovable Dependencies

### Changes Made

**Lovable-tagger removed**
- Removed `lovable-tagger` from package.json devDependencies
- Removed `componentTagger` import and usage from vite.config.ts
- Simplified plugins array to just `[react()]`
- `.lovable/` directory left in place for now (no functional impact)

**Environment handling fixed**
- Added `.env` to `.gitignore` to prevent future secret leaks
- Created `.env.example` documenting required variables
- Existing `.env` unchanged (anon key is public by design)

**Package metadata updated**
- Renamed package from `vite_react_shadcn_ts` to `rostr`
- Set version to `0.1.0` (start of independent development)
- Added description field
- Added `typecheck` script (`tsc --noEmit`)

**Project management docs created**
- `TASK_QUEUE.md` — Prioritized task list across all phases
- `KNOWN_ISSUES.md` — 13 tracked issues with severity and mitigation plans

### What Was NOT Changed

- All existing UI components, pages, and styles preserved
- All existing contexts (AuthContext, SessionContext) preserved
- All Supabase integration code preserved
- All 29 migrations preserved
- shadcn/ui components.json preserved
- No functional behavior changed

### Approach

Preservation-first: only removed what blocks independent development (lovable-tagger). Everything else stays and gets strengthened incrementally.

### Next Steps

1. Introduce service layer (`src/services/`) — extract Supabase queries from page components
2. Add Zod validation for player creation and score entry
3. Write unit tests for `lib/metrics.ts` and `lib/sports.ts`

---

## 2026-03-15 — Migration Audit Complete

### Summary

Full audit of the Lovable-exported codebase. Documented the actual architecture (Vite + React SPA, not Next.js), catalogued all 22 database tables, 28 pages, and 45+ UI components. Identified 10 architecture issues. Rewrote all 9 project documentation files to reflect reality.

See: ARCHITECTURE.md, DECISIONS.md, KNOWN_ISSUES.md for full details.
