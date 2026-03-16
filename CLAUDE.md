# CLAUDE.md — Rostr Engineering Context

## 1. Project Identity

Rostr is a sports team operating system for coaches, evaluators, and program administrators. It digitizes tryout evaluations, roster management, practice planning, game-day operations, and player development tracking.

**Current phase:** UI Productization Sprint
**Current goal:** Polished, operationally trustworthy, demo/pilot-ready product — not new features.

**This is a Vite + React 18 + TypeScript + TailwindCSS + Supabase SPA.**

- This is **NOT Next.js**. There is no SSR, no server components, no App Router, no API routes.
- All data flows through the Supabase JS client (`@supabase/supabase-js`).
- The app is deployed as a static build.
- ES Module project (`"type": "module"` in package.json).
- Mobile-first design with a `max-w-lg` container constraint.

---

## 2. Tech Stack and Commands

### Stack

| Layer | Technology |
|-------|------------|
| Framework | Vite 5 + React 18 (via `@vitejs/plugin-react-swc`) |
| Language | TypeScript 5 (strict) |
| Styling | TailwindCSS 3 + tailwind-merge + tailwindcss-animate |
| UI Components | Radix UI primitives + shadcn/ui pattern |
| Data | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Validation | Zod |
| State | React Context (AuthContext, SessionContext) |
| React Query | Installed (`@tanstack/react-query`) but underutilized — most pages use manual `useState`/`useEffect` |
| Routing | react-router-dom v6 |
| Testing | Vitest (67 unit tests for core business logic) |
| Icons | lucide-react |

### Commands

```bash
npm run dev          # Start dev server on :8080
npm run build        # Production build (vite build)
npm run typecheck    # TypeScript verification (tsc --noEmit)
npm run test         # Run unit tests (vitest run)
npm run lint         # ESLint
```

### Verification — run after every change

```bash
npm run typecheck && npm run build
```

Both must pass with zero errors. This is the definition of "app remains runnable."

### Known Caveats

- **Vite cacheDir:** Set to `.vite` (project root) instead of `node_modules/.vite/` to avoid EPERM errors on mounted filesystems. See `vite.config.ts` and KI-15 in KNOWN_ISSUES.md.
- **Path alias:** `@/` maps to `./src/` via both `vite.config.ts` and `tsconfig.json`.

---

## 3. Architecture Rules

### Service Layer Pattern

All production data mutations go through `src/services/`. Each service returns `{ data, error }` and handles Supabase calls, validation, and error formatting internally. Pages should not contain inline `.from('table').insert(...)` calls for mutations.

Services: `playerService`, `evaluationService`, `metricService`, `sessionService`, `coachService`, `teamService`, `practiceService`, `analyticsService`, `noteService`.

`demoSeedService` is demo-only tooling — do not use its patterns (bulk inserts, seed data generation) as templates for production code.

### Data Integrity

- Zod validation exists on all critical mutation paths (player creation, score entry, session CRUD, metric CRUD, PlayerDetail eval add/edit).
- Score Entry has a synchronous duplicate guard + retry queue (`useRetryQueue` hook) for network failures.
- Maintain `{ data, error }` return contracts on all service functions.

### General Rules

- **Keep the app runnable at all times.** Every change must pass `typecheck && build`.
- **Prefer targeted improvements over rewrites.** Fix what's broken, polish what's rough, build what's missing.
- **Preserve sport-agnostic architecture.** Nothing in the data model or core logic should be baseball-specific. Sport-specific details (metric categories, position lists) live in configuration, not schema.
- **Do not introduce inline Supabase queries in page components.** Route through the service layer.
- **Do not restructure the auth system casually.** AuthContext (716 lines) is monolithic but functional — changes risk breaking 4-role auth flows.

---

## 4. UI Productization Rules

### Core Principle

The current sprint is about making existing pages feel polished and operationally trustworthy. Do not redesign from scratch. Improve hierarchy, typography, spacing, card consistency, and discoverability within the established patterns.

### Established Patterns

**Section headings:**
```
text-xs font-extrabold uppercase tracking-widest text-muted-foreground
```

**Filter pills (active):**
```
bg-foreground text-background border-foreground rounded-lg
```

**Filter pills (inactive):**
```
bg-card text-muted-foreground border-border hover:text-foreground rounded-lg
```

**Standard card:**
```
rounded-xl border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors
```

**Empty state:**
```
rounded-xl border border-dashed bg-card/50 p-6 text-center
```
With: icon, bold title, muted explanatory text, contextual CTAs.

**Loading skeleton:**
```
animate-pulse wrapper with bg-muted rounded blocks matching layout structure
```

**Level badge colors:**
- Varsity: `bg-primary/10 text-primary` (blue)
- JV: `bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400` (orange)
- Freshman: `bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400` (green)
- Cut: `bg-destructive/10 text-destructive` (red)
- Unassigned: `bg-muted text-muted-foreground` (gray)

### Rules

- Do not introduce one-off styling patterns that diverge from the above.
- Do not add gradient heroes, glass-card effects, or decorative UI elements. The current direction is clean and functional.
- Page headers use `text-2xl font-extrabold tracking-tight` with a muted subtitle below.
- Preserve the bottom nav structure: Home, Roster, Schedule, Score, More.

---

## 5. Scope Discipline

**Do not:**
- Self-direct roadmap changes or build features not explicitly assigned
- Build speculative future systems (recruiting marketplace, messaging, social features, NIL tools)
- Drift into multi-sport implementation beyond maintaining sport-agnostic architecture
- Introduce framework migrations (no Next.js, no Remix, no server components)
- Add major dependencies without explicit justification
- Rewrite working systems that just need polish
- Build for scouts, ADs, or club organizations before coach/evaluator workflows are excellent

**Always ask:** "Does this make the coach's daily workflow better, or does it serve a user we haven't earned yet?"

See PRODUCT_VISION.md § "Not Tonight's Scope Unless Assigned" for the full exclusion list.

---

## 6. Current Product State

### Implemented Modules

| Module | Route(s) | Status |
|--------|----------|--------|
| Team Home | `/` | Polished — command center, skeleton loader |
| Roster | `/roster` | Polished — level badges, filters, search, skeleton |
| Schedule | `/schedule` | Polished — unified games+practices, skeleton |
| Dashboard (Stats & Rankings) | `/dashboard` | Polished — filters, rank numbers, skeleton |
| Score Entry | `/score` | Functional — standard + Station Mode, retry queue |
| Player Detail | `/player/:id` | Functional — metrics, trends, evaluations, prev/next nav |
| Team Management | `/teams` | Functional — team-level views, game scheduling |
| Game Detail | `/game/:id` | Functional — roster, lineup builder, print |
| Practice Planner | `/practices`, `/practice/:id` | Functional — time blocks, coach assignments, print |
| Settings | `/settings` | Functional — metrics, sessions, coaches, demo tools |
| Public Profile | `/p/:slug` | Functional — verified metrics, QR, share, trends |
| Player Search | `/search` | Functional — scout-only, metric-based |
| Player Comparison | `/compare` | Functional — side-by-side profiles |
| Pilot Analytics | `/analytics` | Functional — usage stats for head coaches |
| Auth | `/auth`, `/setup` | Functional — signup, login, program creation |

### Recent Productization Work (Completed)

- Roster: level badges, filter pills, enhanced search, tighter rows, improved empty state
- TeamHome: section heading system, card padding standardization, empty states, skeleton
- Schedule: clean header, color-coded type badges, tighter event cards, skeleton
- Dashboard: rank numbers, metric/position/grade filters, skeleton
- Demo seeder: 25 players, 11 games, 9 practices, 8 metrics, 3 sessions, ~500 evaluations

### Current High-Priority Gaps

1. **7 Supabase migrations not applied** — multiple features depend on them (see §7)
2. **Station Mode stationIndex desync** — scoring confusion in edge case (KI-9b)
3. **No error boundaries at route level** — unhandled error crashes the whole app
4. **No team level badge on Dashboard player cards or PlayerDetail header** (KI-10a)
5. **DataImport bypasses service layer** — no Zod validation on imported scores (KI-5a)
6. **AuthContext is monolithic** (716 lines) — decomposition deferred, works correctly (KI-3)
7. **No component or E2E tests** — only 67 unit tests for core business logic (KI-4)

---

## 7. Migrations and Data Notes

### Prepared Migrations (Not Yet Applied)

Seven SQL migrations exist in `supabase/migrations/` (20260315000001–000007). They are **not applied** to the live Supabase instance. Features that depend on them will error or silently degrade:

| Migration | Purpose | Impact If Missing |
|-----------|---------|-------------------|
| 000001 | Evaluation unique constraint | No DB-level duplicate prevention |
| 000002 | Coach email linking function | Coach invitations can't link on signup |
| 000003 | Analytics events table | Analytics instrumentation silently drops |
| 000004 | Analytics SQL views | Analytics page shows nothing |
| 000005 | Team management tables (games, game_rosters, lineup_entries) | Team Management + Game Detail pages error |
| 000006 | Public profile aggregation fix + trend data | Wrong aggregation on public profiles, no sparklines |
| 000007 | Practice plans + practice blocks tables | Practice Plans + Schedule pages error on practice data |

### Rules

- **Migrations are applied manually by the project owner** via Supabase Dashboard or CLI. Do not attempt to apply them programmatically or assume they have been applied.
- If a page errors on data fetch, **check whether the required migration has been applied** before assuming a code bug.
- Do not write new migrations without documenting them in KNOWN_ISSUES.md and TASK_QUEUE.md.
- If you create a new migration, add it to the sequential numbering (next would be 000008).

### Supabase Instance

Remote: `qpvkicddhvglugsleecu.supabase.co`
The `.env` file is gitignored. A `.env.example` exists with the required variable names.

---

## 8. Required Reading Order

Before beginning major implementation work, read these files in order:

1. **CLAUDE.md** — this file (engineering guardrails)
2. **PRODUCT_VISION.md** — product thesis, scope discipline, out-of-scope list
3. **LAUNCH_READINESS.md** — pilot readiness rubric, must-pass workflows, blockers
4. **ROLE_MATRIX.md** — role definitions, implementation priority
5. **ARCHITECTURE.md** — technical architecture, routing, service layer, data flow
6. **TASK_QUEUE.md** — active and upcoming tasks by phase
7. **KNOWN_ISSUES.md** — tracked bugs with severity and mitigation status
8. **DECISIONS.md** — 51+ technical decision records with rationale
9. **PROGRESS.md** — chronological build log
10. **BUILD_SUMMARY.md** — comprehensive snapshot of what was built (line counts, phases, file tree)
11. **PILOT_RUNBOOK.md** — coach-facing pilot walkthrough

For source code context:
- `src/services/index.ts` — service layer exports
- `src/App.tsx` — route structure and role-based routing
- `src/contexts/AuthContext.tsx` — auth state, role detection, program switching

---

## 9. Required Deliverable Format

After completing each task, return:

1. **Implementation summary** — what was done and why (2-5 sentences)
2. **Files changed** — list of files created, modified, or deleted
3. **Decisions made** — any architecture, schema, or UI decisions with brief rationale
4. **Tradeoffs or limitations** — what was deferred or imperfect and why
5. **Remaining gaps** — in priority order, what should be done next

If a decision is significant (affects architecture, schema, permissions, or establishes a new pattern), document it in DECISIONS.md following the existing format (D-number, date, status, problem/options/choice/rationale).

Update PROGRESS.md after completing a sprint or significant batch of work.
Update TASK_QUEUE.md to mark completed items and add any new items discovered.
