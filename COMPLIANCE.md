# Rostr — Compliance Reference

**Last updated:** 2026-05-03 (post Issue 1+2+5 ship)
**Status:** scaffolding complete, lawyer review pending
**Audience:** privacy lawyer, school district DPOs, Rostr engineering

This document is the lawyer-reviewable surface for Rostr's data
collection, consent, and access-control practices. It is generated
from code (`src/lib/compliance/data-classification.ts`) plus
narrative descriptions of the consent flow and audit trail. When
the lawyer's redlines come back, they translate to specific code
changes — this doc and the code stay in lockstep.

---

## 1. What Rostr collects

Rostr is a sports team operating system used by high-school baseball
coaches. Data collection is driven by coach-side workflows; players
and parents see only what coaches enter, plus what athletes themselves
opt in to share via a personal profile editor.

### 1a. Player data fields

The full inventory lives in `rostr-next/src/lib/compliance/data-classification.ts`.
Every field has a sensitivity tier:

| Tier | Meaning | Examples |
|---|---|---|
| `public` | Renderable on /p/<handle> always (when profile flag is on AND consent in place for minors). Yearbook-level info. | first_name, last_name, current grade, positions, jersey number |
| `consent-gated` | Renderable publicly only when active parental consent covers the right scope. | GPA, SAT/ACT, intended college level, verified game stats, verified highlight clips, profile photo |
| `contact-gated` | Renderable only when both consent for `recruiter_outreach` AND the `show_contact_info` flag are on. | email, phone, social handles |
| `program-only` | Visible to coaches in the player's program. NEVER on public surface. | coach evaluation notes, internal player flags, roster level, medical notes |
| `pii-restricted` | Highest tier. Visible only to head coach + admin + the player. | emergency contact info |

### 1b. What we explicitly do NOT collect

- Social Security numbers
- Full date of birth (we collect *birth year only*, optional, used solely for under-18 determination)
- Financial information from athletes or parents (no payment data on athlete records; payments are processed by Stripe, separate)
- Medical history beyond optional coach-entered notes
- Government-issued IDs of any kind

### 1c. Coach + admin data

Coaches sign up with email + password (Supabase Auth). The `coaches`
table records: user_id (from Supabase), program_id, full_name, role
(`head_coach` or `assistant_coach`). No additional PII.

---

## 2. Parental consent architecture

### 2a. The consent record

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

Consent rows are **soft-revoked**, never hard-deleted. The audit trail
must remain intact for legal defense in the event of a dispute.

### 2b. Consent scopes

Four independent scopes, each grantable separately:

- `public_profile` — render `/p/<handle>` at all
- `verified_metrics_external` — show coach-verified data publicly
- `scout_discovery` — appear in scout search results
- `recruiter_outreach` — recruiters can DM the athlete

A parent who grants `public_profile` only gets the basic profile shell
visible. They have to additionally grant `verified_metrics_external`
to expose stats, etc. This is the granular-consent design recommended
by FTC COPPA guidance.

### 2c. Grant flow

1. Coach adds player to roster.
2. Coach clicks "Send consent request" and provides parent email +
   parent name.
3. Server creates a `parental_consent` row with a one-time token, no
   `granted_at`. (`issueParentalConsentRequest()` in
   `lib/compliance/consent.ts`.)
4. Parent receives email with link to `/consent/<token>` (email send
   is deferred to next iteration; coach can copy/paste link for now).
5. Parent lands on the consent page, sees plain-English explanation of
   what Rostr is + what they're authorizing.
6. Parent affirmatively checks each scope they grant + types name to
   confirm + submits.
7. Server records `granted_at`, `consent_scope`, IP, UA. Token cleared.
8. Public-facing surfaces immediately reflect the new scope grants on
   next request (no caching).

### 2d. Revocation flow

Parent can revoke at any time by:
- Replying to any Rostr email (currently routes to `privacy@rostr.app`)
- Contacting the coach directly (coach has a "Revoke consent" button
  in `/app/roster/[id]/reported`)
- Filing a takedown via `takedown_request` table

Revocation soft-marks `revoked_at` with optional `revoked_reason`.
The `active_parental_consent` view filters out revoked rows. Within
seconds, public surfaces stop rendering the affected data.

### 2e. Minor determination

A player is presumed a minor if:
- `birth_year` is set AND (current year - birth_year < 18), OR
- `birth_year` is unset AND grade < 12

The grade-based fallback is conservative — it treats a 17-year-old
senior as adult-like (consent helpful but not strictly required for
public profile basics) but treats every 9th-12th grader who hasn't
provided birth year as a presumed minor.

The function `player_is_presumed_minor(player_id)` (Postgres) is the
single source of truth. Application code calls it via
`isPlayerPresumedMinor()` in `lib/compliance/consent.ts`.

---

## 3. Public exposure gates

The `/p/<handle>` page is the sole public-facing surface that exposes
per-player data to anonymous viewers. It enforces a **four-layer gate**:

1. **Profile slug lookup.** If no row → 404 (no leak).
2. **`profile_public = true` flag.** Filtered at the SQL view layer
   (`player_search`) AND at the row's RLS SELECT policy.
3. **Minor consent gate.** If the player is presumed minor and no
   active consent record covers `public_profile` → 404. (`canRenderPublicProfile()`
   in `lib/compliance/consent.ts`.)
4. **Audit log.** Every successful render writes a `data_access_log`
   row recording the access type. Used for parent transparency reports.

The gate is intentionally fail-closed and uses 404 (not 403) so the
existence of a private profile is never disclosed.

### 3a. Per-field filtering

The `filterFieldsForPublic(record, activeScopes)` function in the
data-classification module strips fields the active consent doesn't
cover. Adding a new player field without registering it = automatic
exclusion from public output (fail-safe).

---

## 4. Role-based access (server-side)

Migration 39 + `lib/permissions/role-matrix.ts` together define the
permission model:

- **head_coach** — full power (verify/unverify, release players, edit
  past scores, configure program, invite/remove coaches, process takedowns).
- **assistant_coach** — additive only (add players, enter scores, verify
  highlights/prior-stats). Cannot release, cannot edit past scores,
  cannot delete.
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

## 5. Audit trail + parent transparency

### 5a. data_access_log

Every external view of player data records:

- `player_id`, `accessed_at`
- `access_type` — public_profile_view / scout_search_appearance /
  recruiter_dm / export / other
- `viewer_user_id` (if authenticated), `viewer_ip`, `viewer_user_agent`
- `context` JSONB for source-specific data (e.g. which search filters
  surfaced this player)

Parent + coach can query who accessed when. Powers transparency
reports.

### 5b. takedown_request

Parent-initiated removal flow. Hybrid model:

- On submit: visibility flags cut immediately (`status = 'auto_visibility_off'`).
- Deeper data deletion requires admin review (`status = 'admin_review'` →
  `'completed'`).
- Audit row never deleted; tracks who requested + when + reason.

---

## 6. Subprocessors

| Service | What it does | Where data lives |
|---|---|---|
| Supabase | Postgres + Auth + Storage | US East (AWS) |
| Vercel | Hosting + CDN | US (multi-region) |
| Anthropic | AI Assistant Coach + practice plan generation | US |
| GitHub | Source code repository | US |

(Email + payments to be added when those integrations land. Lawyer
should review the subprocessor list against any school district DPA
template.)

---

## 7. Retention

| Data class | Retention default |
|---|---|
| Operational (jersey, position, schedule) | 2 years after `released_at` is set |
| Verified game stats / measurables | Indefinite (it's the recruiting record) |
| Verified highlight clips | 5 years after release |
| Self-reported prior-season stats | 5 years after release |
| Contact info | 1 year after release |
| Coach evaluation notes | 5 years after release |
| Medical / emergency contact | 1 year after release |
| Consent records | Indefinite (audit-grade) |
| Data access log | 2 years rolling |

Retention windows are set in `data-classification.ts`. Hard enforcement
(automated cleanup job) is not yet built — manual deletion on request
in v1.

---

## 8. Open questions for the lawyer

These need legal review before launch:

1. **Verifiable parental consent method.** Email-verification is the
   v1 default; FTC's revised COPPA guidance accepts it but with
   conditions. Confirm the conditions are met by our flow.
2. **Minor threshold.** We use `grade < 12 || age < 18` (presumed-minor).
   Should this be stricter (under 13 strict COPPA) or looser?
3. **State-specific carve-outs.** California (SOPIPA, AB 1584),
   Illinois (SOPPA), New York (Education Law 2-d), Colorado (HB 16-1423),
   Texas, Connecticut. Need state-by-state assessment + any required
   DPA/contractual templates.
4. **FERPA posture.** When the school district is the customer (not
   the individual coach), the data becomes a school record under
   FERPA. We need a DPA template that designates Rostr as a
   "school official" with legitimate educational interest.
5. **Right-to-access requests.** A parent demands a full export of
   every data point on their child. We have the queries to assemble
   this; need a documented turnaround SLA.
6. **Right-to-deletion requests.** Same for permanent deletion.
   The takedown_request table handles the visibility cut; full
   deletion needs admin review process.
7. **Breach response plan.** What's the notification SLA? Who's
   notified (parents only, also the coach, also the school)?
8. **International users.** Rostr is US-only at launch. If we ever
   cross borders (Canadian or UK programs) we pick up GDPR / PIPEDA.
   Lock down US-only at signup or add geo-controls.

---

## 9. Documents that go alongside this one

- `/legal/privacy/page.tsx` — public-facing privacy policy (lawyer
  reviews the prose, this doc reviews the actual data practices)
- `/legal/terms/page.tsx` — public-facing terms of service
- `ROSTR_NORTH_STAR.md` — strategic context (why we collect what we
  collect)
- `LAUNCH_READINESS.md` — pilot launch rubric
- `rostr-next/src/lib/compliance/data-classification.ts` — the
  authoritative field registry
- `supabase/migrations/20260315000039_privacy_consent_role_enforcement.sql`
  — the schema underneath all of this
