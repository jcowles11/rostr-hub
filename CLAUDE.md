# CLAUDE.md — Rostr Engineering Context

**Last updated: April 29 2026.**

## 0. Workspace shape

This worktree contains two projects sharing one Supabase database:

| Path | What it is | Status |
|------|------------|--------|
| `./rostr-next/` | **Next.js 14 + Supabase + Anthropic. This is what's deployed.** | **Active.** All current engineering work happens here. |
| `./` (root) | Vite + React 18 SPA — the original Rostr build. | **Dormant.** Kept as reference; not deployed; not maintained. |

When in doubt, you're working in `rostr-next/`. The two projects share `supabase/migrations/` and the same remote database (`fubylvgkvnjjrpvdavjy.supabase.co`).

---

## 1. Project Identity

Rostr is a sports team operating system for high-school baseball coaches, evaluators, and program administrators. It digitizes tryout evaluations, roster management, practice planning, game-day operations, live scoring, and player development tracking.

**Current phase:** Pilot deploy. Operationally hardened, not feature-driven.
**Current goal:** Get the app on a real URL, in front of one trusted coach, watch them use it. Iterate on what breaks.

Sport-agnostic at the data layer (positions / metrics / sessions are configuration, not schema). Baseball is the launch sport.

---

## 2. Tech Stack (rostr-next)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) — server components + client components + server actions |
| Language | TypeScript 5 (strict) |
| Styling | TailwindCSS 3 + custom design tokens (`ink`, `paper`, `red`, `grass`, `sky`, `hair`) |
| UI | Radix primitives + custom organisms (TopBar, Modal, sidebar) — no shadcn/ui dependency |
| Data | Supabase (Postgres + Auth + RLS) via `@supabase/ssr` |
| Auth | Supabase email/password; middleware-gated `/app/*`, `/me`, `/scout/*` |
| AI | Anthropic SDK (`@anthropic-ai/sdk`), model `claude-haiku-4-5` |
| Validation | Zod (server actions only) |
| Icons | lucide-react |
| Deploy | Vercel (root directory = `rostr-next/`) |

### Commands (run from `rostr-next/`)

```bash
npm run dev          # Next dev server on :3000
npm run build        # Production build
npm run start        # Run prod build locally (after build)
npm run lint         # ESLint (advisory; lint-debt exists; doesn't gate prod build)
npx tsc --noEmit     # Strict typecheck
```

### Verification — run after every change

```bash
npx tsc --noEmit && npm run build
```

Both must pass with zero errors. This is the floor.

### Known caveats

- `next.config.mjs` sets `eslint.ignoreDuringBuilds: true` because pre-existing lint debt would otherwise block prod builds. Strict typecheck still runs and gates the build.
- The Bash tool's CWD drifts between subshells — always cd absolute when running long commands.
- Build artifacts go to `.next/` inside `rostr-next/`. Wipe with `rm -rf .next` if a build mysteriously fails on chunk references.

---

## 3. Architecture Rules

### Server actions

All mutations go through Next.js server actions, never direct Supabase calls from client components. The pattern:

```ts
"use server";

import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import { getCurrentCoach } from "@/lib/services/coach";

export async function fooAction(input: FooInput): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  // ... validate, mutate, revalidatePath
}
```

**Rules:**
- Always check `isDemoRequest()` first on any mutation. Demo prospects clicking modal submits otherwise see raw "No program" toasts.
- Always check coach context next. RLS is the ultimate gate, but explicit "No program" is friendlier.
- Use Zod (`safeParse`) on inputs that come from a form or untrusted client. Existing schemas live in `src/lib/validation/schemas.ts`.
- Return `{ error: string | null, ...payload }` — error null on success, error string on failure.
- Call `revalidatePath()` for any route that should refresh after the mutation.

### Demo mode pattern

The `/demo/*` route tree mirrors `/app/*` with mock data so prospects can play with a fully interactive product without signing up.

**How it works:**

- `/demo/page.tsx`, `/demo/roster/page.tsx`, etc. each render the same client view component used in `/app/*` (`HubView`, `RosterView`, `PracticeEditor`, etc.) with mock props from `src/lib/mock-data.ts`.
- Mock data is **dynamic, anchored on `new Date()`** — `getMockWeek()`, `getMockGames()`, `getMockScheduleEvents()` always pivot on the upcoming Friday so the schedule never goes stale. Pages that consume these export `dynamic = "force-dynamic"`.
- The middleware (`src/middleware.ts`) rewrites `/app/*` requests with a `/demo*` referer to the equivalent `/demo/*` path. So a click in the demo Hub that targets `/app/practice` lands on `/demo/practice` — keeps the tour seamless.
- `/demo/[...rest]/page.tsx` is a catch-all for paths that don't have a `/demo` mirror (e.g. `/demo/games/abc123`). Renders a friendly "not in the tour" card with a sign-up CTA.
- `isDemoRequest()` (`src/lib/demo-guard.ts`) detects the demo via the `Referer` header and short-circuits mutations + AI calls.
- AI server actions explicitly refuse in demo (`notConfigured: true`) — no Anthropic spend on prospects.

**When you add a new page:**

1. Build `/app/<feature>/page.tsx` against real data (`getCurrentCoach()` + `fetchX(coach.program_id)`).
2. Mirror at `/demo/<feature>/page.tsx` against mock data from `src/lib/mock-data.ts`.
3. Add the sidebar link in `src/app/demo/layout.tsx` (`DEMO_SECTIONS`).
4. Verify `/app/<feature>` from `/demo` referer redirects to `/demo/<feature>`.
5. If your page has navigation links to other `/app/*` routes, the middleware rewrite handles them automatically.

### Error boundaries + observability

Every route segment that does server-side work has both `error.tsx` and `loading.tsx`. Coverage spans `/app`, `/app/games`, `/app/games/[id]`, `/app/games/[id]/score`, `/app/practice`, `/app/practice/live-abs`, `/app/practice/live-abs/[id]`, `/app/practice/live-abs/stats`, `/app/practice/intrasquad`, `/app/today`, `/app/stats`, `/app/settings`, `/app/messages`, `/app/messages/[id]`, `/app/roster`, `/app/schedule`, `/app/tryouts`, `/app/tryouts/[id]`, plus public surfaces. Plus `src/app/global-error.tsx` for the catastrophic case.

All `error.tsx` files use `RouteErrorCard` (`src/components/organisms/error-boundary.tsx`) which:
- Surfaces a friendly retry + back-link card.
- Logs the error to the browser console.
- Posts the structured error report to `/api/log-error` via `captureError()` (`src/lib/observability.ts`). Reports use `navigator.sendBeacon` so they survive page unloads.

Errors land in Vercel function logs today. Swapping in Sentry / Datadog later is a one-file change in `src/app/api/log-error/route.ts` — every caller already routes through the abstraction.

### Rate limiting

AI server actions (`askAICoachAction`, `generatePracticePlanAction`) enforce per-coach rate limits via `src/lib/rate-limit.ts`:

- 5 calls/minute (burst)
- 20 calls/hour (sustained)

Hit returns `{ error: "Slow down — try again in 38s" }` style. Bumps are easy if real coaches need more; the point is to put a ceiling on Anthropic spend.

In-memory implementation. Per-instance only. Swap to Upstash KV when traffic justifies it — public API of `checkAIRateLimit(coachId)` stays identical.

### Migration-resilience pattern

Several services try a SELECT that includes columns from later migrations, and fall back to a base SELECT if the column doesn't exist. Pattern:

```ts
const tryFull = await supabase.from("games").select(FULL_COLUMNS).eq(...).maybeSingle();
if (tryFull.error && /column .* does not exist/i.test(tryFull.error.message)) {
  const fallback = await supabase.from("games").select(BASE_COLUMNS).eq(...).maybeSingle();
  // ... use fallback.data
}
```

Active in `fetchGameDetail`, `fetchRoster`. Lets the app degrade gracefully when a migration isn't applied — but as of April 29 2026, all migrations ARE applied, so the fallback paths are now defensive-only.

### General rules

- **Keep the app runnable at all times.** Every change must pass `npx tsc --noEmit && npm run build`.
- **Server actions handle mutations. Server components handle reads.** No `"use client"` component should call Supabase directly.
- **Demo mirror every coach-facing page.** If a feature lands in `/app/*` without a `/demo` equivalent, prospects can't see it.
- **Apply demo guards uniformly.** Every mutation action starts with `if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };`.
- **Don't ship pages without `error.tsx` + `loading.tsx`.** A blank screen is worse than a thrown error.
- **Don't add new dependencies casually.** Especially heavyweight ones (Sentry SDK, Redis client, ORM). The current dep list is intentionally tight.
- **Migrations are idempotent (`IF NOT EXISTS` patterns) and can be applied programmatically.** `supabase db push --linked` works; the project is already linked.

### Feature flags (pilot-safe module isolation)

In-progress modules live behind `NEXT_PUBLIC_ENABLE_*` env-var flags
so new code can be built and reviewed without surfacing on the live
pilot site.

| Flag | What it gates |
|---|---|
| `NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES` | per-field privacy toggles, verified vs. reported badges, advanced /me/profile sections |
| `NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS` | player-typed prior-season stats (sub-flag — also requires advanced profiles ON) |
| `NEXT_PUBLIC_ENABLE_TRAINING_PROGRAMS` | individualized training programs |
| `NEXT_PUBLIC_ENABLE_AI_PLAYER_ASSISTANT` | athlete-facing AI helper on /me |

All default OFF. Production (Vercel) MUST omit the env var entirely
so it reads as off. Local dev flips to `true` in `.env.local`.

**Source:** `src/lib/feature-flags.ts`
- `isFeatureEnabled(flag)` — boolean check (safe on server + client)
- `requireFlag(flag)` — server-side route guard; calls `notFound()` when off
- `featureDisabledMessage(flag)` — error string for gated server actions

**Rules:**
- Adding a flag → update `FlagName` in `feature-flags.ts` AND the
  `.env.example` file. TypeScript catches the FlagName side; the
  `.env.example` file is enforced by review.
- Gated route pages MUST `notFound()` when the flag is off — never
  render a stub or redirect to a placeholder that could leak the
  route's existence.
- Gated server actions early-return with `featureDisabledMessage(...)`
  even when the UI gate would prevent reaching them. Defense-in-depth
  in case a UI bug exposes the action's callsite.
- When a flag's module ships to pilot, delete the env-var read AND
  the gated branches in the same commit. Don't leave dangling checks.

---

## 4. Auth + RLS

Three roles: **coach** (default), **athlete** (`/me/*`), **recruiter** (`/scout/*`). Plus parents linked to athletes.

`src/middleware.ts` gates `/app/*`, `/me`, `/scout/*` — redirects to `/login?next=...` when no session. Marketing and public profile routes are always open.

`getCurrentCoach()` (`src/lib/services/coach.ts`) is the canonical "is there a logged-in coach with a program" check used by every server action and server component that needs program context. Returns `null` for anyone else (including authenticated athletes / recruiters who aren't coaches on a program).

RLS policies live in the migrations. The pattern is:
```sql
USING (program_id IN (SELECT program_id FROM coaches WHERE user_id = auth.uid()))
```
Coach can only read/write rows in their program. Athletes/recruiters have separate, narrower policies.

**Never bypass RLS by using a service-role key in server actions.** Use the per-request anon-key client (`createSupabaseServerClient()`) so the user's RLS context applies.

---

## 5. Migrations

**Status as of April 29 2026: fully synchronized.**

The remote project (`fubylvgkvnjjrpvdavjy`) has every migration in `supabase/migrations/` applied through `20260315000028`. Confirmed via `supabase migration list --linked` (Local + Remote columns match for all 28).

### Applying a new migration

The Supabase CLI is authenticated and the project is linked:

```bash
# From rostr-next/ or workspace root — same linkage applies
export SUPABASE_DB_PASSWORD=$(grep "^SUPABASE_DB_PASSWORD=" rostr-next/.env.local | sed 's/^[^=]*=//' | tr -d '"')

# Inspect what's local-only
supabase migration list --linked --password "$SUPABASE_DB_PASSWORD"

# Push pending migrations
supabase db push --linked --password "$SUPABASE_DB_PASSWORD"

# Verify a specific schema change
echo "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='live_status');" \
  | supabase db query --linked --output table
```

### Writing a new migration

1. Number sequentially: next is `20260315000029_*.sql`.
2. Use idempotent patterns:
   - `CREATE TABLE IF NOT EXISTS`
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   - `CREATE INDEX IF NOT EXISTS`
   - `DO $$ BEGIN IF NOT EXISTS (...) THEN CREATE POLICY ... END IF; END $$;`
3. Don't write destructive operations (`DROP COLUMN`, `ALTER COLUMN ... NOT NULL`, etc.) without explicit confirmation. Add a `released_at` column → backfill → mark NOT NULL in a follow-up if needed.
4. Apply via `supabase db push --linked` and verify.

### Migration history (high-level)

| # | Purpose |
|---|---------|
| 000001–000015 | Original schema: programs, players, coaches, evaluations, tryout stations, scoring, etc. |
| 000016 | Live game scoring fields (`opponent_program_id`, `live_status`, `live_started_at`) |
| 000017 | Game events log (append-only stream for live scoring) |
| 000018 | Batting stats views (computed live from game events) |
| 000019 | Pitching stats views |
| 000020 | Saved-search "new matches" tracking |
| 000021 | GameChanger imported stats tables (`player_imported_batting`, `player_imported_pitching`) |
| 000022 | Player media + game-prep fields (avatar/header/highlight URL, commitment, report/release time, uniform, etc.) |
| 000023 | Practice at-bats |
| 000024 | Practice pitches (per-pitch detail) |
| 000025 | K-looking distinguished from K-swinging |
| 000026 | Practice plans (planner schema + drill library + seed function) |
| 000027 | AI plan generation logging (`ai_plan_generations`, `ai_plan_feedback`) |
| 000028 | Soft delete for players (`released_at`, `released_by`, `release_note` + `active_players` view) |

---

## 6. Implemented features (rostr-next)

### Coach app (`/app/*`)

| Route | Purpose | Notes |
|-------|---------|-------|
| `/app` | Coach Hub | Stats tiles, availability, this-week schedule, AI Coach card, inbox, spotlight, activity feed |
| `/app/today` | Daily standup | Today's events, availability rollup, prep checklist, AI digest |
| `/app/roster` | Active roster | Sortable table, level pills, bulk operations, soft delete, sample-data seeder for empty states |
| `/app/practice` | Practice planner | AI-generated plans (haiku-4-5), drill library, blocks with lanes, append/replace flow, 👍/👎 feedback |
| `/app/practice/live-abs` | Live AB sessions | Pitch-by-pitch + outcome tracking, hot/cold leaderboards |
| `/app/practice/live-abs/[id]` | Scoring view | Tap-to-score, prominent undo button (⌘Z keyboard), per-AB delete |
| `/app/practice/live-abs/stats` | Team-wide live AB stats | Filter pills (All / Live ABs only / Intrasquad only), hitter + pitcher leaderboards |
| `/app/practice/intrasquad` | Intrasquad scrimmage builder | Squad split (auto-balanced), pitcher rotation, base rules (count starts, ghost runners, mercy), printable game plan |
| `/app/games` | Games list | Real games (no demo fallback for signed-in coaches), upcoming + recent record, empty state with CTA |
| `/app/games/[id]` | Game detail | Roster, lineup builder, prep notes, score recording, **printable lineup card** |
| `/app/games/[id]/score` | Live scoring | Mobile-first, append-only events |
| `/app/schedule` | Week view | Games + practices unified |
| `/app/stats` | Team leaderboards | Live from game events |
| `/app/tryouts` + `/app/tryouts/[id]` | Tryouts | Multi-day, station-based, live leaderboard |
| `/app/messages` + `/app/messages/[id]` | Inbox + threads | Coach ↔ parents/athletes/recruiters |
| `/app/settings` | Program config | Levels, staff invites, notifications, data tools |
| `/app/help` | FAQ + getting started | Static |
| `/app/analytics` | Season trends stub | Hardcoded charts; full version pending |

### Demo mode (`/demo/*`)

Mirrors every coach-facing page above (except `/app/games/[id]`, `/app/practice/live-abs/[id]`, `/app/tryouts/[id]` — heavy detail views deferred to catch-all). Anchors all dates dynamically on `new Date()`. AI is hard-disabled. Mutations show "This is a demo — sign up free" toast.

### Public surfaces

| Route | Purpose |
|-------|---------|
| `/` | Marketing page |
| `/login`, `/signup` | Auth |
| `/p/[handle]` | Public player profile (opt-in; recruiter view tracking; tab navigation; per-player measurables / academics / recruiting / career timeline) |
| `/me/*` | Athlete view of their own data |
| `/scout/*` | Recruiter search + lists |
| `/legal/privacy`, `/legal/terms` | Substantive pilot-phase legal docs (FERPA, COPPA, sub-processor list) |

### API routes

| Route | Purpose |
|-------|---------|
| `/api/log-error` | Sink for client-side error reports (POST, public) |
| `/api/ical/[programId]` | Public iCal feed for parents to subscribe to in Google/Apple Calendar |

### Top-bar search

`TopBarSearchBox` (`src/components/organisms/top-bar-search.tsx`) — ⌘K command palette. Searches:
- Page shortcuts (Hub, Today, Roster, Practice, etc.)
- Demo: MOCK_PLAYERS + MOCK_WEEK
- App: real roster + games + practices via `searchProgramAction` (debounced 200ms)

### Sample-data seeder

Empty-roster CTA on `/app/roster` calls `seedSampleRosterAction` to insert 15 plausible "Sample Adams"–"Sample Olson" players. Lets new coaches play around before importing real roster. Wipe via `clearSampleRosterAction` from Settings → Data.

---

## 7. UI patterns

### Established components

- **`TopBar`** (`src/components/organisms/top-bar.tsx`) — sticky page header with breadcrumbs, search, action buttons. Always at the top of an `/app/*` page.
- **`Modal`** (`src/components/molecules/modal.tsx`) — wraps Radix Dialog. Use for create/edit forms.
- **`RouteErrorCard`** (`src/components/organisms/error-boundary.tsx`) — shared error.tsx body. Always use this; never roll your own.
- **`Avatar`**, **`Button`**, **`Input`**, **`Chip`**, **`Kbd`** — atomic primitives in `src/components/atoms/`.
- **`SearchInput`** (legacy) — being replaced by `TopBarSearchBox` for the global palette. Per-list filtering still uses `Input` directly.

### Design tokens

Tailwind config defines a custom palette: `ink` / `paper` / `red` / `grass` / `sky` / `gold` / `amber` / `dirt` / `hair`. Plus Radix-style semantic tokens (`foreground`, `background`, `border`, `muted-foreground`).

**Common patterns:**
- Card: `bg-card border border-hair rounded-lg`
- Empty state: `bg-card border border-dashed border-hair rounded-lg p-8 text-center`
- Filter pill (active): `bg-foreground text-background border-foreground rounded-lg`
- Filter pill (inactive): `bg-card text-muted-foreground border-border hover:text-foreground rounded-lg`
- Section heading: `type-label` utility class (extra-bold uppercase tracking-widest)
- Page heading: `font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em]`
- Stat tile: `bg-card border border-hair rounded-lg p-4` with `type-label` + `font-mono` value

### Print styles

`src/app/globals.css` has a `@media print` block. Anything inside a `.print-card` div with `.print-root` parent renders cleanly. The lineup card on `/app/games/[id]` uses this; the intrasquad builder's "game plan" card uses it. `window.print()` triggers the browser print dialog.

---

## 8. Deploy

**Target:** Vercel.
**Root directory:** `rostr-next/` (the Next.js project, not the worktree root).

### Required env vars

| Variable | Source | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings | Public; used by client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings | Public; used by client |
| `ANTHROPIC_API_KEY` | Anthropic console | **Server-only.** Required for AI Coach. |
| `NEXT_PUBLIC_APP_URL` | Whatever Vercel assigns | Used for share links + public profile URLs |

`SUPABASE_DB_PASSWORD` lives in `rostr-next/.env.local` for migration pushes. Not needed at runtime.

### First-deploy steps

See `rostr-next/DEPLOY.md` for the canonical walkthrough. Short version:

1. Connect GitHub repo to Vercel (root directory = `rostr-next/`).
2. Set the four env vars above.
3. Trigger first deploy.
4. **Update Supabase auth redirect URLs** at https://supabase.com/dashboard/project/fubylvgkvnjjrpvdavjy/auth/url-configuration — set Site URL to the Vercel URL and add `<vercel-url>/**` to Redirect URLs. Without this, signup confirmation emails link to `localhost:3000` and don't work.

### Post-deploy verification

1. `/` returns 200 (marketing page renders).
2. `/demo` returns 200 (interactive tour, mock data, current week).
3. `/login` returns 200; signup → email confirmation → `/app/setup` lands.
4. `/api/ical/<your-program-id>` returns a `text/calendar` response.
5. `/api/log-error` returns 405 on GET, 200 on POST (verify in Vercel function logs).
6. AI Coach card on `/app` doesn't say "Set ANTHROPIC_API_KEY" — confirms env loaded.

---

## 9. Scope discipline

**Do not:**
- Self-direct roadmap changes or build features not explicitly assigned.
- Build speculative future systems (recruiting marketplace, NIL tools, social feed).
- Drift into multi-sport implementation beyond maintaining sport-agnostic data.
- Add heavyweight dependencies (Sentry SDK, Redis client, ORM, third-party UI library) without explicit justification.
- Rewrite working systems that just need polish.

**Always ask:** "Does this make a coach's daily workflow better, or does it serve a user we haven't earned yet?"

The Vite app's product docs (PRODUCT_VISION.md, LAUNCH_READINESS.md, PILOT_RUNBOOK.md at the worktree root) describe the product thesis and are still authoritative on the "what" and "why."

---

## 10. Required deliverable format

After completing each task, return:

1. **Implementation summary** — what was done and why (2-5 sentences).
2. **Files changed** — list of files created, modified, or deleted.
3. **Decisions made** — any architecture, schema, or UI decisions with brief rationale.
4. **Tradeoffs or limitations** — what was deferred or imperfect and why.
5. **Remaining gaps** — in priority order, what should be done next.

If a decision is significant (affects architecture, schema, permissions, or establishes a new pattern), document it in the worktree-root `DECISIONS.md` following the existing format (D-number, date, status, problem/options/choice/rationale). DO NOT update `PROGRESS.md` or `TASK_QUEUE.md` for rostr-next work — those track the dormant Vite app.

---

## 11. What's still genuinely deferred

Things known to be missing or rough; not blockers, but worth flagging:

- **Mobile audit on a real iPhone.** App is mobile-first per the original vision but hasn't been stress-tested in the dugout in low light.
- **Real Sentry integration.** Today errors land in Vercel function logs. The error boundaries already check `window.Sentry?.captureException` defensively, so adding `@sentry/nextjs` later is a one-file swap.
- **Bulk message / email blast.** Inbox UI exists; backend send-flow needs SendGrid or Twilio.
- **Demo mirrors for game detail / live scoring / tryout detail.** Heavy interactive surfaces; current `/demo/[...rest]` catch-all renders a "not in tour" card for them.
- **Demo guards on `tryouts/`, `messages/`, `settings/`, `setup/` server actions.** Lower-impact since those surfaces aren't reachable via `/demo` navigation today; auth check still rejects writes. Apply uniformly when you next touch each file.
- **Lint debt.** `next.config.mjs` skips lint during build to unblock pilot. Worth a dedicated cleanup sprint at some point.
- **Concurrent-edit handling on lineup builder.** Last-write-wins today.
- **Roster CSV / PDF export.** Coaches will ask for it for season recaps.
- **PWA install prompt + Web Push.** Game-day reminders are a parent-facing feature waiting to happen.
- **Real-time updates.** Live scoring is single-user today; multi-coach real-time would use Supabase realtime.

These are the kinds of things to add only when a real coach asks for them.
