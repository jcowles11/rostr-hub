# Rostr Interactions & Flows

State, routing, and the key flows the static mocks can't fully show. Read with `SCREENS.md`.

---

## Routing map

```
/                                   public landing
/signup                             onboarding
/login                              auth

/app                                coach hub (default authed)
/app/roster                         roster list
/app/roster/import                  import wizard (modal)
/app/players/:id                    player slide-over (query param `?player=...` on roster; direct URL also works)

/app/practice                       practice library + upcoming
/app/practice/:id                   editor
/app/practice/:id/run               field-runner (mobile-first layout)

/app/tryouts                        tryouts list
/app/tryouts/:id                    live rankings dashboard
/app/tryouts/:id/score?station=:sid mobile scoring (or native deep link)

/app/games/:id                      game detail
/app/games/:id/lineup               lineup builder
/app/games/:id/live                 dugout console

/app/messages                       messaging hub
/app/messages/:threadId             thread

/app/ad                             AD multi-team dashboard (role=ad)
/app/analytics                      season analytics

/recruit                            recruiter search (role=recruiter)
/recruit/prospects                  saved prospects
/recruit/messages                   outreach

/me                                 parent/athlete home
/me/profile                         edit my profile

/<handle>                           public player profile
```

---

## State management

**Server state** — TanStack Query. Cache keys: `['team', teamId]`, `['roster', teamId]`, `['player', playerId]`, `['practice', practiceId]`.

**Local UI state** — Zustand stores, scoped per feature:
- `rosterStore` — filters, selection, view mode.
- `practiceEditorStore` — draft block list with optimistic reorder.
- `tryoutLiveStore` — subscribed rankings, local pending result submissions.
- `fieldRunnerStore` — current block index, elapsed, offline queue.

**URL state** — filters, tabs, selected player. Anything a coach might want to bookmark or share.

**Persistence** — `localStorage` for last-opened team (used on cold boot), current-practice template, draft notes.

---

## Key flows

### A. First-run onboarding

1. Coach signs up (email + school typeahead).
2. Choose: **start from scratch** OR **import roster**.
3. If import, route into the wizard (§C) pre-filled with team context.
4. Tour overlay fires once on Coach Hub: 4 spotlight steps (sidebar team switcher, Start Practice button, AI Co-coach, Share your team link).
5. Tour dismisses to localStorage flag `rostr.tour.completedAt`.

### B. Coach hub → Start practice

1. From hub, click red `Start practice`.
2. If today has a scheduled practice, load it. Otherwise: "No practice scheduled today — start a freeform one?" confirm modal.
3. Route to `/app/practice/:id` editor. If freeform, generate a new practice with default 120-minute warmup block.
4. `Start practice` in editor footer → flips status to `in_progress`, sets `started_at`, opens field-runner on phone/iPad.
5. Realtime channel `practice:<id>` broadcasts block advance events to any other coach on the team.

### C. Roster import wizard (Screen 03.4)

Modal state machine:
```
upload → detect → map → levels → invite → review → importing → done
            ↑                                           ↓
            └───────────────── error ───────────────────┘
```

- **upload:** accepts csv/xlsx/gc export. Posts to `/api/import/preview` which returns detected format + parsed rows + auto-mapping hints.
- **map:** client-side grid. Changing a select updates the preview rows. Validation runs live — required fields must all be mapped; "Unmapped required" banner if not.
- **levels:** if a `level` column was mapped, auto-bucket; else show drag-to-bucket UI.
- **invite:** per-player invite toggles default to "on". Preview of SMS/email copy (editable once, applies to all).
- **review:** final diff view.
- **importing:** progress bar with row count; cancelable within first 2s.
- **done:** success state + "Go to roster" button. Toast + hub feed entry.

Errors at any step roll back. Partial imports are not allowed — atomicity first.

### D. Player profile claim

1. Player receives invite SMS/email with unique link `rostr.app/claim/<token>`.
2. Lands on a barebones claim page: "You're on Coach Martinez's Lincoln HS Baseball roster. Claim your profile?"
3. Auth (Clerk/Supabase) — email OR phone OTP.
4. `Player.user_id` is set; `claim_token` cleared; `profile_status` goes `pending` → `linked`.
5. Player lands on `/me/profile` with a "Review what's public" banner.

### E. Tryout flow

1. Coach creates tryout from Roster → "Run tryout" button (not yet mocked as a button on the mock but implied). Configures stations + attendees + level targets.
2. On tryout day, coach opens `/app/tryouts/:id` on laptop at field.
3. Station coaches open `/app/tryouts/:id/score?station=X` on their phones; station list on laptop shows them checked in.
4. As results submit, `tryoutLiveStore` merges them into rankings via realtime. Composite score recomputes; verdicts auto-suggest based on cutoff line.
5. Coach can manually drag-sort rankings to override auto-verdict. Override logs a `Note` with the reason.
6. `Finalize roster` opens confirm modal: "This notifies 12 players of their verdict and creates a new team roster. Continue?"
7. On finalize: writes verdicts, archives prior roster, sends notifications, redirects to Roster.

### F. Field-runner (mobile during practice)

1. Screen opens on current block with countdown clock.
2. Countdown runs client-side; source of truth is `started_at` + block durations.
3. `Advance` button ends current block (stamps `actual_duration_min`), advances to next, broadcasts to other coaches.
4. `+ Note` opens 60-second voice-note OR quick text on a specific player (player chip picker prepopulated with on-field group).
5. Offline: all actions queue in IndexedDB; flush on reconnect. UI shows "2 pending sync" pill when queue non-empty.

### G. Public profile view → coach contact (recruiter flow)

1. Recruiter lands on `rostr.app/<handle>` from a shared link or search.
2. Page records `ProfileView` with viewer attribution if logged in.
3. Recruiter clicks "Contact coach" → opens in-app thread pre-filled to the player's head coach (NOT the player, for pre-junior-year compliance).
4. Coach gets notification in hub + messages.
5. If player has opted in and is past July 1 of junior year: "Contact player directly" button enabled.

### H. Game end → stat verification

1. Coach opens `/app/games/:id/live` dugout console, enters plate appearances live.
2. On `Finalize game`, all game-derived stats post to `SportStat` with `source=game_log`, `verified_by=<coach_id>`.
3. Player's public profile stat tiles update with a fresh "verified 2h ago" tag.
4. Export to GameChanger happens on demand from game detail page (not required for stats — Rostr is source of truth internally).

---

## Keyboard shortcuts

Global — bind in `apps/web/src/lib/keymap.ts`:

| Key | Action |
|---|---|
| `⌘K` | Global search (navigate anywhere) |
| `⌘⇧P` | Start practice |
| `g h` | Go to hub |
| `g r` | Go to roster |
| `g p` | Go to practice |
| `g t` | Go to tryouts |
| `/` | Focus current-screen search |
| `?` | Show shortcut cheat sheet |

On Roster:
| `j / k` | Next / prev row |
| `x` | Toggle select on focused row |
| `⏎` | Open slide-over |
| `⌘⏎` | Send (in any compose field) |

On Tryouts rankings:
| `↑ / ↓` | Move focused row up/down |
| `1 / 2 / 3` | Set verdict (keep / bubble / cut) |

---

## Empty states

Every list has a designed empty state — don't ship a blank div. Pattern:
- Illustration or paper-deep block (simple, no stock art — match the paper/hair aesthetic).
- Headline in Space Grotesk 20px.
- One-line ink-3 body.
- Single primary CTA.

Required empty states:
- Roster before import
- Practice library (first-time coach)
- Tryouts before any run
- Messages inbox
- Highlights (player profile, pre-upload)
- Scout interest (public profile — shows "No scouts viewing yet. Share your profile.")

---

## Error + loading states

- **Loading:** skeleton shimmer matching the final layout (grey `--paper-deep` blocks). Never a spinner over a blank page.
- **Error:** inline hair-border card with red icon, "Something went wrong" + `retry` button + (dev only) error id.
- **Offline:** persistent amber strip pinned top of viewport on mobile field-runner. "Saving locally — will sync when reconnected." Desktop: toast on action, auto-retry.

---

## Notifications

Three channels, coach-configurable:

| Channel | Example triggers |
|---|---|
| **In-app** | Feed item, badge on nav item |
| **Email** | Daily digest, weekly summary, tryout verdicts, scout views (bundled) |
| **SMS** | Game-day reminders, practice cancellations, urgent availability |

Parent/player defaults:
- Practice schedule changes → SMS
- Coach announcement → push + email
- Verdict after tryout → SMS (the moment of truth)
- Scout view of profile → weekly email digest only

---

## Analytics events to instrument

- `signup_completed`
- `roster_imported` (+ count, source)
- `practice_started` (+ duration_planned, block_count)
- `practice_completed` (+ duration_actual, blocks_completed)
- `tryout_finalized` (+ attendee_count, verdict_distribution)
- `profile_shared` (+ destination)
- `profile_viewed` (+ viewer_role: anon/player/coach/recruiter)
- `highlight_uploaded`
- `recruiter_message_sent`

Send to PostHog or equivalent. No PII in event props.
