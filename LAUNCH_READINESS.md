# Launch Readiness

## What "Ready" Means at This Stage

Rostr is in the **pilot-ready polish phase**. The core workflows exist and function. The current objective is not feature completion — it is making the existing product reliable, polished, and trustworthy enough that a real coach can use it during a real tryout without hitting confusing errors, losing data, or needing developer support.

"Ready" means: a coach can complete the full tryout-to-roster workflow on their phone without assistance.

## Current Launch Target

**Pilot deployment with 1-2 real baseball programs** (high school or club) during a tryout or pre-season evaluation period.

## Current Definition of Ready

The product is ready for pilot when:

1. All must-pass workflows complete without errors on mobile
2. Demo data can be seeded and cleared without side effects
3. The app feels intentional, not prototype-like (skeletons, empty states, consistent UI)
4. No data loss scenarios exist in normal usage
5. A coach can self-serve after a 10-minute walkthrough

---

## Must-Pass Workflows

### Coach Workflow

| Step | Workflow | Status |
|------|----------|--------|
| 1 | Sign up and create a program | Functional |
| 2 | See Team Home with useful overview | Functional, polished |
| 3 | Add players manually | Functional |
| 4 | Import players via CSV | Functional, has dedup |
| 5 | Configure evaluation metrics | Functional |
| 6 | Create a tryout/evaluation session | Functional |
| 7 | Enter scores via Score Entry | Functional, retry queue |
| 8 | Review rankings on Dashboard | Functional, polished |
| 9 | Assign team levels (V/JV/Fr) | Functional |
| 10 | View player profiles | Functional |
| 11 | Invite assistant coaches | Functional (manual link share) |
| 12 | Schedule games | Functional |
| 13 | Build lineups | Functional, dirty-state guard |
| 14 | Print lineup cards | Functional |
| 15 | Plan practices | Functional |
| 16 | View unified schedule | Functional, polished |

### Evaluator Workflow

| Step | Workflow | Status |
|------|----------|--------|
| 1 | Receive invitation and sign up | Functional (manual link) |
| 2 | Access Score Entry | Functional |
| 3 | Enter scores for assigned session | Functional |
| 4 | Use Station Mode for focused entry | Functional |
| 5 | See save confirmation | Functional (indicators) |
| 6 | Handle network interruption | Functional (retry queue) |

### Player Workflow

| Step | Workflow | Status |
|------|----------|--------|
| 1 | View public profile via link/QR | Functional |
| 2 | See verified metrics | Functional |
| 3 | See development trends | Functional |
| 4 | Share profile URL | Functional |

### Scout / Recruiting Viewer Workflow

| Step | Workflow | Status |
|------|----------|--------|
| 1 | Search players by criteria | Functional (scout-only) |
| 2 | View public player profiles | Functional |
| 3 | Compare 2-3 players side by side | Functional |
| 4 | See verified metric data | Functional |

### Program / AD / Club Workflow

| Step | Workflow | Status |
|------|----------|--------|
| 1 | Create organization | Functional |
| 2 | Manage coaches | Functional |
| 3 | View program-wide data | Partially functional (head coach only) |

---

## What Must Be True Before Pilot

1. **All 7 prepared Supabase migrations must be applied** (000001–000007). Without them, specific features break:
   - 000001: No DB-level duplicate evaluation prevention
   - 000002: Coach invitation email linking non-functional (coaches can't join programs)
   - 000003–000004: Analytics instrumentation silently drops events; analytics page shows nothing
   - 000005: Team Management and Game Detail pages error on data fetch
   - 000006: Public profiles show wrong aggregation (always "best") and no development trends
   - 000007: Practice Plans and Schedule pages error on practice data fetch
2. **Score Entry must not lose data under any network condition** — the retry queue handles this, but needs real-world validation.
3. **Demo data seeding must work cleanly** so the walkthrough demo is always available.
4. **The auth flow must work end-to-end** including coach invitation linking (requires migration 000002).
5. **Mobile performance must be acceptable** — no jank on Score Entry, no layout shifts on page transitions.

## What Can Still Be Imperfect

- Desktop layout — the app is mobile-first; desktop can be functional but visually cramped
- Email notifications for coach invitations — manual link sharing is acceptable for pilot
- Station Mode edge cases (stationIndex desync, skip player) — basic Station Mode works
- CSV import edge cases — coaches can fall back to manual entry
- Analytics views — nice to have for developer monitoring, not coach-critical
- Practice plan advanced features (duplication, drag-and-drop, templates)
- Lineup templates and copy-from-game polish
- Public profile Open Graph meta tags

---

## Likely Blockers Before Real Pilot

| Blocker | Severity | Resolution |
|---------|----------|------------|
| 7 Supabase migrations not applied | **Critical** — several features depend on these tables/functions | Apply via Supabase Dashboard or CLI |
| No real email sending for coach invites | Medium — workaround exists (manual link share) | Acceptable for pilot, improve post-pilot |
| Station Mode stationIndex desync | Medium — can cause scoring confusion in specific edge case | Fix guard logic (documented in TASK_QUEUE) |
| No error boundaries at route level | Low-Medium — an unhandled error crashes the whole app | Add React error boundaries |
| No E2E tests | Low — increases risk of regression during polish | Add after pilot stabilization |

---

## Tomorrow Morning Test Plan

A quick manual validation that the app is pilot-ready. Run on mobile (or mobile emulator):

1. **Auth**: Sign up → Create program → Land on Team Home
2. **Roster**: Add 3 players manually → Import 5 via CSV → Verify dedup
3. **Metrics**: Configure 3 metrics (1 timed, 1 measured, 1 rated)
4. **Session**: Create a tryout session
5. **Score Entry**: Score 3 players on all metrics → Verify save indicators
6. **Station Mode**: Enter Station Mode → Complete one metric pass
7. **Dashboard**: View rankings → Apply position filter → Apply grade filter
8. **Player Profile**: Open a player → Verify metrics and development trends display
9. **Team Levels**: Assign 2 players to Varsity → Verify badge appears on Roster
10. **Schedule**: Create a game → Create a practice → View Schedule page
11. **Lineup**: Build a 9-player lineup → Print lineup card
12. **Demo Seed**: Run demo seeder from Settings → Verify data populates all pages
13. **Demo Clear**: Clear demo data → Verify clean state

If all 13 steps pass without errors or confusion, the app is pilot-ready.

---

## Launch Readiness Rubric

| Area | Green | Yellow | Red |
|------|-------|--------|-----|
| **Score Entry** | Fast, reliable, retry works | Occasional lag | Data loss possible |
| **Roster Management** | Import + manual + levels work | Minor CSV edge cases | Players lost or duplicated |
| **Dashboard/Rankings** | Filters work, rankings correct | Minor sort edge cases | Wrong rankings shown |
| **Team Home** | Useful overview, no errors | Some stale data | Crashes or blank |
| **Schedule** | Games + practices unified | Missing some events | Wrong dates or crashes |
| **Lineup Builder** | Build, save, print all work | Minor UX friction | Data loss on navigate |
| **Practice Plans** | Create, edit, print work | Missing some features | Crashes or data loss |
| **Player Profiles** | Metrics + trends display | Some metrics missing | Profile broken |
| **Auth & Permissions** | Roles enforced correctly | Minor permission gaps | Wrong data exposed |
| **Mobile UX** | Feels native, fast | Some layout issues | Unusable on phone |

**Current assessment (as of 2026-03-16, pre-migration):**

| Area | Rating | Notes |
|------|--------|-------|
| Score Entry | Green | Retry queue, save indicators, duplicate guard all working |
| Roster Management | Green | Import, manual add, level badges, search, filters all polished |
| Dashboard/Rankings | Green | Filters, rank numbers, metric coverage indicator, skeleton loader |
| Team Home | Green | Polished command center with skeleton loader |
| Schedule | Yellow | UI polished; practice data fetch will error until migration 000007 applied |
| Lineup Builder | Green | Dirty-state guard, copy-from-game, print all working |
| Practice Plans | Red | Page errors on data fetch — requires migration 000007 |
| Player Profiles | Yellow | Functional but aggregation incorrect until migration 000006; no level badge on PlayerDetail |
| Auth & Permissions | Yellow | Works but coach invitation linking requires migration 000002 |
| Mobile UX | Green | Consistent polish pass completed across all primary pages |

The primary risk is the unapplied migrations — without them, three Green/Yellow areas drop to Red.

---

## Build Prioritization Rule

When deciding what to work on next, apply this priority order:

1. **Fix anything that loses data** — score entry reliability, save failures, navigation data loss
2. **Fix anything that blocks a must-pass workflow** — if a coach can't complete the tryout flow, nothing else matters
3. **Polish what coaches will see first** — Team Home, Score Entry, Dashboard, Roster
4. **Add missing context** — empty states, loading skeletons, error messages
5. **Extend existing workflows** — new features within systems that already work
6. **Build new systems** — only when all of the above are satisfied

## Related Documents

| Document | Purpose |
|----------|---------|
| PRODUCT_VISION.md | Product thesis, scope discipline, out-of-scope list |
| ROLE_MATRIX.md | Role definitions and implementation priority |
| TASK_QUEUE.md | Specific tasks remaining per phase |
| KNOWN_ISSUES.md | Tracked bugs with severity and mitigation status |
| PILOT_RUNBOOK.md | Coach-facing pilot walkthrough |
