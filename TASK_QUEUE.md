# Task Queue

Active and upcoming development tasks, ordered by priority within each phase.

## Currently Active

### Phase 1: Architecture Stabilization

- [x] Remove Lovable dependencies (lovable-tagger, vite.config.ts cleanup)
- [x] Fix .env handling (gitignore, .env.example)
- [x] Clean up package.json metadata (name, version, scripts)
- [x] Introduce service layer (`src/services/`) — extract Supabase queries from page components
- [x] Add Zod validation schemas for critical forms (player, metric, session, score entry)
- [x] Write initial unit tests for `lib/metrics.ts`, `lib/sports.ts`, `lib/validation.ts` (67 tests)
- [x] Wire validation into TryoutPlanner — migrated to service layer with validation on all mutations
- [x] Harden SessionContext fetch path — now uses sessionService
- [x] Assess Dashboard realtime, AuthContext — classified as keep/defer (see DECISIONS.md D13-D15)

### Phase 1 Complete

All Phase 1 objectives met:
- [x] Lovable dependencies removed
- [x] Service layer covering all critical coach/evaluator mutations
- [x] Zod validation on all critical mutation paths
- [x] 67 unit tests for core business logic
- [x] Architectural risks assessed and documented
- [x] App remains runnable throughout

## Currently Active

### Phase 2: Core Workflow Hardening

- [x] Rated metric range validation in score entry (bounds enforcement + range hints)
- [x] Session deletion hardening (unified safe delete, confirmation dialogs with eval count warnings)
- [x] Score Entry duplicate prevention (synchronous ref guard) + save-state indicators
- [x] RosterUpload duplicate detection (name-based matching against existing roster + within-file, skip toggle)
- [x] DataImport duplicate detection (within-file row merging + re-import dedup against existing evaluations)
- [x] Coach invitation linking (SECURITY DEFINER function + AuthContext email-based linking on signup)
- [ ] Run coach email linking migration (prepared, see migrations/20260315000002)
- [ ] Run evaluations unique constraint migration (prepared, see migrations/20260315000001)
- [ ] Session status model (draft/active/completed — deferred pending pilot feedback, see D18)
- [x] Score Entry retry queue for network failures (useRetryQueue hook with exponential backoff)
- [ ] DataImport imported score validation (Zod bounds checking on metric values)
- [ ] DataImport migration to service layer for mutations
- [x] Multi-evaluator dashboard view (per-coach filter on Dashboard, pre-aggregation filtering)
- [ ] Coach invitation email notification (actual email sent, not just record creation)

### Phase 2/3: Rankings and Filtering

- [x] Metric coverage indicator on Dashboard (N/M metrics, "partial" label, dimmed score for incomplete data)
- [x] Position filter on Dashboard (scrollable pill bar, derived from roster data)
- [x] Stable sort tiebreakers (metric count → alphabetical for deterministic ordering)
- [x] Grade filter on Dashboard (pill bar + filter chain bug fix, D29)
- [x] Metric threshold filter on Dashboard (type-aware direction, excludes missing, clears on metric change)
- [ ] Weighted composite (optional metric weights for custom composite scoring)
- [ ] Enhanced ranking table (sticky headers, multi-column metric view)
- [ ] Player comparison view (radar chart)
- [ ] CSV export of rankings
- [ ] URL state for filters (persist filters across navigation)

### Phase 3/4: Player Profiles

- [x] PlayerDetail eval mutations migrated to service layer with bounds validation (D28)
- [x] Metric coverage badge on PlayerDetail evaluations card
- [ ] Decompose PlayerDetail.tsx (666 lines)
- [ ] Public profile aggregation consistency (match per-metric `aggregation` config in SQL)
- [ ] Public profile QR code generation
- [ ] Player profile PDF export

### Phase 3 Step 6: Pilot QA Pass

- [x] Full workflow walkthrough (10 stages, 18 findings)
- [x] ScoreEntry event creation/selection guidance (inline create + quick-select buttons)
- [x] Dashboard empty state for zero players and zero filter results
- [x] Metric deletion confirmation dialog with eval count warning (QA finding #12 — D32)
- [x] Roster header icon labeling with mini text labels (QA finding #7)
- [ ] Station mode stationIndex/filtered desync guard (QA finding #11 — important)

### Phase 4: Pilot Simulation

- [x] Full 10-stage workflow simulation (8 findings)
- [x] Station Mode scoring progress indicator (D33)
- [x] CoachManager invitation flow clarity (D41 — "Add Coach" rename, copyable signup link, two-phase dialog)
- [x] PlayerDetail next/previous player navigation (D40 — location.state context + keyboard nav)
- [ ] Station Mode "next metric" prompt after completing a pass
- [ ] Station Mode skip player action (for absent players)

### Phase 5: Pilot Launch Preparation

- [x] Analytics event schema design (analytics_events table — D34)
- [x] Fire-and-forget track() service with PII sanitization
- [x] Instrument 8 workflow events (roster_import, player_create, metric_configure, session_create, score_entry, ranking_filter, player_profile_view, evaluator_filter)
- [ ] Run analytics migration on Supabase
- [x] Analytics SQL views for developer monitoring (7 views — D35)
- [x] Pilot Analytics in-app page for head coaches (PilotAnalytics.tsx)
- [x] Route and Settings navigation entry for /analytics

### Phase 6: Pilot Monitoring

- [x] SQL analytics views migration (analytics_views — 7 views)
- [x] In-app Pilot Analytics page (stat cards, daily chart, filter breakdown, event feed)
- [x] Settings tile for head coach access
- [ ] Run all 7 prepared migrations on Supabase (000001–000007)

### Phase 7: Pilot Runbook

- [x] Pilot runbook for coaches (PILOT_RUNBOOK.md — 9 workflow sections, common mistakes, developer monitoring guide)

### Team Management Module v1

- [x] Schema assessment — existing tables, enum constraints, UI inventory
- [x] Data model: `games`, `game_rosters`, `lineup_entries` tables (migration 000005)
- [x] TypeScript types for 3 new tables
- [x] Service layer: 10 new functions (game CRUD, game roster, lineup)
- [x] TeamManagement.tsx — team-level views, game scheduling, player roster by level
- [x] GameDetail.tsx — game roster selection + lineup builder (batting order + positions)
- [x] Routes (`/teams`, `/game/:id`) and Settings tile
- [ ] Run team management migration on Supabase (migration 000005)
- [ ] Unify `roster_assignments` enum with `programs.levels` TEXT (D37 — deferred, D39 workaround in place)
- [ ] Game stats/results tracking
- [ ] Season-scoped game filtering
- [ ] Lineup templates (reuse lineups across games)
- [ ] Sport-specific position lists (currently baseball defaults)

### Player Comparison & Recruiting Search v1

- [x] Player comparison page (`/compare?players=slug1,slug2,slug3`)
- [x] Bio comparison (grad year, height, weight, bats/throws, location, GPA)
- [x] Verified metrics comparison with best-value highlighting
- [x] Development trend badges + mini sparklines in comparison
- [x] Compare selection mode in PlayerSearchResults (2-3 players)
- [x] Route and import in App.tsx
- [ ] Open comparison to non-scout users (coaches, unauthenticated via direct URL — already works)
- [ ] Add comparison link sharing (copy `/compare?players=...` URL)
- [ ] Metric threshold highlighting in comparison (above/below recruiter-defined cutoffs)
- [ ] Expose existing search to coaches (currently scout-only via ScoutRoute)
- [ ] Pagination on search results (currently limited to 50)

### Practice Planning Module v1

- [x] Schema: `practice_plans` + `practice_blocks` tables (migration 000007)
- [x] Service layer: practiceService.ts with full CRUD + coach name resolution
- [x] PracticePlanner list page (create dialog, upcoming/past grouping)
- [x] PracticePlanDetail page (inline block editing, concurrent blocks, coach assignment)
- [x] PrintPracticeView page (CSS @media print, BEM styles, table layout)
- [x] Routes in App.tsx (`/practices`, `/practice/:id`, `/practice/:id/print`)
- [x] Settings tile for navigation entry
- [ ] Run migration 000007 on Supabase
- [ ] Practice plan duplication (copy a plan to a new date)
- [ ] Drag-and-drop block reordering
- [ ] Practice plan templates (save/load reusable structures)
- [ ] Player attendance tracking per practice
- [ ] Player-facing practice view (when shared_with_players = true)
- [ ] Practice notes/recap after practice (post-session coach notes)

### Public Recruiting Profile Polish

- [x] Aggregation consistency fix (prepared migration 000006 — RPC respects best/average/latest)
- [x] Development trend sparklines on public profile (from RPC trend_data)
- [x] QR code generation (zero-dependency client-side SVG encoder)
- [x] Share section with profile URL display + QR toggle
- [x] Aggregation method labels on metric cards
- [ ] Run migration 000006 on Supabase (enables trends + aggregation fix)
- [ ] PDF export of recruiting profile (stretch — server-side or client-side PDF)
- [ ] Open Graph meta tags for link preview cards (title, image, description)
- [ ] Player-controlled metric visibility (choose which metrics appear publicly)

### Player Development

- [x] PlayerDevelopment component (SVG sparklines, directional indicators, session-based aggregation)
- [x] Integrated into PlayerDetail between Evaluations and External Evaluations cards
- [x] Sport-agnostic direction detection (timed = lower is better)
- [x] 2% stability threshold to filter noise
- [ ] Standalone development page with interactive charts (future — deeper analysis)
- [ ] Development trends on Dashboard player cards (mini sparkline per top metric)
- [ ] Multi-player comparison view (overlay sparklines for same metric)
- [ ] Development export (CSV of trend data per player)

### Team Assignment Hardening

- [x] Case-insensitive level matching in TeamManagement (D39 — `enumToLevel` map)
- [x] Display-level badge in TeamManagement "All" view
- [x] Inline assignment dropdown for head coaches in TeamManagement
- [x] GameDetail loads roster_assignments for team-level context
- [x] Team level badges on all players in GameDetail roster tab
- [x] Smart sort: matching-level players first with visual separator
- [x] Team level hint banner on GameDetail when game has a level
- [ ] Team level badge on Dashboard player cards
- [ ] Team level badge on PlayerDetail header
- [x] Team level badge on Roster page player cards (productization sprint)
- [ ] "Add all {Level} players" bulk action on GameDetail roster tab

### Player Navigation

- [x] PlayerDetail prev/next arrows with position counter (D40)
- [x] Keyboard navigation (← → arrow keys, disabled in form inputs)
- [x] Dashboard passes ranked player list via location.state
- [x] Roster passes filtered player list via location.state
- [x] TeamManagement passes filtered player list via location.state
- [ ] ScoreEntry → PlayerDetail navigation context (future — station mode already handles sequencing)

### Printable Lineup Cards

- [x] LineupCard composable renderer component (D42 — variant prop, BEM CSS, position format utils)
- [x] PrintLineupView page (2×2 grid, @media print CSS, coach options)
- [x] Name display toggle (Full Name / Last Only)
- [x] Position format toggle (Abbreviation SS / Number 6)
- [x] Print button on GameDetail lineup tab
- [x] Route: `/game/:id/print-lineup`
- [ ] Full-page dugout board variant (future — LineupCard variant="board")
- [ ] Save as PDF export option (future — if browser print-to-PDF is insufficient)

### Lineup Editing Hardening

- [x] Dirty-state tracking via JSON snapshot (D43 — `savedLineupRef`, `isDirty` memo)
- [x] `beforeunload` guard for browser close/reload with unsaved changes
- [x] `safeNavigate` wrapper with `window.confirm` for in-app navigation
- [x] Save button dirty indicator ("Save *" pulse vs "Saved" clean state)
- [x] Copy lineup from previous game dialog (D44 — fetches games + lineup, auto-adds roster)
- [x] Warning banner when overwriting existing lineup
- [x] Empty-state copy button when no lineup exists
- [ ] Auto-save on tab switch (future — save when switching from lineup to roster tab)
- [ ] Lineup change history / undo (future)

### Team Home Page

- [x] TeamHome.tsx with 5 sections (D45 — next game, overview, upcoming, actions, activity)
- [x] Route `/home` inside ProtectedRoute
- [x] Home tab added to bottom nav (first position in PRODUCTION_NAV and DEMO_NAV)
- [x] Make `/` the default landing → TeamHome (D51 — productization sprint)
- [x] Roster moved to `/roster`
- [x] TeamHome redesigned as coach command center (next game hero, this week schedule, team snapshot, quick actions)
- [ ] Program logo display in Team Home header
- [ ] Coaching staff quick summary on Team Home
- [ ] Season record (W-L) when game results tracking is added

### Team Management Productization Sprint

- [x] Navigation restructure: TeamHome at `/`, Roster at `/roster` (D51)
- [x] Bottom nav: replaced Stats with Schedule (CalendarDays icon)
- [x] Schedule hub page (`/schedule`) combining Games + Practices chronologically
- [x] TeamHome redesign: next game hero, this week preview, team snapshot, quick actions
- [x] Demo data seeder: 25 players (12V + 10JV + 3 unassigned), 11 games, 9 practices
- [x] Settings reorganization: Team Operations + Evaluation & Scoring sections
- [x] Stats & Rankings tile added to Settings for discoverability
- [x] Vite cache dir fix for mounted filesystem permissions
- [x] Roster productization (level badges, filter pills, enhanced search, tighter rows, improved empty state)
- [x] TeamHome polish pass (typography hierarchy, section heading system, card padding standardization, empty states)
- [x] Schedule page tightening (clean header, color-coded type badges, tighter event cards, improved empty states)
- [ ] Desktop/tablet responsive layout (expand from max-w-lg)
- [ ] Table view for Roster and Dashboard on larger screens
- [ ] Onboarding flow / first-time coach tutorial
- [x] Evaluation data seeding (8 metrics, 3 sessions, ~500 evaluations via demoSeedService)
- [x] Dashboard productization (clean header, section headings, rank numbers, skeleton loader)
- [x] Loading skeletons for TeamHome, Roster, Schedule, Dashboard
- [ ] Lineup seeding for demo games

### Phase 8: Testing and Polish

- [ ] Component tests for ScoreEntry, Roster, Dashboard, TeamManagement
- [ ] E2E workflow tests
- [ ] Error boundaries at route level
- [ ] Mobile responsiveness audit

## Completed

- [x] Full migration audit of Lovable export
- [x] Documentation rewrite (all 9 project docs)
- [x] Architecture assessment and decision logging
