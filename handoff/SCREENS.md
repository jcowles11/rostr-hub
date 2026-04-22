# Rostr Screen Specs

One section per screen. Read alongside the matching `designs/*.html` file. Where the mock doesn't cover a sub-screen, the spec lists it as "not yet mocked" with enough detail to scaffold the route.

---

## 1. Landing (`01_Landing.html`)

**Route:** `/`
**Audience:** high school coaches considering signup; athletes and parents who've clicked a player-profile link.

### Layout
- Full-bleed hero on `--paper` with red dashed box motif framing the headline.
- Sticky top nav: logo + 4 links (Product, For Coaches, For Athletes, Pricing) + Sign in + red primary CTA "Claim your team".
- Hero: 64–80px display headline with 1–2 words in `--red`. Subhead 18–20px ink-2. Two-button row (primary + ghost "Watch 2-min demo").
- "How it works" 3-column section: coach → athlete → recruiter, each with phone or desktop mock.
- Social proof: logos of early pilot schools (placeholder boxes).
- Product tour: 3–4 alternating screenshots with left/right copy.
- Footer: multi-column links, legal, socials.

### Interactions
- Sticky nav shrinks to 48px on scroll (hair-2 border-bottom when past hero).
- "Claim your team" opens onboarding (not yet mocked — route `/signup` → §1.1).

### 1.1 Signup + onboarding (not yet mocked)
Sketch the flow as:
1. Coach email + school selector (typeahead backed by NCES school list).
2. Verify with school email OR athletic director referral code.
3. Team setup — sport, level(s), season dates, team name.
4. Roster import (routes into Screen 03 Import wizard, pre-filled with team context).
5. Invite assistant coaches (optional, skippable).
6. Done → Coach Hub (Screen 02) with a "Welcome, let's tour" card up top.

---

## 2. Coach Hub (`02_Coach_Hub.html`)

**Route:** `/app` (default landing for authenticated coach)

### Layout (1440 design width)
- `<AppSidebar>` 220px + content.
- Content has 24px gutter padding and grid `1.6fr 1fr` main/sidebar.
- Top: `<TopBar>` with breadcrumb "Lincoln HS / Baseball / Varsity", search, "Quick add" ghost button, red "Start practice" primary.
- Main column:
  - **Hero greeting card** (paper bg, hair border, 22px padding): "Good afternoon, Coach Martinez" + today's date + weather strip.
  - **4-up StatHeroCell row in one card:** Roster size / Practices this week / Games this week / Tryouts status.
  - **Today timeline:** vertical list of today's events (practice, game, meeting) with time column.
  - **Recent activity feed:** `<FeedItem>` stream — player updated profile, new highlight uploaded, scout viewed Player X.
- Sidebar column:
  - **AI Co-coach card** (`<AICoach>`) — dark, red-glow, suggests today's practice focus based on last game.
  - **Availability panel:** count up/questionable/out + list of flagged players.
  - **Assistant coaches** online/offline.
  - **Share your team link** card with team public URL.

### Interactions
- "Start practice" → Practice Planner (Screen 06) with today's template pre-loaded.
- Clicking any StatHeroCell deep-links to the underlying screen (roster, schedule, tryouts).
- Feed items are clickable rows, navigating to the source surface.

---

## 3. Roster + Import (`03_Roster_Import.html`)

**Route:** `/app/roster` (list), `/app/roster/import` (wizard)

### 3.1 Roster list view
- `<TopBar>` with breadcrumb + search + "Import" ghost + "Add player" red primary.
- `<FilterChipRow>`: Level (All / V / JV / F) + Position + Class year + Availability + View toggle (List / Grid / By position).
- `<RosterTable>` with columns:
  1. Checkbox
  2. Player (avatar + name + handle)
  3. # (jersey)
  4. Level pill
  5. Position
  6. Class
  7. Bats / Throws (mono, `R/R`)
  8. Height / Weight (mono)
  9. Last key stat (e.g. EV max — mono with delta arrow)
  10. Availability status dot + label
  11. Profile status badge (`linked` / `pending` / `unlinked`)
  12. Row `⋯` menu
- Sticky header + 25 rows/page. Virtualized if > 100.
- Footer: "Showing 24 of 42" + last synced "2m ago" + CSV export button.

### 3.2 Bulk actions
When any row is checked, an ink strip appears above the table:
- "3 selected" count
- Buttons: Message, Assign to level, Mark available, Export, Delete
- Clear (×)

### 3.3 Player slide-over (`<PlayerSlideover>`)
Opens on row click. Full spec in COMPONENTS.md. Uses `?player=<id>` query param so a URL is shareable.

### 3.4 Import wizard
Modal overlay, 920px wide, full-height card, radius 16px.

**Steps** (via `<Stepper>`):
1. **Upload** — drop zone accepts .csv / .xlsx / GameChanger export / MaxPreps export. Detected format pill appears (`GameChanger export detected`).
2. **Map columns** — two-column grid: source column (your file) / Rostr field (select). Auto-mapped rows show green `linked` badge. 5-row data peek under each map row. "Unmapped: 3" banner at top if any required fields blank.
3. **Levels** — split into V / JV / F buckets via drag or by a "Use level column" toggle if import has one.
4. **Invite** — preview of 24 cards with checkbox; toggles "Send invite email to parents" / "Send invite SMS to players". Copy preview.
5. **Review** — "Import 24 players to Lincoln HS Baseball" + final button.

Progress bar below stepper. Back / Next at bottom-right, primary red.

---

## 4. Player Profile (`04_Player_Profile.html`)

**Route:** public `rostr.app/<handle>`; internal coach edit at `/app/players/<id>`.

### Public layout (hero down)
1. **Hero banner** (min-height 260px, aspect 3.6:1) — action shot of player OR gradient fallback. Overlays: team wordmark top-left, "Class of 2026" pill top-right.
2. **Identity band** — avatar (`xl` 128–144px) overlapping hero by 50%, name (Space Grotesk 40px), position + level + handle mono, 3 right-aligned action buttons (Share, Save, Contact coach).
3. **4-up stat hero card** — key measurables (EV max, Pop time, 60yd, GPA) with units, delta arrows, sparklines.
4. **Career exit-velo chart** — 2-line Recharts, red (self) vs sky (class avg).
5. **Season timeline** — horizontal tape of recent games/tryouts with verdict pills.
6. **Highlights grid** — 6 cards (3x2): Mux video thumbnails with play button overlay + date + opponent.
7. **Combine metrics table** — full history: date / drill / result / verified-by.
8. **Sidebar (sticky, 320px):**
   - `<ShareCard>` with public URL + handle
   - **Scout interest** — list of schools that viewed profile (coach-only variant shows names; public shows count).
   - **Team history** — Lincoln HS 2024–26, prior travel ball.
   - **Achievements** — All-conference, district HR leader, etc.
   - **Academics** — GPA, test scores, intended major, target division.
   - **Coach verification card** — "All stats verified by Coach Martinez, updated 2d ago" with grass `verified` badge.

### Interactions
- Share button opens share sheet (Copy link, X, Instagram story, Email).
- Contact coach opens mailto or in-app if logged-in recruiter.
- Logged-in coach of this team sees an "Edit" button pinning to the top; flips the page into edit mode (not yet mocked — see §4.1).

### 4.1 Coach edit view (not yet mocked)
Same layout, every editable region shows dashed hair border on hover + pencil IconButton. Inline-editable text fields for name, position, class, measurables. Stats entered here are written with a verification record (`{coach_id, timestamp}`).

---

## 5. Tryouts (`05_Tryouts.html`)

**Route:** `/app/tryouts/<tryoutId>`

### Desktop layout
- Top summary card: tryout name, date/time, level being tried out for, attendance count, "LIVE" indicator if in progress.
- 4-up `<StatHeroCell>`: Athletes evaluated / Stations active / Avg score / Complete %.
- **`<TryoutRankings>` table** — the hero component. 9 columns:
  1. Rank (with delta)
  2. Player (avatar + name)
  3. Position
  4. Throwing (EV / accuracy composite)
  5. Hitting (EV max / exit angle composite)
  6. Fielding
  7. Running (60yd)
  8. Composite score (mono, bold)
  9. Verdict pill
- A dashed divider row at the cutoff reads: "VARSITY BUBBLE · 3 above · 4 on the line · 2 below" with amber text.
- Right sidebar:
  - **Stations panel** — list of 4–6 `<StationCard>` (live card highlighted).
  - **Coach notes panel** — recent `<Note>` entries streaming in.
  - **Pace indicator** — "On track — 18min avg per player".
- Footer action bar: "Finalize roster" red primary + "Export to GameChanger" ghost.

### 5.1 Mobile tryout scoring (shown as phone mockup on desktop page)
Full-screen phone flow:
- Station selector screen.
- `<TryoutStationQueue>` — who's up next at this station.
- `<TryoutScoringScreen>` — numeric keypad, best-of-3 attempt tracker, photo/video attach.
- After save: "Next player" auto-advances the queue.

### Interactions
- Drag any row up/down to force a verdict change (drops a confirmation toast).
- Clicking verdict pill opens a 3-option radio (Keep / Bubble / Cut) with a required "why" note.
- "Finalize roster" writes the verdict batch and triggers parent/player notification flow.

---

## 6. Practice Planner (`06_Practice_Planner.html`)

**Route:** `/app/practice` (library + upcoming), `/app/practice/<id>` (editor)

### Desktop layout — editor
- Header card: practice date/time + duration + location + weather.
- Two-column main: left = timeline builder (~1fr), right = drill library (340px).
- **Left — `<PracticeTimeline>`:**
  - 4-up totals row.
  - Color-coded proportion strip.
  - Block list (`<PracticeBlock>` stack) with drag handles, inline duration edit, add-block `+` between any two blocks.
  - Field map section below showing zone assignments (`<FieldMap>`).
- **Right — drill library:**
  - Search input + filter chips (Hitting / Fielding / Pitching / Conditioning / Situational).
  - Scrollable list of `<DrillCard>` items, dragged into timeline.
  - "Saved templates" section underneath (Mon / Tues / Game-day routines).
- Sticky footer bar: "Save template" ghost + "Print coach sheet" ghost + "Start practice" red primary.

### 6.1 Mobile field-runner (phone mockup on same page)
- Currently-active block header + big red countdown.
- Now-up 2-col groups with avatar stacks.
- Coach note (quote style).
- Next-up row.
- Bottom action: + Note / Advance.

### Interactions
- Dragging a drill card into the timeline creates a block at hover position with a ghost preview.
- Timeline auto-calculates segment widths and updates totals live.
- "Start practice" writes `practice.started_at`, flips iPad/phone view into field-runner, and begins the countdown clock.

---

## 7. Screens not yet mocked

Written specs only — no HTML. Ask for pixel guidance before building any of these.

### 7.1 AD multi-team dashboard
**Route:** `/app/ad`
Grid of team cards (one per sport × level), each showing: coach name, roster size, upcoming games, profile-linked %, last activity. Filters: season, sport, level. Secondary view: compliance checklist (physicals, academics, eligibility) per team.

### 7.2 Gameday
**Route:** `/app/games/<id>`
Three sub-surfaces:
- **Lineup builder** (pre-game, desktop): drag-sort batting order, position assignments on a field diagram, bench/DH slots.
- **Dugout console** (live, iPad-optimized): inning/score header, at-bat result entry (K / BB / 1B / 2B / 3B / HR / out type), substitutions, pitch count per pitcher with red-alert threshold.
- **Post-game**: summary + export to GameChanger JSON + auto-updates player stats (with coach verification tag).

### 7.3 Parent / athlete mobile
**Route:** native app OR `/me` for web.
- Schedule this week
- Coach announcements feed
- My profile preview + edit measurables (flagged for coach verification before appearing public)
- Highlight upload (60s clips, auto-tagged with game/opponent)
- Message coach (1:1 thread)

### 7.4 Opponent scouting
**Route:** `/app/scout/<opponent_team_id>`
Reads from the network: if the opponent uses Rostr, you see their roster + recent stat trends (subject to privacy tier). If not, you see a stubbed "Request data exchange" card. Also: your own prior games against them (auto-linked via schedule).

### 7.5 College recruiter search
**Route:** `/recruit` (recruiter-seat only)
LinkedIn Recruiter analogue:
- Filters: sport, position, class year, GPA min, measurables (EV min, 60yd max), state, division target.
- Result grid of player profile cards (avatar + name + measurables summary + "viewed" state).
- Saved searches, saved prospects, outreach log.
- Outreach: in-app message routes via coach (NCAA compliance — recruiters contact coach, not athlete, for pre-junior year).

### 7.6 Messaging hub
**Route:** `/app/messages`
Split-pane: thread list (left, 320px) / thread (right). Threads can be 1:1 coach↔player, 1:1 coach↔parent, coach↔recruiter, or broadcast (coach → team / level / position group).

### 7.7 Analytics / season trends
**Route:** `/app/analytics`
Read-only dashboard of team-level charts: runs scored per game, team BA trendline, position-group measurables progression, attendance, injury days. Export PDF for end-of-season board report.

### 7.8 AI-assist surfaces
Not a distinct screen — permeates others:
- Practice planner: "Generate plan based on last game weaknesses" button in library sidebar.
- Lineup builder: "Suggest lineup vs [opponent]" using pitcher handedness + platoon splits.
- Scouting: "Summarize opponent's top 3 threats" card.
- Coach hub AI Co-coach card (§2).
All AI output is explicitly labeled with the red `ai` badge and passes through a coach-review step before being acted on.

### 7.9 Multi-sport adapters
Data model supports football, basketball, volleyball, soccer via polymorphic `sport_stats` (see DATA_MODEL.md). UI:
- Sidebar team switcher groups teams by sport.
- Tryout stations, practice drill library, and profile stat hero cells are sport-specific components selected by `team.sport`.
- Baseball is v1; adapters ship sport-by-sport.
