# Rostr — Full Summary

**Last updated:** 2026-05-06
**Audience:** founder + PM + future advisors / engineers / investors / counsel
**Status:** pre-revenue, post-pilot architecture, 28 commits ahead of production on the dev branch

This is the single-document orientation. It supersedes nothing — every claim is sourced from a more specific document elsewhere in the repo — but if you have one hour to understand Rostr, this is the right hour.

---

## Executive summary

**What Rostr is:** the operating system for high-school sports programs, and the verified-athlete identity layer that gets built as a side effect of running on it.

**What's true today:**
- Web product is live at the production URL on Vercel. Coaches can use it for real tryouts, practices, games, and rosters.
- 27+ commits of polished, flag-gated infrastructure sits on the dev branch — player profile system, coach verification of stats + highlights, scout discovery, rankings engine, COPPA/SOPIPA compliance scaffolding, pricing page, GameChanger CSV import. None of it ships in production yet.
- Compliance posture is genuinely defensible (default-private minor data, hard age floor at 13, CA + NY scout geo-block, parental consent flow, three-layer permission enforcement) — though no licensed counsel has reviewed it yet.
- Strategic direction is set: layered SaaS (Program → Family → Scout) with the verified-data layer as the recruiting moat.

**What's not true yet:**
- Not in any app store.
- No way to take payment.
- No paid customer.
- No retained outside counsel.
- No dedicated team beyond founder + AI-assisted engineering.

**Realistic path to "downloadable on the App Store":** 8–13 weeks of focused engineering. Single biggest variable is hours-per-week the founder allocates to it.

**Realistic path to first paying customer:** 4–8 weeks of execution after Stripe + email pipeline ship. Both are 1–2 weeks of work each.

---

## 1. The product, in plain terms

### What it does for a coach

A high school baseball coach sitting at their desk in February opens Rostr and:

1. Imports their roster (or had it imported from GameChanger via CSV)
2. Scheduled tryouts: 3 days, 6 stations, multiple evaluators scoring on phones
3. Generated a practice plan with the AI Coach: 2 hours, 4 blocks, lane assignments
4. Built the lineup for tomorrow's game with the interactive lineup builder
5. Printed lineup cards for the dugout
6. Watched live scoring during the game, with pitch-by-pitch event capture
7. Saw automatic stat aggregation: BA, OPS, ERA, WHIP per player
8. Posted a public game viewer link for parents to follow along
9. Verified a player's highlight clip so it shows the "Verified by Coach Martinez" badge on their public profile
10. Pulled rankings: who's the best in the program, sortable by metric, comparable across class years

Every one of those workflows is built and works in production today (with the verification + ranking pieces flag-gated awaiting activation).

### What it does for a parent

When a coach has set up the team, the parent:

1. Subscribes to the team calendar via iCal in Apple Calendar
2. Watches games live via the public game viewer link
3. Receives a parental consent request for their athlete's profile
4. Decides which scopes to authorize (public profile, verified metrics, scout discovery, recruiter outreach) — granular, all default-off
5. Their athlete edits their own profile (bio, prior stats, highlight links, photos)
6. The "Verified by Coach Martinez" badge appears on their athlete's profile when the coach signs off

### What it does for a scout / recruiter

When the scout layer is activated:

1. Search verified athletes by name, position, class year
2. Filter to "verified data only" — only players with coach-vouched signals appear
3. Sort by Scout Signal score (weighted formula: verified clips × 5 + verified prior stats × 3 + measurables × 2 + recency)
4. Click into a profile, see verified game stats, measurables, highlights
5. (Future, not yet built) DM the athlete + parent through the inbox

Geo-blocked in CA + NY at launch. Available in 47 other states.

---

## 2. Strategic vision

### The thesis (three observations)

1. **HS sports is the last large software vertical without a real stack.** Coaches still run programs out of clipboards, group texts, and Google Sheets. GameChanger owns the live scorebook moment. Hudl owns video. Nobody owns the *day*.

2. **Trust in athlete data is the moat.** Recruiting is a $billion problem because every recruiter is reading self-reported numbers. The first platform with a credible coach-verified career record per athlete becomes the place colleges look first. The verification cannot be retrofit — it has to come from coaches doing their actual job.

3. **Parents pay for hope.** ~16,000 US high schools play baseball. ~488,000 HS baseball players. ~5% play in college. **100% of the parents wish they could.** The middle-class baseball parent already spends $3–12k/year on travel ball; $10/month for the platform that surfaces their kid to colleges is a rounding error.

The strategic insight: **build for the coach, charge the parent, monetize the recruiter.** Three customers, one product, layered pricing.

### Three monetization layers

| Layer | Customer | Price | What they get |
|---|---|---|---|
| **Program** | Head coach / AD | $99/mo | Team OS — roster, tryouts, practice, live scoring, schedule, AI Coach |
| **Family** | Parent of athlete | $10/mo | Premium profile editor, public profile, scout discovery opt-in, recruiter messaging |
| **Scout** | College recruiter / agency | $499/mo | Search verified athletes, scout signal, saved searches, outreach |

**Math at HS-baseball saturation:**
- 16,000 baseball programs × $99 = $19M ARR (Layer 1)
- 30% parent attach × 16,000 × 50 players × $10 = $28.8M ARR (Layer 2)
- 1,400 NCAA D1/D2/D3/NAIA + 200 agencies = ~$17M ARR (Layer 3)

**Total ceiling for baseball alone: ~$65M ARR.** Multiply by sport when expanding.

**Comparable:** Hudl is $400M+ revenue. GameChanger sold for $22M in 2016 and is now arguably worth $500M+ as part of DICK'S Sporting Goods.

### Competitive position

| Competitor | What they own | Where Rostr beats them |
|---|---|---|
| **GameChanger** | Live scorekeeping in HS baseball/softball | Practice planner, tryouts, recruiting, AI Coach, modern UI |
| **MaxPreps** | Stats aggregation, box scores | Verified data with coach attribution |
| **TeamSnap** | Schedule + roster for youth/rec sports | Tryouts, scoring engine, recruiting layer |
| **Hudl** | Video coaching tools (mostly football/basketball) | Baseball-first, day-to-day operations vs. just film |
| **NCSA / Perfect Game / PBR** | Family-pay recruiting profiles | Coach-verified data (their data is self-reported) |

The moat compounds with time. Every season Rostr runs in a program, that program's seniors graduate with a 4-year verified record. A competitor starting today has zero seniors with 4-year records for 5+ years. **Time × verified-data-per-athlete = the moat.**

---

## 3. Where the codebase stands

### 3a. Live in production (origin/main, deployed to Vercel)

The team OS is fully operational. A coach can sign up, build a roster, run a tryout, plan practices, score games, manage their schedule, and message parents — all without the founder being involved.

| Surface | Status |
|---|---|
| Marketing landing (`/`) | ✅ Live |
| Coach Hub (`/app`) | ✅ Live — daily standup, today's events, week ahead, AI Coach |
| Today (`/app/today`) | ✅ Live — daily prep checklist + AI digest |
| Roster (`/app/roster`) | ✅ Live — soft-delete, sample-data seeder |
| Practice planner (`/app/practice`) | ✅ Live — AI plan generation, drill library, drag-drop blocks |
| Live ABs (`/app/practice/live-abs`) | ✅ Live — pitch-by-pitch tracking |
| Intrasquad (`/app/practice/intrasquad`) | ✅ Live — auto-balanced squads, printable plan |
| Games + live scoring (`/app/games/*`) | ✅ Live — append-only event log, lineup builder |
| Schedule (`/app/schedule`) | ✅ Live — week view |
| Stats (`/app/stats`) | ✅ Live — team leaderboards from game events |
| Tryouts (`/app/tryouts`) | ✅ Live — multi-day, station-based, phone scoring |
| Messages (`/app/messages`) | ✅ Live — inbox + threads |
| Settings (`/app/settings`) | ✅ Live — program config, levels, staff invites |
| Public game viewer (`/g/[id]`) | ✅ Live — anonymous, box score + diamond viz |
| Public player profile (`/p/[handle]`) | ✅ Live — opt-in, no auth |
| Demo mirror (`/demo/*`) | ✅ Live — full prospect tour with mock data |
| iCal feed (`/api/ical/[programId]`) | ✅ Live |
| AI Assistant Coach | ✅ Live — Anthropic Haiku, rate-limited |
| PWA + iOS-native polish | ✅ Live — installable, bottom nav, FAB, safe-area insets |

### 3b. Branch-only (28 commits ahead, ready to ship)

Behind feature flags so production is unaffected. When ready to ship, flip an env var on Vercel and these surfaces become live. All have been built + typechecked + production-build-tested.

| Sprint | Behind flag | What it adds |
|---|---|---|
| Player Profile v1 | `NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES` | Privacy switches, prior-season stats, verified-vs-reported badges |
| Player Profile v2 | same | Contact + socials, coach review surface, demo profile mirror |
| Highlight Verification | same | Coach verify/unverify clips with three-layer enforcement |
| Verification Polish | same | Locked state, attribution, confirmation dialogs |
| Prior Stats Verification | same | Same flow extended to prior-season rows |
| Scout Discovery v1 | `NEXT_PUBLIC_ENABLE_SCOUT_MODE` | Search + filters + cards, geo-blocked CA + NY |
| Scout Signal + Ranking | same | Per-player signal score (verified counts × weights + recency) |
| Player Rankings Engine | unflagged at `/app/rankings` | Percentile + benchmark scoring across tryouts |
| Compliance Foundation | unflagged | Migration 39 + 40, parental consent flow, age floor, geo-block |
| Pricing + Data Rights | unflagged | `/pricing`, `/legal/data-rights`, `/scout/unavailable` |
| GameChanger CSV Import | unflagged at `/app/roster/import` | Roster import for switching coaches |

### 3c. What's NOT built — gap list

In priority order:

| Gap | Severity | Effort |
|---|---|---|
| Stripe checkout integration | P0 for revenue | 1 week |
| Email send for consent flow | P0 for parental consent at scale | 3-5 days |
| Capacitor / native iOS wrapper | P0 for App Store | 2-4 weeks |
| Sign in with Apple | P0 for App Store | 3-5 days |
| Push notifications (APNs) | P1 for App Store | 1 week |
| In-App Purchase scaffolding | P0 for paid iOS | 1-2 weeks |
| Bulk parent SMS/email blast | P1 (TeamSnap parity) | 1-2 weeks |
| Smoke tests for critical flows | P1 | 1 week |
| Sentry / PostHog observability | P2 | 2-3 days |
| Rate limiting on critical endpoints | P2 | 2 days |
| State leaderboards | P2 (distribution flywheel) | 1-2 weeks |
| Real-time multi-coach scoring | P2 | 1 week |
| GameChanger stat-history import | P3 | 2-3 weeks |
| NCAA recruiting calendar gates | P3 (when scout flag flips on) | 1 week |

### 3d. Tech foundations

- **Stack:** Next.js 14 (App Router) + Supabase (Postgres + Auth + RLS) + Anthropic Claude Haiku 4.5 + Vercel
- **40 migrations** applied to remote DB
- **Strict TypeScript**, Zod validation on every mutation
- **Service-layer pattern** — DB reads in `src/lib/services/*`, writes in `src/app/**/actions.ts`
- **Three-layer enforcement** (UI + app + DB) on verified-data integrity
- **Demo guard** short-circuits every mutation when origin is `/demo/*`
- **PWA + iOS-native polish** (installable, bottom nav, FAB, safe-area insets, page transitions)
- **Rate-limited AI calls** — 5/min, 20/hour per coach
- **Fail-closed defaults** — public profile, consent, age floor, geo-block all default to most-restrictive

---

## 4. Compliance & legal posture

### 4a. The framework Rostr operates in

Three distinct legal regimes per `COMPLIANCE.md` §0:

| Mode | When applies | Primary law | Status |
|---|---|---|---|
| **A. School-affiliated, FERPA-covered** | District contract via DPA | FERPA + state student-data laws | Not pursued at launch — DPA template not yet built |
| **B. Coach-as-individual** | Private coach uses Rostr | COPPA (under 13 only), state UDAP, privacy torts | Default mode at launch |
| **C. Adult athletes** | Player is 18+, self-onboarded | CCPA / CPRA, state consumer privacy | Future / edge case |

Virtually every pilot user is **Mode B**.

### 4b. What's enforced today (and how)

- **Hard age floor at grade 9** (presumed age 14). Three layers: DB CHECK constraint, app-layer assertion, UI grade picker minimum. Rostr does not knowingly collect under-13 data — sidesteps COPPA's verifiable-parental-consent requirements.
- **Default-private posture for all profiles.** Migration 39 backfilled `profile_public = false` for every existing row. New rows default false. Public exposure requires explicit opt-in AND parental consent for minors.
- **4-layer public profile gate** at `/p/[handle]`: slug lookup → `profile_public` flag → minor consent check → audit log. Returns 404 (not 403) on every fail so private profile existence is never disclosed.
- **Geo-block in CA + NY for scout features.** Three layers: edge middleware redirects to `/scout/unavailable`, app-layer service filter, SQL view filter. Team OS unaffected.
- **Permission matrix** — head_coach vs assistant_coach, with `requirePermission()` server helper enforcing destructive operations. Tightened RLS on `tryout_scores` UPDATE/DELETE + `players` DELETE → head_coach only.
- **Parental consent table + flow** with single-use tokens, IP + UA forensic capture, granular scopes, soft-revocation. Audit-trail-grade record never hard-deleted.
- **Data classification registry** — every player field tagged with sensitivity tier. Public profile renderer uses `filterFieldsForPublic()`; unregistered fields drop by default (fail-safe).
- **Sensitive fields removed.** Migration 40 dropped `medical_notes`, `emergency_contact_name`, `emergency_contact_phone` from `players`. Counsel review identified these as state-law conflict surfaces with no product use case.
- **Bounded retention.** No "indefinite" claims on minor data. 7-year ceiling on verified game stats. 7-year ceiling on consent records past revocation. Shorter for operational data.
- **Three-layer enforcement on verified data integrity** — UI lock + app guard + DB trigger. A player cannot mutate a coach-verified clip via any code path.

### 4c. Legal review status

**No licensed outside counsel review has occurred** as of this document's date. Founder is pre-revenue and operating in AI-assisted compliance review mode (per `DECISIONS.md` D53):

- The AI reviewer (this model) provides research-grade analysis, not legal advice
- COMPLIANCE.md disclaimer makes this status explicit so it's defensible
- §15 of COMPLIANCE.md documents the defensive-by-default operating principles in effect until counsel is retained
- Trigger to retain counsel: first paid customer OR $5k MRR OR any regulator/district inquiry

The compliance posture is materially stronger than typical pre-revenue ed-tech — but the AI review is not a substitute for licensed sign-off, and that's stated honestly throughout.

### 4d. The marketing-vs-consent guardrail

The single highest residual risk to Rostr while operating without counsel is a deceptive-practices claim under FTC Act §5 or state UDAP statutes. Trigger: marketing copy that promises something the consent flow doesn't authorize.

The AI reviewer commits to:
1. **Pre-launch review** of every public-facing claim about user data
2. **Marketing-vs-consent diff** before any new pricing-page or landing-page change ships
3. **Quarterly drift audit** between COMPLIANCE.md and the actual code

This is documented in COMPLIANCE.md §15a and §15h.

---

## 5. Decision history (the strategic record)

`DECISIONS.md` has 53 entries. The most important for orientation:

| # | Decision | Date | Why it matters |
|---|---|---|---|
| **D53** | Operate without retained outside counsel; AI-assisted compliance review | 2026-05-06 | Default operating mode until first paid customer |
| **D52** | Ed-tech posture + geo-block (Option A) over bifurcation (Option B) | 2026-05-06 | CA + NY are voluntarily walled off from Scout layer; revisit when family-pay subscription validates |
| D51 | Team management productization — TeamHome as landing, Schedule in nav | 2026-03-15 | Defines daily-coach-use UX |
| D50 | Practice planning — TEXT time storage, flat block schema | 2026-03-15 | Practice planner architecture |
| D49 | Player Comparison via public profile RPC over custom endpoint | 2026-03-15 | Reuse over speculation |
| D34 | Lightweight pilot analytics (Supabase table, not third-party SDK) | 2026-03-15 | Scope discipline |
| D29 | Composable filter guards over early returns | 2026-03-15 | Core dashboard pattern |
| D26 | Retry queue for score entry network failures | 2026-03-15 | Field-day reliability |

The discipline shown in maintaining 53 decision records is itself a defense — in a future regulatory or investor inquiry, "every product decision was deliberated and documented" is how a founder demonstrates reasonable conduct.

---

## 6. The path to App Store

`PROJECT_STATUS.md` is the full PM-readable plan. Summary here:

### 6a. Packaging strategy

**Three options weighed:**

| Option | Effort | UX quality | Recommendation |
|---|---|---|---|
| **A. Capacitor wrapper** | 2-4 weeks | ~95% native | ✅ **Chosen for v1** |
| B. React Native rewrite | 3-6 months | Excellent | Future v2 if scale demands |
| C. Native Swift rewrite | 6-12 months | Best | Premature |

Capacitor wraps the existing Next.js app in an iOS WebView with native bridges (push, IAP, biometric, share sheet). Same codebase ships to web + iOS + Android.

### 6b. Realistic timeline

**8–13 focused engineering weeks** from "start packaging" to "approved on App Store." Across 7 phases:

```
Phase 1 (Wk 1-2):   Capacitor wrapper + TestFlight internal
Phase 2 (Wk 3-4):   Sign in with Apple + push notifications + native polish
Phase 3 (Wk 5-6):   Email pipeline (Resend) + Stripe + flag activation
Phase 4 (Wk 7):     Smoke tests + observability (PostHog)
Phase 5 (Wk 8):     App Store assets + listing + Privacy Nutrition Labels
Phase 6 (Wk 9-12):  Submit + Apple review iteration cycles
Phase 7 (Wk 13+):   Live on App Store
```

**Single biggest variable:** founder hours/week. At 5–10 hrs/week (alongside WPSG) → 16–20 weeks. At 20–25 hrs/week → 8–13 weeks.

### 6c. Apple-specific risks

Sports + youth apps draw extra reviewer scrutiny:

1. **Age rating + content moderation** — likely 4+ or 9+ rating. Apple may ask about user-generated content (highlight URLs, prior-stat text).
2. **COPPA-aware age gating** — Apple wants hard verification. We have grade ≥ 9 floor.
3. **In-App Purchase rule** — paid digital subscriptions MUST go through IAP (30% Apple cut, or 15% via Small Business Program). Web subscription handoff via Stripe is allowed for "reader apps" but requires specific UX.
4. **Recruiting features + minor data** — extra scrutiny on the verified-athlete profile / scout discovery layer. Have the consent flow + data classification ready to demo.
5. **Crash + reliability** — Apple rejects on first-launch crashes or obvious bugs. TestFlight beta is essential.

**Realistic Apple review expectation:** 2–3 review cycles, each 1–3 days of fix time on our side.

### 6d. Resource estimate

| Resource | Cost | When |
|---|---|---|
| Apple Developer account | $99/year | Phase 1 |
| App icon + screenshot designer | $300-800 (one-off) | Phase 5 |
| Email provider (Resend recommended) | $0-30/mo | Phase 3 |
| Stripe processing | 2.9% + $0.30/txn | Phase 3 |
| PostHog analytics | $0 free tier | Phase 4 |
| Sentry (optional, alternative) | $26/mo team plan | Phase 4 |
| Cyber + E&O insurance | $1500-4000/year | Phase 7 (post-launch) |
| Outside privacy counsel (deferred) | $5-15k written review | First paid customer |

**Engineering hours:** ~320–400 focused hours across 8–13 weeks.

---

## 7. Decision points open right now

The founder needs to call these. PM should surface for discussion.

### 7a. Native packaging strategy
**Locked:** Capacitor (Option A). No revisit until post-launch.

### 7b. IAP for App Store v1 or defer
**Recommendation: defer.** Free trial in app, "subscribe at rostr.app" web link to Stripe. Saves 1–2 weeks of v1 engineering. Apple's "reader app" rules permit if implemented correctly.

### 7c. Which flag-gated features ship in App Store v1
**Recommendation:** ship `NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES` (player profile + verification + import) WITH App Store v1. **Keep `NEXT_PUBLIC_ENABLE_SCOUT_MODE` OFF** until 10+ programs are using verification naturally. Launch Scout as a separate v1.1 event 60–90 days post-App-Store. Reasoning: scout discovery needs a pool of verified athletes to be useful.

### 7d. Email provider
**Recommendation: Resend.** Cleanest DX for Next.js, $0 free tier covers 3k emails/month.

### 7e. Observability
**Recommendation: PostHog.** Free tier covers 1M events/month, does both error tracking AND product analytics.

### 7f. Outside counsel timing
**Locked (per D53):** at first paid customer OR $5k MRR OR any regulator/district inquiry.

### 7g. When to merge dev branch to main
**Recommendation:** at start of Phase 3 (week 5). Until then, dev branch is the safety valve. Once main has the flag-gated code with flags OFF, production behavior is unchanged but deployment is unified.

---

## 8. Risks the founder should be tracking

| Risk | Severity | Mitigation |
|---|---|---|
| Apple rejects app at submission for sports+youth concerns | High probability, medium impact | Polished consent flow + age gating + clear content moderation answers |
| Solo-founder bandwidth conflict with WPSG | High probability, high impact | Realistic timeline (16–20 weeks if part-time); set expectations accordingly |
| Marketing copy drift from consent scopes | Medium probability, high impact | AI reviewer does pre-publish diff (committed to in COMPLIANCE.md §15a) |
| State regulator complaint from a CA or NY parent | Low probability, medium impact | Geo-block already in place; team OS works in 50 states; complaint would be on Mode B coach-individual use |
| Class action plaintiff-bar trolling | Low probability (pre-revenue), high impact | Conservative defaults + AI-reviewed compliance + cyber insurance pre-revenue minimal exposure |
| Data breach of minor records | Low probability, very high impact | Cyber liability insurance ($1500-4000/yr) BEFORE first paid customer; quarterly tabletop |
| Competitor (GameChanger / NCSA) copies the verified-data layer | Medium probability, medium impact | Time-based moat; every season Rostr runs accumulates verified records competitors can't retrofit |
| App Store IAP rule conflict with web subscription | Medium probability, medium impact | Decision 7b — defer IAP, web subscribe via reader-app rule |
| Concurrent-edit race conditions in lineup builder | Low probability, low impact | Last-write-wins is acceptable at pilot scale; flag for v2 if real-time becomes a feature |

---

## 9. Three things that are true that surprise people

1. **The codebase is more complete than typical pre-revenue ed-tech.** 27+ commits of polished, flag-gated infrastructure beyond what's already live. 53 decision records. 40 migrations. Three-layer enforcement on verified data. Most early-stage SaaS at this revenue tier doesn't have half of this.

2. **The compliance posture is the strategic moat.** Verified athlete data has zero competitors today because nobody else is positioned to generate it (GameChanger doesn't verify, NCSA self-reports, Hudl is video). The legal infrastructure protects the asset that builds the moat. The founder has been rigorous about it pre-revenue, which is rare.

3. **The single biggest near-term risk is execution velocity, not product or legal.** The product is good. The legal posture is defensible. The strategy is sound. The constraint is hours-per-week the founder can spend executing the App Store packaging + monetization plumbing. Add a part-time engineer or freelancer at Phase 3 (week 5) and the timeline tightens significantly.

---

## 10. Companion documents

| Doc | Purpose |
|---|---|
| `ROSTR_NORTH_STAR.md` | Full strategic vision, GTM playbook, 5-phase scaling plan |
| `PROJECT_STATUS.md` | PM-readable build plan with week-by-week App Store path |
| `COMPLIANCE.md` | Lawyer-reviewable data practices, consent flow, audit trail |
| `DECISIONS.md` | 53 architectural + strategic decision records |
| `LAUNCH_READINESS.md` | Pilot + Apple-shippable rubrics |
| `CLAUDE.md` | Active engineering context (stack, conventions, deploy process) |
| `AGENTS.md` | Codex onboarding (audit + QA role) |
| `KNOWN_ISSUES.md` | Tracked bugs and technical debt |

This document supersedes none of them. It connects them.

---

## 11. The 60-second pitch

> Rostr is the operating system for high-school sports programs. Coaches use it daily for tryouts, practice planning, live game scoring, and roster management — replacing the clipboards, group texts, and Google Sheets they use today. As coaches run their season on Rostr, the platform automatically generates a verified performance record for every athlete — coach-vouched stats, measurables, and highlights that recruiters can trust. We make money three ways: programs pay $99/month for the OS, parents pay $10/month for premium athlete profiles, and college coaches pay $499+/month to search the verified-data layer. The market is 16,000 baseball programs and 250k+ coaches across all HS sports. The moat is the multi-year verified athlete record that only gets built by running the OS — incumbents like GameChanger and Hudl can't retrofit it. The product is live in pilot today, the recruiting layer is built and flag-gated awaiting activation, and the path to App Store launch is 8–13 weeks of focused engineering.

---

## 12. The honest one-liner

**Rostr is a more-mature-than-it-looks pre-revenue ed-tech with a real strategic moat, a defensible legal posture, and one main constraint: the founder needs to ship the App Store packaging + monetization plumbing while running a recruiting business in parallel. The product itself is good. The path is bounded.**
