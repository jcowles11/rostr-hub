# Rostr — Project Status & Path to App Store

**For:** Project Manager / build planning
**Last updated:** 2026-05-06
**Branch reviewed:** `claude/inspiring-wilbur-895b90` (27 commits ahead of `origin/main`)
**Reviewer:** Engineering + AI-assisted analysis

---

## TL;DR

Rostr is a substantially-complete web product with significant unshipped infrastructure on the dev branch. The core team-OS workflows (roster, tryouts, practice, live scoring, schedule, stats, public profiles, AI Coach) are live in production. The recruiting/verification layer is complete in code but flag-gated. Compliance scaffolding for COPPA/SOPIPA/state laws is in place.

**The product is web-first today.** It is NOT yet packaged as a native iOS or Android app.

To get an iOS app in the App Store ready for download:
- **Realistic engineering timeline:** 8–13 weeks of focused work
- **Critical-path items:** Capacitor wrapper (2 weeks), Sign in with Apple + push notifications (1 week), Stripe + IAP (2 weeks), TestFlight beta (2-3 weeks), Apple review iteration (2-4 weeks)
- **Soft dependencies:** flagging-up of branch-only features, email-send wiring, smoke test suite, marketing assets

This document is the planning surface. Section 5 has the recommended sequence + decision points.

---

## 1. Current state of the codebase

### 1a. What's live in production (origin/main, deployed to Vercel)

| Surface | Status | Notes |
|---|---|---|
| Marketing landing (`/`) | ✅ Live | Mobile-first, MacBook-themed hero |
| Coach Hub (`/app`) | ✅ Live | Daily standup, today's events, week ahead, AI Coach card |
| Today (`/app/today`) | ✅ Live | Daily prep checklist, AI digest |
| Roster (`/app/roster`) | ✅ Live | Sortable table, soft-delete, sample-data seeder |
| Practice planner (`/app/practice`) | ✅ Live | AI-generated plans, drill library, drag-drop blocks |
| Live ABs (`/app/practice/live-abs`) | ✅ Live | Pitch-by-pitch tracking, hot/cold leaderboards |
| Intrasquad (`/app/practice/intrasquad`) | ✅ Live | Auto-balanced squads, pitcher rotation, printable plan |
| Games + live scoring (`/app/games/*`) | ✅ Live | Append-only event log, lineup builder, AI prep auto-fill |
| Schedule (`/app/schedule`) | ✅ Live | Week view, games + practices unified |
| Stats (`/app/stats`) | ✅ Live | Team leaderboards from game events |
| Tryouts (`/app/tryouts`) | ✅ Live | Multi-day, station-based, phone scoring |
| Messages (`/app/messages`) | ✅ Live | Inbox + threads (no bulk-send yet) |
| Settings (`/app/settings`) | ✅ Live | Program config, levels, staff invites |
| Public game viewer (`/g/[id]`) | ✅ Live | Anonymous, box score + diamond viz |
| Public player profile (`/p/[handle]`) | ✅ Live | Opt-in, no auth |
| Demo mirror (`/demo/*`) | ✅ Live | Full prospect tour with mock data |
| iCal feed (`/api/ical/[programId]`) | ✅ Live | Parents subscribe in calendar apps |
| AI Assistant Coach | ✅ Live | Practice plan + lineup generation, game-day prep auto-fill |
| PWA + iOS-native polish | ✅ Live | Install prompt, bottom nav, FAB, safe-area insets |

**Infrastructure:**
- Next.js 14 (App Router) + Supabase (Postgres + Auth + RLS) + Anthropic Claude Haiku
- Deployed on Vercel
- 38 migrations applied to remote
- Strict TypeScript, Zod validation on mutations
- Service-layer pattern, RLS at the DB

### 1b. What's on the dev branch (27 commits ahead, not deployed)

Behind feature flags, ready to ship after legal sign-off + product validation:

| Sprint | Flag | What it adds |
|---|---|---|
| Player Profile v1 | `NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES` | Privacy switches, prior-season stats, verified-vs-reported badges |
| Player Profile v2 | same | Contact + socials, coach review surface, demo profile mirror |
| Highlight Verification | same | Coach verify/unverify clips with three-layer enforcement |
| Verification Polish | same | Locked state, attribution, confirmation dialogs |
| Prior Stats Verification | same | Same flow extended to prior-season rows |
| Scout Discovery v1 | `NEXT_PUBLIC_ENABLE_SCOUT_MODE` | Search + filters + cards, geo-blocked CA + NY |
| Scout Signal + Ranking | same | Per-player signal score (verified counts × weights + recency) |
| Player Rankings Engine | unflagged at `/app/rankings` | Percentile + benchmark scoring across tryouts |
| Compliance Foundation | unflagged | Migration 39 + 40, parental consent flow, age floor, geo-block middleware |
| Pricing + Data Rights | unflagged | `/pricing`, `/legal/data-rights`, `/scout/unavailable` |
| GameChanger CSV Import | unflagged at `/app/roster/import` | Roster import for switching coaches |

**Compliance & legal infrastructure:**
- COMPLIANCE.md (16 sections, AI-reviewed, awaiting actual counsel)
- Data classification registry (every player field tagged with sensitivity)
- Parental consent table + flow
- 4-layer public profile gate (slug → flag → minor consent → audit log)
- Hard age floor (grade 9 / age 14 minimum)
- Geo-block middleware (CA + NY scout features)
- Permission matrix (head_coach vs assistant_coach)
- Three-layer enforcement (UI + app + DB) on verified-data integrity
- DECISIONS.md with 53 entries

### 1c. What's NOT yet built

These are gaps with real product impact, ordered by priority:

| Gap | Severity | Effort | Notes |
|---|---|---|---|
| Stripe checkout integration | P0 for revenue | 1 week | No way to take payment yet; pricing page is informational |
| Email send for consent flow | P0 for advanced profiles | 3-5 days | Coach can copy/paste consent link; not scalable |
| Bulk parent SMS/email blast | P1 | 1-2 weeks | TeamSnap parity gap; needs Twilio/SendGrid |
| Capacitor / native iOS wrapper | P0 for App Store | 2-4 weeks | Currently web-only |
| Sign in with Apple | P0 for App Store | 3-5 days | Apple requires if any social login present |
| Push notifications (APNs) | P1 for App Store | 1 week | iOS users expect push, especially for game-day |
| In-App Purchase scaffolding | P0 for paid iOS | 1-2 weeks | Apple requires IAP for digital subscriptions |
| Smoke tests for critical flows | P1 | 1 week | Auth, score entry, public profile gating |
| Sentry / PostHog observability | P2 | 2-3 days | Errors land in Vercel logs today |
| Rate limiting on critical endpoints | P2 | 2 days | Vercel middleware or Upstash |
| Backup verification + restore drill | P2 | 1-2 days | Document the process |
| State leaderboards | P2 | 1-2 weeks | Free distribution flywheel for coach acquisition |
| Real-time multi-coach scoring | P2 | 1 week | Supabase realtime; current scoring is single-user |
| GameChanger stat-history import | P3 | 2-3 weeks | Roster import shipped; stat history is harder |
| NCAA recruiting calendar gates | P3 | 1 week | Required when scout flag flips on |

---

## 2. The App Store path

**Reality check:** Rostr today is a Next.js web app accessible at a URL, plus a PWA that can be "Add to Home Screen" installed. It is NOT in the App Store. Apple does not list PWAs prominently and does not let them charge subscriptions through Apple Pay. To be on the App Store, Rostr needs to be packaged as a native iOS app.

### 2a. Three packaging options

| Option | Effort | UX quality | Long-term cost | Recommendation |
|---|---|---|---|---|
| **A. Capacitor wrapper** | 2-4 weeks | Good (~95% of native) | Low (one codebase) | **Recommended for v1** |
| **B. React Native rewrite** | 3-6 months | Excellent | Medium | Good for v2 if scale demands it |
| **C. Native Swift rewrite** | 6-12 months | Best | High (two codebases) | Premature for current stage |

**Capacitor** wraps the existing Next.js web app in an iOS WebView shell with native bridges for push, IAP, biometric auth, etc. Same codebase ships to web + iOS + Android. Used by Hudl (in some products), Kustomer, BurgerKing app, and many B2B SaaS.

**React Native** would require rewriting the UI in RN components — most of the Next.js components don't translate. It buys better animation performance and a more native feel, but it's 3-6 months of engineering for benefits the user won't notice in a coach-OS app.

Going forward, this doc assumes **Option A**.

### 2b. App Store requirements checklist

What Apple requires that Rostr doesn't have today:

| Requirement | Status | Effort |
|---|---|---|
| Apple Developer account ($99/yr) | Not done | 1 day to register |
| Capacitor wrapper integrated into Next.js | Not done | 1-2 weeks |
| iOS-specific UI polish (safe areas, haptics) | Mostly done (PWA polish) | 2-3 days for native gaps |
| Sign in with Apple | Not done | 3-5 days |
| Push notifications (APNs configuration) | Not done | 3-5 days |
| In-App Purchase for subscriptions | Not done | 1-2 weeks |
| Privacy Nutrition Labels (App Store Connect) | Not done | 1 day |
| Privacy policy URL | ✅ Done | — |
| Terms of service URL | ✅ Done | — |
| App icon assets (multiple sizes) | Not done | 1-2 days (designer) |
| Marketing screenshots (6.7", 6.5", 5.5", iPad) | Not done | 2-3 days |
| App Store listing copy | Not done | 1 day |
| TestFlight beta with internal testers | Not done | 1 week setup, ongoing |
| TestFlight external beta (up to 10k users) | Not done | Ongoing once accepted |
| App Store review submission | Not done | 1-2 days to prepare |
| Apple review iteration cycles | Not done | 2-4 weeks worst case |

### 2c. Apple review specific risks for Rostr

Sports + youth apps get extra scrutiny. Areas Apple commonly flags:

1. **Age rating + content moderation** — Rostr is probably 4+ or 9+ rating. Apple may ask about user-generated content (highlight URLs, prior-stat text). Need clear moderation posture.
2. **COPPA-aware age gating** — Apple wants to see hard age verification, not just self-reported. We have grade ≥ 9 floor; should be fine but plan to defend it.
3. **In-App Purchase rule** — paid digital subscriptions MUST go through IAP (Apple takes 30%, or 15% Small Business Program). Web payment via Stripe for iOS users is technically against Apple's rules; the workaround (showing a web link to subscribe externally) is now allowed via the "reader app" rule but requires specific UX.
4. **Recruiting features + minor data** — the verified athlete profile / scout discovery layer will draw extra reviewer scrutiny. Have the consent flow + data classification ready to demo.
5. **Crash + reliability** — Apple rejects apps that crash on first launch or have obvious UX bugs. Capacitor + a clean native wrapper means fewer crash vectors but TestFlight beta is essential.

**Realistic Apple review expectation:** first submission will likely come back with 1-3 issues to fix. Plan for 2-3 review cycles. Each cycle is 24-72 hours of Apple review time + 1-3 days to fix on our end.

---

## 3. Recommended sequence (the 8-13 week plan)

This assumes one engineer (or AI-assisted equivalent) working primarily on this, with JC making decisions on the fly. Adjust if effort splits across people.

### Phase 1 — Foundation (Weeks 1-2)

**Goal:** the existing Next.js app is wrapped as a native iOS app that builds + runs in TestFlight.

**Tasks:**
- Register Apple Developer account ($99)
- Install Capacitor + iOS platform into rostr-next
- Configure Capacitor (`capacitor.config.ts`)
- Generate icon set + splash screen assets
- First Xcode build, deploy to TestFlight internal
- Internal-team smoke test on real iPhone (JC + 1-2 testers)
- Fix any layout/safe-area regressions discovered

**Outcome:** an installable Rostr iOS app via TestFlight that has feature parity with web.

**Risk:** Capacitor edge cases on specific Next.js features (server-side rendering on a static-export config, push API). Mitigation: prototype at week 1, decide whether to adjust Next.js config.

### Phase 2 — Native integrations (Weeks 3-4)

**Goal:** the iOS app uses real native features Apple expects.

**Tasks:**
- Sign in with Apple (Capacitor plugin, server-side token exchange with Supabase)
- Push notifications via APNs (Capacitor Push plugin, Supabase Edge Function for sending)
- Haptics on key interactions (already partially done in PWA polish)
- iOS-native share sheets for game viewer + player profile links
- Decide: ship without Stripe IAP for v1 (free trial + email-to-pay flow) OR build full IAP

**Outcome:** Rostr iOS app feels native + has push notifications.

**Decision point at end of Phase 2:** ship as free-trial-only for App Store v1, defer IAP until v1.1?

### Phase 3 — Feature-flag activation + email pipeline (Weeks 5-6)

**Goal:** decide what flag-gated work ships in App Store v1; wire email pipeline so consent flow is real.

**Tasks:**
- Resend or SendGrid integration for transactional email (consent links, breach notifications, password resets)
- Flip on `NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES` flag in production (player profile + verification + GameChanger import become live)
- Flip on `NEXT_PUBLIC_ENABLE_SCOUT_MODE` if + only if the legal posture supports it (geo-block on CA + NY is in place)
- Stripe checkout integration for the three pricing tiers (web-side; iOS users sees "subscribe at rostr.app" if no IAP yet)
- Announce flag-on internally to current pilot users (30-day grace period)

**Outcome:** Production has the verified-data layer + scout features visible to users (in non-restricted states).

**Risk:** activating flags reveals bugs in the flag-gated work that weren't caught in dev. Mitigation: ship behind a soft-launch flag controlled by user email allowlist for the first week.

### Phase 4 — Smoke tests + observability (Week 7)

**Goal:** automated guardrails so we know if production breaks.

**Tasks:**
- Smoke test suite: auth flow, score entry, public profile gating, rankings computation, consent flow, scout discovery
- CI configured to run smoke tests on every commit, blocking merge to main
- PostHog or Sentry integration for error monitoring + product analytics
- Rate limiting on /api/ical, /p/[handle], /scout/discover endpoints (Vercel edge or Upstash)
- Backup verification — test a Supabase point-in-time restore against staging

**Outcome:** automated detection of regressions before users hit them.

### Phase 5 — App Store submission prep (Week 8)

**Goal:** everything Apple needs is ready.

**Tasks:**
- Marketing screenshots for all required device sizes (designer, 2-3 days)
- App Store listing copy (title, subtitle, description, keywords)
- Privacy Nutrition Labels filled out in App Store Connect
- Age rating questionnaire completed
- Demo account credentials prepared for Apple reviewers
- Promotional artwork (App Preview video optional but useful)
- Final TestFlight beta with 5-10 external users (real coaches if possible)

**Outcome:** ready to submit.

### Phase 6 — Submission + review iteration (Weeks 9-12)

**Goal:** the app is approved + listed.

**Tasks:**
- Submit to App Store
- Apple review: 24-72 hours typically
- Address rejections: most likely reasons are missing reviewer credentials, IAP-vs-web subscription confusion, or content moderation questions. Each rejection is 1-3 days to fix + resubmit.
- Plan for 2-3 review cycles

**Outcome:** Rostr is live on the App Store.

### Phase 7 — Post-launch hardening (Week 13+)

**Goal:** be ready for the first 100 paying users without surprises.

**Tasks:**
- Cyber liability + E&O insurance ($1500-4000/yr)
- First retained-counsel engagement when revenue justifies (target $5k MRR)
- NCAA recruiting calendar gates if scout flag is on
- Bulk parent SMS/email when coaches ask for it (they will)
- State leaderboards as the distribution flywheel

---

## 4. Resource estimate

| Resource | Cost / time | When |
|---|---|---|
| Apple Developer account | $99/year | Phase 1 |
| App icon + screenshot designer | $300-800 (one-off) | Phase 5 |
| Email provider (Resend or SendGrid) | $0-30/mo at pilot scale | Phase 3 |
| Stripe processing | 2.9% + $0.30 per txn | Phase 3 |
| PostHog analytics | $0 free tier (1M events/mo) | Phase 4 |
| Sentry error monitoring (optional) | $26/mo team plan | Phase 4 |
| Upstash Redis for rate limiting (optional) | $5-10/mo | Phase 4 |
| Cyber + E&O insurance | $1500-4000/year | Phase 7 |
| Outside privacy counsel (deferred) | $5-15k for written review | Triggered at first paid customer / $5k MRR |

**Engineering effort:** roughly 320-400 focused hours across 8-13 weeks. If JC is doing this solo while running WPSG, allocate calendar accordingly — likely closer to 16-20 weeks.

---

## 5. Decision points (PM should surface to JC)

These are the calls that need to be made, with reasoning:

### 5a. App Store packaging strategy

**Decision:** Capacitor (Option A) vs React Native rewrite (Option B).
**Recommendation:** Capacitor. Faster, same codebase ships everywhere, sufficient UX quality.
**Trigger to revisit:** if the WebView feel becomes a meaningful churn driver post-launch.

### 5b. IAP for v1 or defer

**Decision:** Build In-App Purchase scaffolding for App Store v1 OR ship as free-trial-only with web-side payment.
**Recommendation:** **Defer IAP to v1.1.** Free trial in app, "subscribe on web" link to Stripe checkout. Apple's "reader app" rules allow this if implemented correctly. Saves 1-2 weeks of engineering on v1.
**Trigger to revisit:** when the friction of the web-subscribe handoff actually costs conversions.

### 5c. Which flag-gated features ship in v1

**Decision:** which of the 8 flag-gated sprints get turned on in production.
**Recommendation:** Ship `NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES` (player profile + verification + import) WITH App Store v1. Keep `NEXT_PUBLIC_ENABLE_SCOUT_MODE` OFF until first 10 programs are using verification flow naturally. Ship Scout v2 as a separate launch event 60-90 days post-App-Store.
**Reasoning:** verified-data layer needs real coach usage to mature; scout discovery needs a pool of verified athletes to be useful.

### 5d. Email provider

**Decision:** Resend, SendGrid, or Postmark.
**Recommendation:** **Resend.** Cleanest DX for Next.js, $0 free tier covers 3k emails/month, no contract.
**Trigger to revisit:** when transactional volume crosses 50k/month, evaluate SendGrid for deliverability.

### 5e. PostHog vs Sentry vs roll-our-own

**Decision:** which observability tool ships.
**Recommendation:** **PostHog.** Free tier covers 1M events/month, does both error tracking AND product analytics, single integration. Sentry is better for pure error tracking but adds another vendor.

### 5f. Privacy counsel engagement timing

**Decision:** when does retained outside counsel start.
**Locked (per D53):** at first paid customer OR $5k MRR OR any regulator/district inquiry, whichever first. Until then, AI-assisted compliance review is the operating mode.

### 5g. Deploying flag-gated work to main

**Decision:** when does the dev branch (27 commits ahead) merge to main.
**Recommendation:** merge to main at start of Phase 3 (feature-flag activation). Until then, the dev branch is the safety valve — work continues without affecting production. Once main has the flag-gated code with flags OFF, production behavior is unchanged but the deployment is unified.
**Risk:** the longer the branch sits, the more merge conflicts accumulate if any main-side commits happen. Mitigation: rebase the branch weekly, keep main moving forward only with reviewed work.

---

## 6. Critical-path summary (what blocks what)

```
Week 1:  Apple Developer account [$99]
            ↓
Week 1:  Capacitor wrapper       ←  blocks  →  iOS-specific UX testing
            ↓                                       ↓
Week 2:  TestFlight internal     ←  blocks  →  Phase 2 native integrations
            ↓
Week 3:  Push, Sign in with Apple, native polish
            ↓
Week 4:  Decision: IAP for v1 or defer (recommended: defer)
            ↓
Week 5:  Email pipeline (Resend) ←  blocks  →  Real consent flow
            ↓
Week 5:  Stripe checkout (web)   ←  blocks  →  Revenue capture
            ↓
Week 6:  Flag activation (advanced player profiles)
            ↓
Week 7:  Smoke tests + observability
            ↓
Week 8:  App Store assets + listing
            ↓
Week 9-12: Submit + iterate with Apple reviewers
            ↓
Week 13: Approved + live on App Store
```

**Single biggest acceleration lever:** focused, sustained engineering hours. The work itself isn't blocked by anything external. If JC can carve 20-25 hours/week on Rostr, the 8-13 week timeline holds. If it's 5-10 hours/week alongside WPSG, expect 16-20 weeks.

**Single biggest risk:** Apple review iteration cycles. We can plan for 2-3 cycles but if Apple flags the recruiting features as a problem, that's potentially a fundamental redesign. Mitigation: have the consent flow + age gating polished BEFORE submission so reviewers see the careful posture.

---

## 7. What's true today (snapshot for the PM file)

- **Codebase health:** ✅ Production builds + typechecks green. 38 migrations applied. Three-layer enforcement on verified-data integrity. No known critical bugs.
- **Compliance posture:** ✅ COPPA age floor + SOPIPA geo-block + parental consent flow + role enforcement. AI-reviewed; outside counsel engagement deferred.
- **Branch state:** 27 commits ahead of main. All flag-gated. Merging to main + flipping flags is a 1-day operation when ready.
- **What's missing for App Store:** native packaging (Capacitor), Apple-specific integrations (Sign in with Apple, push, IAP-or-web-subscribe), marketing assets, App Store listing.
- **What's missing for revenue:** Stripe integration. Pricing page is informational only.
- **What's missing for paying customers:** email send for the consent flow (otherwise coaches can't onboard real parents at scale).

---

## 8. Recommended next conversation with the PM

Three questions to anchor the next planning session:

1. **What's the target App Store launch date?** If "ASAP," we plan for 8-week aggressive path. If "Q1 2026 or later," we add buffer for proper TestFlight beta.
2. **What's the engineering capacity?** Solo founder + AI? Solo founder + contractor? Different timelines apply.
3. **Are we shipping Scout features in App Store v1?** This is the highest-leverage product decision. Recommendation: NO — keep Scout flag OFF, ship team OS + verified profiles only, add Scout in v1.1 60-90 days later when there's a verified-data pool worth searching.

The build infrastructure is genuinely strong. The product gap to "downloadable on the App Store" is real but bounded — there's no fundamental rewrite required. It's 8-13 focused weeks of execution.
