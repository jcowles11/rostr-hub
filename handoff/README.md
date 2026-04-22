# Rostr — Engineering Handoff

> A platform for high school coaches, athletes, and recruiters.
> Coaches run their program in Rostr. The athlete's resulting profile is scoutable by college recruiters. The network effect is real and earned, not fabricated.

---

## 0. Quick start for Claude Code

If you're Claude Code reading this package for the first time, do this in order:

1. Finish this README.
2. Read `DESIGN_TOKENS.md` — these are the colors, type, spacing, radii, and shadow values. Put them in a Tailwind config or CSS variable file before anything else.
3. Read `COMPONENTS.md` — the atomic component inventory. Use it to plan your `components/` tree.
4. Read `SCREENS.md` — per-screen layout and behavior. Read alongside the matching file in `designs/`.
5. Read `DATA_MODEL.md` — Postgres + Prisma schema.
6. Read `INTERACTIONS.md` — routing, state, flows, keyboard shortcuts.
7. Open the HTML files in `designs/` in a browser to see what you're building. **These are design references, not production code** — reproduce the visual output in the target stack using the tokens + components defined here. Do not copy their inline CSS or JS verbatim.
8. Build in the order given in §5 below. Scaffold the tokens + component library first, then Auth + roster data model, then work screen-by-screen.
9. Ask the user before inventing anything not specified. Gaps in the spec (especially the "not yet mocked" screens in `SCREENS.md` §7) should be surfaced, not guessed.

---

## 1. What's in this bundle

```
handoff/
├── README.md              ← you are here (start here, then the files below)
├── DESIGN_TOKENS.md       ← colors, type, spacing, radii, shadows (copy into your theme)
├── COMPONENTS.md          ← atomic inventory: every reusable piece
├── SCREENS.md             ← per-screen layout + behavior specs
├── DATA_MODEL.md          ← entities, relationships, API sketch
├── INTERACTIONS.md        ← flows, state, routing
└── designs/
    ├── 01_Landing.html         ← public marketing site
    ├── 02_Coach_Hub.html       ← logged-in coach desktop home
    ├── 03_Roster_Import.html   ← roster list + CSV import wizard
    ├── 04_Player_Profile.html  ← public player profile (the "scoutable" surface)
    ├── 05_Tryouts.html         ← live tryout rankings + mobile scoring flow
    └── 06_Practice_Planner.html← practice builder + mobile field-runner
```

## 2. About the design files

**These HTML files are design references, not production code.**

They are high-fidelity, pixel-accurate prototypes with final typography, color, spacing, and interaction hints. They are NOT meant to be shipped as-is — do not copy the CSS verbatim into the codebase.

Your job is to **recreate these designs in a real codebase** using modern patterns appropriate for the target stack.

## 3. Recommended stack

If no codebase exists yet, build:

- **Web app (coach/AD/recruiter):** Next.js 14 (app router) + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query + Zustand (local UI state) + Supabase or Postgres + Prisma.
- **Mobile app (coach field runner, parent/athlete, tryout scoring):** React Native (Expo) sharing types + API clients with web. Native modules only for camera + stopwatch.
- **Marketing site:** same Next.js app, `/` route, statically rendered where possible.
- **Auth:** Clerk or Supabase Auth (coaches get a team-scoped session; parents/players get a linked sub-account; colleges get a recruiter seat).
- **Realtime:** Supabase Realtime or Pusher for tryout-scoring live feed, practice field-runner sync, and gameday console.
- **File/media:** S3 + CloudFront for highlight reel uploads; process through Mux for clip playback.

## 4. Fidelity

**High fidelity.** The designs are pixel-accurate. Reproduce colors, type, spacing, and layout exactly as specified in `DESIGN_TOKENS.md`. Follow `COMPONENTS.md` for the component inventory. Use `SCREENS.md` for per-screen layout.

The only things you should invent are:
- Interaction polish beyond what the static HTML shows (loading shimmers, optimistic updates, error toasts — match the visual language)
- Responsive breakpoints below 1200px for desktop screens (the HTML mocks assume ≥1200px desktop); mobile mocks inside the designs show intended phone UX.
- Dark mode (not currently designed — add it later if needed; the palette has enough contrast to do so cleanly).

## 5. Build order (suggested)

1. **Design tokens + component library** — Tailwind theme + shadcn/ui overrides + the custom pieces in `COMPONENTS.md`.
2. **Auth + org/team/roster data model** — nothing ships without a coach being able to create a team and have players in it.
3. **Roster + CSV import** — the first thing a pilot coach does (Screen 03).
4. **Player profile (read-only public page)** — the shareable artifact; needed for virality (Screen 04).
5. **Coach hub** — the daily home base (Screen 02).
6. **Practice planner** — weekly-use feature (Screen 06).
7. **Tryouts** — seasonal, high-stakes flow (Screen 05).
8. **Landing page** — can ship in parallel; needed for signup funnel (Screen 01).
9. (Later) Parent/athlete mobile, AD multi-team dashboard, college recruiter search, messaging, opponent scouting, AI-assist.

## 6. Non-negotiables

- **Performance:** tryout scoring and practice field-runner MUST work offline and sync. Coaches will be at outdoor fields with no LTE.
- **Accessibility:** WCAG AA minimum. Keyboard navigation on every table. Coaches are often in their 50s–60s.
- **Data exports:** Roster CSV export must be bidirectional with GameChanger and MaxPreps formats (see `DATA_MODEL.md` § import mapping).
- **Public profile URL:** `rostr.app/<handle>` — handles must be reserved on team creation, editable once by the athlete when they claim their profile.
- **Verification trust chain:** stats/metrics on a public profile must be tagged with who verified them (coach name + date). This is the platform's moat vs. Hudl/GameChanger.

## 7. Open product questions (answer before build)

1. Pricing: freemium for coaches + paid recruiter seats? Or everything free for schools, monetize colleges? (Per founder conversations: leaning toward free-for-schools.)
2. Parent/athlete app: write access (edit profile, add highlights) or read-only?
3. Multi-sport: baseball is the hero. When do football/basketball/volleyball adapters land? (Architecture in `DATA_MODEL.md` § polymorphic `sport_stats` supports this.)
4. Who "owns" a profile when the player graduates and the coach is no longer rostered? (Proposed: profile transfers to player account; coach retains historical access to their team's archive.)

## 8. Designer notes & next screens

Designed but not yet mocked — included in `SCREENS.md` as written specs so you can scaffold routes without a visual yet:

- AD multi-team dashboard
- Onboarding / team setup wizard
- Gameday lineup builder + live in-game console (dugout iPad) + GameChanger export
- Messaging / comms hub (coach → team, coach → parents, coach → college recruiter)
- College recruiter search (LinkedIn Recruiter analogue — filter by position, measurables, class year, GPA)
- Parent/athlete mobile view
- Opponent scouting (network-effect: your games feed others' scout reports)
- Analytics / season trends
- Player profile coach edit view

Ask for HTML mocks of any of these before building if you want pixel guidance.
