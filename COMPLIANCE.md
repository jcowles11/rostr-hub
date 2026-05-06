# Rostr — Compliance Reference

**Last updated:** 2026-05-06 (post counsel review fixes)
**Status:** scaffolding + counsel-review remediations shipped; outside-counsel sign-off + outstanding contractual items remaining
**Audience:** privacy lawyer, school district DPOs, Rostr engineering

This document is the lawyer-reviewable surface for Rostr's data
collection, consent, and access-control practices. It is generated
from code (`rostr-next/src/lib/compliance/data-classification.ts`)
plus narrative descriptions of the consent flow, audit trail, and
geographic + age scoping. When the lawyer's redlines come back, they
translate to specific code changes — this doc and the code stay in
lockstep.

> **Disclaimer.** This document and the implementation it describes
> were drafted by Rostr engineering. Outside privacy counsel review
> and a signed legal opinion are required before relying on any of it
> in production with paying customers. Specific contractual items
> (DPAs with subprocessors, school district DPA template, cyber
> insurance) are tracked in §13 and require legal procurement.

---

## 0. Operating models

Rostr operates in three distinct legal regimes depending on the
customer relationship. Compliance posture differs across them and
this section is the source of truth for which one applies.

| Mode | When it applies | Primary law | Consent posture |
|---|---|---|---|
| **A. School-affiliated, FERPA-covered** | Rostr signed a DPA with a public school district; coach acts as district employee using Rostr in their capacity as school staff | FERPA + state student-data laws | "School official" exception covers in-scope ed use; **separate consent required for any recruiting / scout activity** |
| **B. Coach-as-individual, club program** | A private club coach uses Rostr; no school relationship; players are minors | COPPA (under-13 floor only), state UDAP laws, general privacy torts | Affirmative parental consent required for under-18 public exposure; under-13 not collected (see §2) |
| **C. Adult athletes (post-graduate, college, etc.)** | Player is 18+ and self-onboarded | CCPA / CPRA, state consumer privacy | Direct consumer consent; no parental layer |

**At launch, virtually every Rostr user is Mode B.** Strategic ambition
(Mode A school district contracts) is acknowledged but not the
near-term focus — the FERPA "school official" exception requires DPAs
that are not yet drafted.

---

## 1. What Rostr collects

Rostr is a sports team operating system used by high-school baseball
coaches. Data collection is driven by coach-side workflows; players
and parents see only what coaches enter, plus what athletes
themselves opt into via the personal profile editor.

### 1a. Player data fields

The full inventory lives in `rostr-next/src/lib/compliance/data-classification.ts`.
Every field has a sensitivity tier:

| Tier | Meaning | Examples |
|---|---|---|
| `public` | Renderable on /p/<handle> when profile_public is on AND consent in place for minors. Yearbook-level info. | first_name, last_name, current grade, positions, jersey number, bats, throws |
| `consent-gated` | Renderable publicly only when active parental consent covers the right scope. | GPA, SAT/ACT, intended college level, verified game stats, verified highlight clips, profile photo, prior-season stats |
| `contact-gated` | Renderable only when consent for `recruiter_outreach` AND the `show_contact_info` flag are both on. | email, phone, social handles |
| `program-only` | Visible to coaches in the player's program. NEVER on a public surface. | coach evaluation notes, internal player flags, roster level |
| `pii-restricted` | Highest tier. Visible only to head coach + admin + the player. | (currently unused — health and emergency-contact fields removed in migration 40) |

### 1b. What we explicitly do NOT collect

- **Social Security numbers.**
- **Full date of birth.** We collect *birth year only*, optional, used solely for under-18 determination.
- **Health information / medical history.** Medical-notes field was removed in migration 40 per counsel guidance — IL SOPPA, NY Ed Law 2-d, and similar laws restrict ed-tech health-info collection.
- **Emergency contact information.** Removed in migration 40. Schools and coaches must use other channels.
- **Financial information from athletes or parents.** Payments are processed by Stripe via tokenized flows; no card data touches Rostr.
- **Biometric data.** No facial recognition, no biometric profiling. Photos uploaded by athletes are treated as URLs; we do not process them for identity inference.
- **Government-issued IDs of any kind.**
- **GPS / precise location data.** We strip EXIF from any uploaded media (planned, not yet enforced — flagged in §13).

### 1c. Coach + admin data

Coaches sign up with email + password (Supabase Auth). The `coaches`
table records: user_id (from Supabase), program_id, full_name, role
(`head_coach` or `assistant_coach`). No additional PII.

---

## 2. Age floor + COPPA posture

**Rostr does not knowingly collect or process data on users under 13.**

This is enforced at three layers:

1. **Database.** `players_grade_age_floor` CHECK constraint
   (migration 40) requires `grade IS NULL OR grade >= 9` on new
   inserts. Grade 9 = high school freshman = presumed age 14.
2. **Application.** `assertGradeMeetsAgeFloor()` in
   `lib/compliance/age-gate.ts` is called from the GameChanger CSV
   importer (and any future bulk-import path); future coach-side
   add-player flows will call the same helper.
3. **UI.** Grade pickers default to grade 9 minimum.

The decision is operational, not aspirational: COPPA's verifiable
parental consent (VPC) requirements (16 CFR 312.5(b)) require a
method beyond plain email verification — Email Plus (delayed second
confirmation), credit card check, or government-ID match. Rostr's
current consent infrastructure is email-only, which is **not
COPPA-VPC-compliant for under-13 users**. The age floor avoids the
problem.

If we ever decide to support under-13, the floor lifts AND we add
Email Plus or Stripe-card-token VPC. Until then: hard floor.

For 13-17 year olds (presumed minors), Rostr requires affirmative
parental consent before any public exposure. See §3.

For 18+ adults, self-consent applies. See `getActiveConsentForPlayer`
+ `isPlayerPresumedMinor` in `lib/compliance/consent.ts` for the
runtime logic.

---

## 3. Parental consent architecture

### 3a. The consent record

Migration 39 added the `parental_consent` table. Schema:

```
parental_consent
  id                  uuid PK
  player_id           uuid (FK → players)
  parent_email        text
  parent_name         text
  consent_scope       text[]   -- granular array
  consent_method      text     -- 'email_verification' (v1)
  consent_token       text     -- single-use, cleared on grant
  granted_at          timestamptz
  revoked_at          timestamptz
  revoked_reason      text
  ip_address          inet     -- forensic
  user_agent          text     -- forensic
  created_at          timestamptz
  updated_at          timestamptz
```

Consent rows are **soft-revoked**, never hard-deleted. The audit
trail must remain intact for legal defense in the event of a dispute.
Retention: see §8.

### 3b. Consent scopes

Four independent scopes, each grantable separately:

- `public_profile` — render `/p/<handle>` at all
- `verified_metrics_external` — show coach-verified game stats / measurables / highlights publicly
- `scout_discovery` — appear in `/scout/discover` search results (further geo-restricted; see §6)
- `recruiter_outreach` — recruiters can DM the athlete

A parent who grants `public_profile` only gets the basic profile
shell visible. Stats, contacts, scout-search appearance each require
their own scope. Granular consent aligns with COPPA/CCPA preference
patterns and gives the parent meaningful choice.

### 3c. Direct-notice content (16 CFR 312.4(c))

The `/consent/[token]` page presents the seven required elements of
a COPPA direct notice (kept current even though we don't presently
serve under-13 users — same UI defensible across age ranges + states):

1. Operator name + contact info (Rostr, privacy@rostr.app)
2. Categories of information collected (enumerated)
3. How information is used and disclosed
4. That parental consent is required
5. Methods to grant consent (the form + email + coach contact)
6. Right to review, delete, revoke
7. Link to full privacy policy

### 3d. Grant flow

1. Coach adds player to roster.
2. Coach clicks "Send consent request" with parent email + name.
3. Server creates a pending `parental_consent` row with one-time token.
4. Parent receives email with `/consent/<token>` link (email send
   pending integration — coach can copy/paste link in the meantime).
5. Parent lands on the consent page, reviews direct notice, makes
   per-scope checkbox selections, types name to confirm, submits.
6. Server records `granted_at`, `consent_scope`, IP, UA. Token cleared.
7. Public surfaces re-evaluate consent on the next request — no caching.

### 3e. Revocation flow

Parent can revoke at any time by:
- Replying to any Rostr email (routes to `privacy@rostr.app`)
- Contacting the coach directly (coach has a "Revoke consent" action
  in `/app/roster/[id]/reported`)
- Filing a takedown via the `/legal/data-rights` flow

Revocation soft-marks `revoked_at` with optional `revoked_reason`.
The `active_parental_consent` view filters out revoked rows; public
surfaces stop rendering the affected data on the next request.

### 3f. Minor determination

A player is presumed a minor if:
- `birth_year` is set AND `(current_year - birth_year) < 18`, OR
- `birth_year` is unset AND `grade < 12`

The grade-based fallback is conservative — treats every 9th-12th
grader who hasn't provided birth year as a presumed minor. The
function `player_is_presumed_minor(player_id)` (Postgres) is the
single source of truth.

---

## 4. Public exposure gates

The `/p/<handle>` page is the sole public-facing surface that exposes
per-player data to anonymous viewers. It enforces a **four-layer gate**:

1. **Profile slug lookup.** If no row → 404 (no leak).
2. **`profile_public = true` flag.** Filtered at the SQL view layer
   (`player_search`) AND at the row's RLS SELECT policy.
3. **Minor consent gate.** If the player is presumed minor and no
   active consent record covers `public_profile` → 404
   (`canRenderPublicProfile()` in `lib/compliance/consent.ts`).
4. **Audit log.** Every successful render writes a `data_access_log`
   row recording the access type. Powers parent transparency reports.

The gate is intentionally fail-closed and uses 404 (not 403) so the
existence of a private profile is never disclosed.

### 4a. Per-field filtering

`filterFieldsForPublic(record, activeScopes)` in the data-classification
module strips fields the active consent doesn't cover. Adding a new
player field without registering it = automatic exclusion from
public output (fail-safe).

---

## 5. Role-based access (server-side)

Migration 39 + `lib/permissions/role-matrix.ts` together define the
permission model:

- **head_coach** — full power (verify/unverify, release players, edit
  past scores, configure program, invite/remove coaches, process
  takedowns, import roster).
- **assistant_coach** — additive only (add players, enter scores,
  verify highlights/prior-stats). Cannot release, cannot edit past
  scores, cannot delete, cannot import roster.
- Future roles (evaluator, player, parent, scout, admin) declared but
  not yet schema-backed.

Enforcement happens at three layers:

1. **UI** — buttons/links don't render for users who lack the permission.
2. **App layer** — `requirePermission()` server helper throws
   `PermissionDeniedError` before any sensitive mutation.
3. **DB layer** — RLS policies on `tryout_scores` (UPDATE/DELETE),
   `players` (DELETE), and `player_highlights` (via the migration 36
   trigger) enforce role separation even if the UI + app layer are
   bypassed.

---

## 6. Geographic restrictions (CA + NY scout features)

### 6a. The restriction

The scout / recruiter feature surface — `/scout/setup`, `/scout/discover`,
and the underlying `searchPlayersForScout()` service — is **geo-blocked
in California and New York**. The team OS (roster, practice, tryouts,
scoring, schedules) is unaffected and continues to work in all states.

### 6b. Why

- **California (SOPIPA, Cal. Bus. & Prof. Code §22584).** Prohibits
  ed-tech operators from amassing student profiles for non-K-12
  purposes. Our scout/recruiter feature is exactly that. Lifting the
  block requires either (a) restructuring the feature to be a
  separate consumer service the family signs up for outside the
  school context, or (b) declining the SOPIPA designation by
  positioning Rostr's marketing away from K-12 schools. Both are
  deferred to future product/legal work.
- **New York (Education Law 2-d / Part 121).** Imposes Bill of Rights
  posting requirements, mandatory DPA terms with each school district,
  designated Data Protection Officer, encryption standards, and
  7-day breach notification. The infrastructure to meet all of these
  isn't yet in place.

### 6c. How it's enforced

Defense in depth — three independent layers:

1. **Edge middleware** (`rostr-next/src/middleware.ts`) — reads
   `x-vercel-ip-country-region` header. If region is CA or NY AND
   path is `/scout/setup` or `/scout/discover/*` → redirect to
   `/scout/unavailable`.
2. **Application service** (`lib/services/scout-signal.ts`) —
   `searchPlayersForScout()` filters out players whose program's
   `operating_state` is CA or NY. Even if a scout from a permitted
   state runs a search, CA + NY players don't appear.
3. **SQL view** (`scout_eligible_player_search`, migration 40) —
   only returns rows from programs whose `operating_state` is NOT
   in (CA, NY). Mounted as the data source for any future
   per-program scout aggregations.

### 6d. Coach onboarding capture

Programs gain an `operating_state` column in migration 40. Head
coaches set this during onboarding. Programs without an
operating_state are conservatively NOT excluded (matching `IS NULL`
falls outside the (CA, NY) IN-list); a future iteration can require
the field at signup.

---

## 7. NCAA recruiting compliance

The `recruiter_outreach` consent scope enables college coaches to
DM athletes through Rostr. NCAA Bylaw 13 governs that communication
and Rostr is exposed as an enabler if a college coach uses our
platform during a recruiting dead period.

Mitigations planned (not yet built):

- Recruiting-calendar gates on the DM action (block sends to under-15s,
  block sends during sport-specific dead periods, gate after-Sept-1-of-junior-year)
- Compliance warnings + audit-trail per DM (timestamp, sender role,
  recipient eligibility) — useful to college compliance officers
- Coach-side filter that hides DM action when ineligible

For now, the DM action is itself behind the `NEXT_PUBLIC_ENABLE_SCOUT_MODE`
flag. When that flag flips on, the calendar gates ship simultaneously.

---

## 8. Audit trail + parent transparency

### 8a. data_access_log

Every external view of player data records:

- `player_id`, `accessed_at`
- `access_type` — public_profile_view / scout_search_appearance /
  recruiter_dm / export / other
- `viewer_user_id` (if authenticated), `viewer_ip`, `viewer_user_agent`
- `context` JSONB for source-specific data

Parents and coaches can query who accessed what when. Powers
transparency reports.

### 8b. takedown_request

Parent-initiated removal flow. Hybrid model:

- On submit: visibility flags cut immediately (`status = 'auto_visibility_off'`).
- Deeper data deletion requires admin review (`status = 'admin_review'` →
  `'completed'`).
- Audit row never deleted; tracks who requested + when + reason.

---

## 9. Subprocessors + sub-subprocessors

| Service | What it does | Sub-subprocessors | Region |
|---|---|---|---|
| Supabase | Postgres + Auth + Storage + Realtime | AWS (compute, storage), Cloudflare (CDN) | US East primary; AWS multi-AZ |
| Vercel | Hosting + Edge | AWS (compute), Cloudflare (CDN) | US (multi-region) |
| Anthropic | AI Assistant Coach + practice plan generation | AWS (compute, storage), Google Cloud (some services) | US |
| GitHub | Source repository (no production data) | AWS, Microsoft Azure | US |

When email + payments integrate (deferred):
| Email TBD (Resend / SendGrid) | Transactional + consent emails | AWS | US |
| Stripe | Payment processing | AWS | US |

DPAs with each direct subprocessor are required before launch.
Status:
- Supabase: standard DPA available, sign-off pending
- Vercel: standard DPA available, sign-off pending
- Anthropic: commercial DPA available, sign-off pending — confirm
  in writing that Rostr's API inputs are NOT used for training
- GitHub: standard DPA in place via account terms

---

## 10. Retention

| Data class | Retention default |
|---|---|
| Operational (jersey, position, schedule, roster) | 2 years after `released_at` is set |
| Verified game stats / measurables | 7 years after the player's last activity in any program, or until deletion is requested. Indefinite retention requires explicit adult-athlete (18+) opt-in. |
| Verified highlight clips | 5 years after release |
| Self-reported prior-season stats | 5 years after release |
| Contact info | 1 year after release |
| Coach evaluation notes | 5 years after release |
| Consent records | 7 years after the player's last activity OR after revocation, whichever is later. Anonymized for retention beyond. |
| Data access log | 2 years rolling |
| Takedown requests | Indefinite (audit trail) |

Retention windows are set in `data-classification.ts`. Hard
enforcement (automated cleanup job) is not yet built — manual
deletion on request in v1, with verifiable proof per request.

---

## 11. Data subject rights + SLAs

The `/legal/data-rights` page is the public-facing surface for these
rights. SLAs we commit to:

| Right | SLA | Notes |
|---|---|---|
| Access (request a copy) | 45 days from verified request | Delivered as JSON + human-readable PDF |
| Correction | 45 days | Coach-verified historical records can't be modified retroactively but disputes are noted |
| Deletion | 45 days for visibility cut, 90 days for full chain (subprocessor flush) | Audit-trail records retained per legal hold |
| Portability | 45 days | JSON export |
| Revocation of consent | < 5 minutes (visibility cut effective on next request) | Soft-revocation; audit row retained |
| Opt out of automated decision-making | On request | Excludes user data from Scout Signal + AI features |

Requests routed via `privacy@rostr.app` (will move to a portal once
volume justifies).

---

## 12. Breach response

Internal target: detect-to-decision in 24 hours; decision-to-notification
in 48 hours.

External SLAs we commit to (whichever is shortest applies):

| Jurisdiction | Notification SLA | To whom |
|---|---|---|
| Federal (FTC trade-affected) | "Reasonable" — practical <30 days | If material |
| California (CCPA) | "Most expedient time possible" | Affected individuals + AG if 500+ residents |
| New York (Ed Law 2-d) | 7 calendar days | Each affected school district + affected individuals |
| Illinois (PIPA) | <30 days | Affected residents + AG if 500+ |
| Default for all US states | 30-60 days | Affected individuals |
| GDPR (if EU expansion ever happens) | 72 hours | Supervisory authority + individuals if high risk |

Tabletop the breach response quarterly. Incident commander = JC
(rotating to security lead when hired).

---

## 13. Outstanding before launch (legal procurement, not engineering)

These items require contracting / external review and cannot be
shipped from the codebase:

1. **Outside privacy counsel review.** This document + the consent
   flow + the legal pages should be reviewed by a US ed-tech privacy
   attorney. Estimated 8-15 hours of attorney time; budget $4-8k.
2. **Subprocessor DPAs signed.** Supabase, Vercel, Anthropic. Each
   has a standard form; the signing is procedural.
3. **Cyber liability + E&O insurance.** Coverage limit reflecting
   the breach-impact multiplier of minor data (5-10x base limits).
4. **School district DPA template.** When/if Mode A school district
   contracts come into scope, we need a template DPA. Defer until
   the first district customer is in active discussion.
5. **Texas SB 820 / Florida CS-HB 1473 assessment.** Newer state
   laws; assess before accepting customers in those states.
6. **EXIF stripping at upload time.** When media uploads land
   (currently URL-only), strip EXIF / GPS data from photos before
   storing or rendering.
7. **NCAA recruiting calendar gates** (see §7) when scout flag flips on.
8. **Anthropic prompt sanitization.** Strip player names from prompts
   sent to Claude API; replace with role tokens.

---

## 14. Open questions for outside counsel

1. **Verifiable parental consent under COPPA (under-13).** Confirm
   email-only is not VPC-compliant; confirm the hard age floor at
   grade 9 is a defensible alternative posture.
2. **FERPA "school official" framework.** When we sign the first
   district DPA, confirm the recruiting features must be
   contractually carved out (i.e., the district is not consenting
   to commercial recruiting use of student data via the DPA alone).
3. **State-by-state student-data law assessment.** California
   SOPIPA (handled via geo-block), New York Ed Law 2-d (handled via
   geo-block), Illinois SOPPA, Colorado HB 16-1423, Connecticut
   PA 16-189, Texas SB 820, Florida CS-HB 1473. Prioritize the
   first two; add states as they come into scope.
4. **NCAA Bylaw 13 exposure.** Confirm Rostr's secondary-liability
   posture for college-coach use of `recruiter_outreach` during
   prohibited windows. May need indemnification clause in scout
   tier terms.
5. **Photo + likeness rights.** State-by-state; we plan to add a
   separate photo-release consent scope. Confirm the granularity
   is sufficient.
6. **Right-to-deletion mechanics for coach-verified historical
   records.** Confirm the dispute-noted-but-not-modified posture
   for coach-recorded measurements is defensible.
7. **Marketing-vs-consent alignment review.** The `/pricing` page
   markets "verified athlete profiles seen by college recruiters."
   Confirm that text aligns with the consent scopes — no scope
   should appear less restrictive in marketing than in the form.
8. **Retention of consent records past relationship end.** 7-year
   default is our SoL hedge; confirm sufficient.
9. **International users.** Currently US-only. Geo-block at signup
   not yet implemented; rely on the US-resident click-through in
   the terms.
10. **Insurance coverage limits.** Recommend cyber + E&O combined
    $5M-$10M for an early-stage minor-data platform.

---

## 15. Documents that go alongside this one

- `/legal/privacy/page.tsx` — public-facing privacy policy (lawyer
  reviews the prose; this doc reviews the actual data practices)
- `/legal/terms/page.tsx` — public-facing terms of service
- `/legal/data-rights/page.tsx` — public-facing data subject rights flow
- `/consent/[token]/page.tsx` — parental consent direct-notice page
- `ROSTR_NORTH_STAR.md` — strategic context (why we collect what we collect)
- `LAUNCH_READINESS.md` — pilot launch rubric
- `rostr-next/src/lib/compliance/data-classification.ts` — authoritative field registry
- `rostr-next/src/lib/compliance/age-gate.ts` — under-13 hard floor enforcement
- `rostr-next/src/lib/compliance/consent.ts` — consent server helpers
- `rostr-next/src/lib/permissions/role-matrix.ts` — permission model
- `rostr-next/src/middleware.ts` — edge geo-block
- `supabase/migrations/20260315000039_*.sql` — privacy + consent + role enforcement
- `supabase/migrations/20260315000040_*.sql` — counsel-review fixes (data minimization, geo metadata, age floor)
