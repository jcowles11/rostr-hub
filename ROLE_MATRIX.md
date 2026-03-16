# Role Matrix

## Overview

Rostr serves multiple user types with different needs, priorities, and interaction patterns. This document defines each role, their core jobs, current surfaces, and implementation priorities. It is the source of truth for role-based product decisions.

---

## Coach (Head Coach / Program Admin)

### Who This Is

The head coach or program administrator who runs the sports program. They own the tryout process, make roster decisions, plan practices, manage game-day operations, and are accountable for the program's organization. This is the primary user of Rostr.

### Core Jobs To Be Done

- Run tryouts and evaluate players efficiently
- Make roster decisions based on objective and subjective data
- Manage the player roster (add, import, assign levels, track status)
- Plan and communicate practice schedules
- Schedule games and build lineups
- Invite and coordinate assistant coaches
- View player rankings and compare performance
- Share verified player profiles with families and recruiters

### Current Key Surfaces

- **Team Home** (`/`) — Command center with next game, this week schedule, team snapshot
- **Roster** (`/roster`) — Full player list with level badges, search, position/grade filters
- **Dashboard** (`/dashboard`) — Stats & Rankings with metric filters, position/grade filters, ranked player list
- **Schedule** (`/schedule`) — Unified calendar of games and practices
- **Score Entry** (`/score`) — Evaluation entry with standard and Station Mode
- **Player Detail** (`/player/:id`) — Individual player profile with metrics, trends, evaluations
- **Team Management** (`/teams`) — Team-level views, game scheduling, roster by level
- **Game Detail** (`/game/:id`) — Game roster selection, lineup builder, print
- **Practice Planner** (`/practices`) — Practice plan list, creation
- **Practice Detail** (`/practice/:id`) — Time-blocked schedule with coach assignments
- **Settings** (`/settings`) — Program config, metrics, sessions, coaches, demo tools

### What Good Looks Like Now

The coach opens the app on their phone, sees what's happening this week, taps into Score Entry to run an evaluation session, reviews rankings on the Dashboard, assigns team levels, plans tomorrow's practice, and prints lineup cards for game day. Every step is fast, clear, and reliable.

### Near-Term Priorities

1. Zero data loss in Score Entry under all conditions
2. Smooth tryout-to-roster decision workflow
3. Practice and game-day tools that reduce clipboard dependency
4. Consistent, polished UI that builds trust

### Future-State Value

The coach becomes the anchor of a verified data ecosystem. Their evaluations power recruiting profiles, development analytics, and cross-program comparisons. Rostr becomes indispensable infrastructure for running a program, not just a tryout tool.

---

## Evaluator (Assistant Coach)

### Who This Is

An assistant coach or volunteer evaluator who enters scores during tryouts and evaluation sessions. They may have limited permissions (cannot manage roster, configure metrics, or make roster decisions). They need a focused, fast interface.

### Core Jobs To Be Done

- Enter evaluation scores quickly during live sessions
- Navigate between players efficiently
- Confirm scores saved successfully
- Handle network interruptions without data loss

### Current Key Surfaces

- **Score Entry** (`/score`) — Primary interface; standard mode and Station Mode
- **Team Home** (`/`) — Overview of program state
- **Roster** (`/roster`) — Player list for reference
- **Schedule** (`/schedule`) — Schedule view

**Permission note:** The current permission model is role-based (head_coach, assistant_coach, player, scout) via AuthContext. Assistant coaches can access most pages but mutation permissions (e.g., deleting metrics, managing roster assignments, inviting coaches) are gated to head_coach role in the UI layer. RLS policies on Supabase enforce program-level isolation but do not currently differentiate head_coach from assistant_coach at the DB level.

### What Good Looks Like Now

The evaluator opens the app at the field, selects their assigned session and metric, and enters scores player-by-player using Station Mode. Save confirmations appear immediately. If they lose cell signal, the retry queue holds scores until connectivity returns.

### Near-Term Priorities

1. Station Mode reliability (fix stationIndex desync edge case)
2. Clear save-state feedback (saved vs. pending vs. failed)
3. Minimal UI friction — the evaluator should never need to think about navigation

### Future-State Value

Evaluators across multiple programs contribute to a credentialed evaluation network. Their identity and evaluation history become part of the data's credibility chain.

---

## Player

### Who This Is

A youth, high school, or club athlete who has been evaluated by a Rostr-using program. They are primarily a data consumer — they view their profile and share it. They do not enter data or manage anything.

### Core Jobs To Be Done

- View their verified performance profile
- Understand their metrics and development trajectory
- Share their profile with college coaches, scouts, or family
- Access their profile easily (link, QR code)

### Current Key Surfaces

- **Public Profile** (`/p/:slug`) — Verified metrics, bio, evaluator info, development sparklines, QR code, share URL
- **Player Comparison** (`/compare`) — Side-by-side comparison (accessed via scout search or direct URL)

### What Good Looks Like Now

The player receives a profile link from their coach, opens it on their phone, and sees their verified metrics organized by category with development trend sparklines. They share the URL or show the QR code to a college coach at a showcase event.

### Near-Term Priorities

1. Profile must look credible and professional
2. All metrics must display correctly with proper aggregation
3. Development trends must be visually clear
4. Share mechanism must be frictionless (URL + QR)

### Future-State Value

The player's Rostr profile becomes their verified athletic identity — a longitudinal record spanning multiple seasons, sports, and programs. College coaches and scouts treat it as a trusted credential because every data point is traceable to a specific evaluator, session, and program.

---

## Scout / Recruiting Viewer

### Who This Is

A college coach, recruiting coordinator, or independent scout searching for athletes who meet specific criteria. They need to find, evaluate, and compare players across programs.

### Core Jobs To Be Done

- Search for players by position, metrics, location, graduation year
- View verified player profiles
- Compare 2-3 candidates side by side
- Assess data credibility (who evaluated, when, under what conditions)

### Current Key Surfaces

- **Player Search** (`/search`) — Currently scout-only via ScoutRoute; metric-based search with filters
- **Public Profile** (`/p/:slug`) — Same profile view as players see
- **Player Comparison** (`/compare?players=slug1,slug2,slug3`) — Side-by-side metrics + bio comparison

### What Good Looks Like Now

The scout searches for right-handed pitchers in Colorado with fastball velocity above 85 mph, opens three promising profiles, compares them side by side, and contacts programs directly based on evaluator information shown on the profile.

### Near-Term Priorities

1. Search results must be accurate and fast
2. Profile data must be trustworthy (aggregation correct, trends visible)
3. Comparison must highlight meaningful differences
4. Basic infrastructure works; no new features needed for pilot

### Future-State Value

Scouts get a verified, searchable database of athletes with credentialed evaluations — replacing the unreliable patchwork of self-reported stats, showcase highlight reels, and word-of-mouth recommendations.

---

## Athletic Director / Program Admin

### Who This Is

A school athletic director or club organization administrator who oversees multiple teams, coaches, and seasons. They need confidence that the system is organized and that coaches are using it effectively.

### Core Jobs To Be Done

- Ensure programs are set up correctly
- Monitor that coaches are actively evaluating
- View program-level summaries
- Manage multi-team structures (Varsity, JV, Freshman)

### Current Key Surfaces

- **Settings** (`/settings`) — Program configuration
- **Team Management** (`/teams`) — Team-level views (V/JV/Fr)
- **Pilot Analytics** (`/analytics`) — Usage stats (head coach only currently)

### What Good Looks Like Now

The AD checks that the baseball program has 25 players rostered, 3 coaches assigned, and that tryout evaluations have been entered for the current session. They see the program is organized and active.

### Near-Term Priorities

1. Program setup must be self-service and clear
2. Coach management must be reliable
3. No priority — this role benefits from coach workflow quality

### Future-State Value

The AD manages an entire athletic department through Rostr — multiple sports, multiple seasons, coach performance tracking, facility scheduling, and compliance reporting.

---

## Club Organization

### Who This Is

A club sports organization (e.g., a travel baseball club with 6 age-group teams) that needs to manage multiple teams, coaches, tryouts, and seasons under a single organizational umbrella.

### Core Jobs To Be Done

- Manage multiple teams within one organization
- Coordinate tryouts across age groups
- Maintain consistent evaluation standards
- Track players across seasons and teams

### Current Key Surfaces

- Not directly served yet. Current architecture supports single-program operation. Multi-team is handled informally via team levels (Varsity / JV / Freshman) within one program.

### What Good Looks Like Now

A club can use Rostr for one team at a time. Multi-team coordination requires separate program accounts.

### Near-Term Priorities

1. No priority for current build — single-program operation must be excellent first
2. Architecture should not preclude future multi-program support

### Future-State Value

The club runs all teams, all tryouts, and all seasons through Rostr. Players move between age groups with their evaluation history intact. The club's brand and evaluation credibility become recruiting assets.

---

## Role Prioritization for Current Build

| Priority | Role | Rationale |
|----------|------|-----------|
| 1 | **Coach** | The primary user. Everything flows from coach adoption. |
| 2 | **Evaluator** | Directly enables the coach's workflow. Score Entry reliability is shared infrastructure. |
| 3 | **Player** | Consumes the data coaches generate. Profile credibility validates the platform. |
| 4 | **Scout** | Benefits from player data quality. Basic search/compare infrastructure exists. |
| 5 | **Athletic Director** | Benefits from coach adoption. Needs no dedicated features yet. |
| 6 | **Club Organization** | Requires multi-program architecture not yet built. |

---

## Implementation Rule

**Coach and evaluator usability come first.** Every sprint should measurably improve the coach's daily workflow or the evaluator's scoring experience. Player and scout credibility come second — their value depends entirely on data quality generated by coaches. Admin and club confidence come last — they benefit passively from a well-functioning coach experience and require no dedicated effort until single-program operations are excellent.

When choosing between a coach UX improvement and a new feature for any other role, the coach UX improvement wins unless explicitly overridden by a product decision.

## Related Documents

| Document | Purpose |
|----------|---------|
| PRODUCT_VISION.md | Product thesis, user groups, scope discipline |
| LAUNCH_READINESS.md | Must-pass workflows per role, readiness rubric |
| TASK_QUEUE.md | Active tasks affecting each role's surfaces |
| KNOWN_ISSUES.md | Bugs affecting specific role workflows |
