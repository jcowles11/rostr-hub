# Architecture

## Overview

Rostr is a client-side single-page application. There is no backend server — the app communicates directly with Supabase (PostgreSQL + Auth + Row Level Security + Edge Functions) via the `@supabase/supabase-js` client.

```
Browser (Vite + React 18 SPA)
  └── Supabase JS Client
        └── Supabase (PostgreSQL + Auth + RLS + Edge Functions)
```

The app is deployed as a static build (`vite build` → `dist/`). No SSR, no server components, no API routes.

## Key Directories

```
src/
├── pages/              # Route-level page components (41 files)
├── components/         # Reusable UI components (21 custom + 45 shadcn/ui)
├── services/           # Data mutation and query layer (11 modules)
├── contexts/           # React Context providers (AuthContext, SessionContext)
├── hooks/              # Custom hooks (useRetryQueue)
├── lib/                # Pure utility functions (metrics, sports, validation)
│   └── __tests__/      # Unit tests (67 tests)
├── integrations/
│   └── supabase/       # Supabase client initialization + auto-generated types
├── assets/             # Static assets (logo)
└── main.tsx            # App entry point
```

## Routing

All routing is client-side via `react-router-dom` v6 in `src/App.tsx`.

### Route Guards

Four role-based route wrappers control access:

- **`ProtectedRoute`** — coach/admin routes. Wraps content in `SessionProvider` + `AppLayout` (bottom nav). Redirects to `/auth` if unauthenticated, to `/setup` if no program exists.
- **`PlayerRoute`** — player-only routes. Wraps in `UnifiedNavShell`.
- **`EvaluatorRoute`** — evaluator-only routes.
- **`ScoutRoute`** — scout-only routes.

### Primary Coach Routes (via ProtectedRoute)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | TeamHome | Command center landing page |
| `/roster` | Roster | Player list with filters |
| `/schedule` | SchedulePage | Unified games + practices |
| `/score` | ScoreEntry | Live evaluation entry |
| `/dashboard` | Dashboard | Stats & Rankings |
| `/player/:id` | PlayerDetail | Individual player profile |
| `/settings` | SettingsPage | Program configuration |
| `/teams` | TeamManagement | Team-level views, game scheduling |
| `/game/:id` | GameDetail | Lineup builder |
| `/practices` | PracticePlanner | Practice plan list |
| `/practice/:id` | PracticePlanDetail | Practice block editor |
| `/analytics` | PilotAnalytics | Usage stats |

### Public Routes (no auth required)

| Route | Page | Purpose |
|-------|------|---------|
| `/p/:slug` | PublicProfile | Verified player profile |
| `/compare` | PlayerCompare | Side-by-side comparison |
| `/auth` | Auth | Login / signup |

### Bottom Navigation

The coach shell (`AppLayout`) shows 5 bottom nav tabs: Home (`/`), Roster (`/roster`), Schedule (`/schedule`), Score (`/score`), More (`/settings`).

## Service Layer

All production data mutations go through `src/services/`. Each service function returns `{ data, error }` and handles Supabase calls, Zod validation, and error formatting internally.

```
Page Component
  → calls serviceFunction(args)
    → Zod validates input
    → supabase.from('table').insert/update/delete(...)
    → returns { data, error }
  → Page handles success/error UI
```

### Services

| Service | Purpose |
|---------|---------|
| `playerService` | Player CRUD, CSV import support, auto-assign jersey numbers |
| `evaluationService` | Score saves (with retryable flag), fetch evaluations, inline edit/delete |
| `metricService` | Metric CRUD with Zod validation |
| `sessionService` | Session CRUD with safe cascade deletion |
| `teamService` | Game CRUD, game roster management, lineup operations |
| `practiceService` | Practice plan + block CRUD, coach name resolution |
| `coachService` | Fetch program coaches |
| `analyticsService` | Fire-and-forget event tracking with PII sanitization |
| `noteService` | Player flags |
| `demoSeedService` | Demo data generation (demo-only, not a production pattern) |

### Rules

- Pages must not contain inline `.from('table').insert(...)` calls for mutations.
- All new data mutations must go through the service layer.
- `demoSeedService` uses bulk inserts and seed data patterns — do not copy these into production services.

## Supabase Interaction

### Client

Initialized in `src/integrations/supabase/client.ts`. Uses two env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Types

Auto-generated types in `src/integrations/supabase/types.ts` (57KB). Regenerate with `supabase gen types typescript` when schema changes.

### Row Level Security

RLS policies enforce program-level data isolation at the DB level. All coach/evaluator queries are scoped to `program_id` matching the authenticated user's program. Public data (player profiles) uses `SECURITY DEFINER` RPC functions to bypass RLS safely.

### Important: RLS does not differentiate head_coach from assistant_coach. Permission differences between these roles are enforced in the UI layer only.

## Authentication and Roles

`src/contexts/AuthContext.tsx` (716 lines) manages all auth state. It is monolithic but functional — do not refactor casually.

### Roles

Four roles with different route access:

| Role | Detection | Primary Shell |
|------|-----------|---------------|
| `coach` (head_coach / assistant_coach) | Has a `coaches` record for a program | `AppLayout` (bottom nav) |
| `evaluator` | Has a `coaches` record with evaluator flag | `UnifiedNavShell` |
| `player` | Has a `player_profiles` record | `UnifiedNavShell` |
| `scout` | Has a `scout_profiles` record | `UnifiedNavShell` |

### Auth Flow

1. User signs up/logs in via Supabase Auth
2. `AuthContext.fetchUserRole()` checks `coaches`, `player_profiles`, `scout_profiles` tables
3. Role determines which route guard allows access
4. For coaches, program context is loaded and `SessionProvider` wraps the app

## Validation

Zod schemas in `src/lib/validation.ts` validate all critical mutation inputs. The `validateScoreValue()` function enforces metric-specific bounds (min/max per metric type).

Validated paths: player creation, score entry, session CRUD, metric CRUD, PlayerDetail inline eval add/edit.

Unvalidated paths (lower priority): program setup, coach invitation form fields.

## State Management

- **AuthContext** — user, role, program, coach record, loading state
- **SessionContext** — active tryout sessions for the current program
- **Local state** — most pages use `useState`/`useEffect` for data fetching. React Query (`@tanstack/react-query`) is installed and configured but underutilized.

## Data Flow Summary

```
User action (tap, form submit)
  → Page component handler
    → Service layer function
      → Zod validation
      → Supabase client call
      → { data, error } returned
    → UI update (setState, toast, navigate)
```

For Score Entry specifically, failed saves enter the retry queue (`useRetryQueue` hook) with exponential backoff rather than showing an error.

## Print Architecture

Lineup cards and practice plans use CSS `@media print` with BEM-style class names (not Tailwind) to ensure print stability. Print routes (`/game/:id/print-lineup`, `/practice/:id/print`) render standalone views outside the nav shell.

## Related Documents

| Document | Purpose |
|----------|---------|
| CLAUDE.md | Engineering guardrails, UI patterns, scope discipline |
| KNOWN_ISSUES.md | Technical debt and open bugs |
| DECISIONS.md | 51+ decision records explaining architectural choices |
| BUILD_SUMMARY.md | Comprehensive snapshot of all code built |
