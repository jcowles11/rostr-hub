# Rostr Data Model

Target: Postgres + Prisma. All IDs are `cuid()`. All timestamps UTC. Soft-delete via `deleted_at` everywhere.

---

## Core entities

### `School`
NCES-sourced high school or club org.
- `id`, `name`, `nces_id`, `state`, `city`, `mascot`, `colors[2]`, `logo_url`
- has many `Team`s

### `Team`
A single sport × level at a School for a season.
- `id`, `school_id`, `sport` (enum: baseball, softball, football, basketball, volleyball, soccer), `level` (V / JV / F), `season_year`, `season_start`, `season_end`, `head_coach_id`, `team_slug` (unique — part of public URL)
- has many `TeamMembership`, `Player`, `Game`, `Practice`, `Tryout`

### `User`
Anyone who logs in — coach, AD, player, parent, recruiter. Role + scope determine access.
- `id`, `email`, `name`, `avatar_url`, `handle` (unique, used for public profile if player)
- `primary_role`: `coach` | `ad` | `player` | `parent` | `recruiter` | `admin`

### `TeamMembership`
Joins `User` to `Team` with role + scope.
- `user_id`, `team_id`, `role` (head_coach / assistant_coach / ad / player / parent), `status` (active / invited / archived), `created_at`
- composite PK `(user_id, team_id)`

### `Player`
The athlete entity — can exist with or without a linked `User` (unlinked while coach is filling roster; linked once athlete claims profile).
- `id`, `team_id`, `user_id?` (nullable until claimed), `handle` (unique — slug for public profile)
- `first_name`, `last_name`, `jersey_number`, `level` (V / JV / F), `positions[]` (array — primary first), `class_year` (2026 etc), `bats` (L/R/S), `throws` (L/R)
- `height_in`, `weight_lb`, `dob`
- `gpa`, `test_scores` (jsonb — ACT/SAT), `target_division`, `intended_major`
- `availability_status` (ok / questionable / out), `availability_note`, `availability_until`
- `profile_status` (unlinked / pending / linked / verified)
- `claimed_at`, `claim_token`
- has many `SportStat`, `Highlight`, `Note`, `TryoutResult`

### `SportStat` (polymorphic)
All stat entries go here. Sport-specific schema lives in the `value` jsonb column, validated by the `sport` discriminator.
- `id`, `player_id`, `sport`, `stat_key` (e.g. `baseball.exit_velo_max`), `value` (jsonb — could be number, object with units)
- `recorded_at`, `source` (game / practice / tryout / combine / self_reported), `source_ref_id`
- **Verification chain (the moat):**
  - `verified_by_user_id?` (coach who signed off)
  - `verified_at?`
  - `verification_kind` (coach_measurement / game_log / device_capture / self_reported)

Common baseball keys: `exit_velo_max`, `exit_velo_avg`, `sixty_yard`, `pop_time`, `fastball_velo`, `throw_velo_of`, `throw_velo_if`, `ba`, `obp`, `slg`, `era`, `whip`.

### `Highlight`
- `id`, `player_id`, `mux_asset_id`, `thumbnail_url`, `duration_sec`, `recorded_at`, `game_id?`, `caption`
- `verification_status`

### `Note`
Coach's notes on a player. Also used for tryout comments.
- `id`, `player_id`, `author_user_id`, `body` (markdown), `kind` (general / evaluation / medical / disciplinary / college), `context_ref` (polymorphic — `tryout:123` / `game:456` etc), `visibility` (coach_only / team_staff / player_visible)
- `created_at`, `updated_at`

---

## Practice

### `Practice`
- `id`, `team_id`, `starts_at`, `duration_min`, `location`, `weather` (jsonb snapshot at start), `template_id?`, `created_by_user_id`
- `status` (draft / scheduled / in_progress / complete)
- `started_at`, `completed_at`
- has many `PracticeBlock`

### `PracticeBlock`
- `id`, `practice_id`, `order`, `drill_id?` (null if freeform), `name`, `category` (hitting / fielding / pitching / conditioning / situational / warmup), `duration_min`, `focus` (text), `field_zone_id?`, `group_assignments` (jsonb — group name → [player_ids])
- `actual_duration_min?` (filled in during field-runner)
- `coach_note?`

### `Drill`
Reusable library entries.
- `id`, `org_id?` (null = global Rostr library), `name`, `category`, `default_duration_min`, `description`, `focus`, `equipment[]`

### `PracticeTemplate`
- `id`, `team_id`, `name` ("Monday routine"), `blocks` (jsonb — same shape as `PracticeBlock` array without IDs)

---

## Tryouts

### `Tryout`
- `id`, `team_id`, `name`, `target_level` (V / JV / F / mixed), `starts_at`, `ends_at`, `status`, `roster_size_target`, `created_by_user_id`
- has many `Station`, `TryoutResult`, `TryoutAttendee`

### `TryoutAttendee`
- `tryout_id`, `player_id`, `checked_in_at`, `verdict` (undecided / keep_v / keep_jv / keep_f / bubble / cut), `verdict_reason?`, `verdict_set_by_user_id?`

### `Station`
- `id`, `tryout_id`, `name`, `category`, `coach_user_id`, `order`, `status` (idle / live / complete)
- Lives on a field zone (FK to `FieldZone` — see below).

### `TryoutResult`
Each measurement per player per station.
- `id`, `tryout_id`, `station_id`, `player_id`, `attempt_number`, `metric_key`, `value`, `unit`, `recorded_by_user_id`, `recorded_at`, `media_url?`
- All `TryoutResult` rows ALSO write through to `SportStat` with `source = tryout`.

---

## Games

### `Game`
- `id`, `team_id`, `opponent_team_id?` (if opponent also on Rostr), `opponent_name` (freetext fallback), `starts_at`, `home_away`, `location`, `status` (scheduled / in_progress / final / postponed)
- `score_us`, `score_them`
- `gamechanger_import_id?` — nullable; if set, stats pulled from GC on game end.

### `Lineup`
- `id`, `game_id`, `name` ("Starting") / `order` (batting order 1–9 + DH + bench), `player_assignments` (jsonb — position → player_id), `is_active`

### `PlateAppearance` / `Pitching` (baseball specifics — illustrative)
- Tie to `Game` and `player_id`. Roll up into `SportStat`.

---

## Scouting + recruiting

### `RecruiterSeat`
- `id`, `user_id`, `org_name` (college/program), `division`, `recruiting_territories[]`, `sports[]`, `expires_at`

### `ProfileView`
- `id`, `profile_user_id` (or `player_id`), `viewer_user_id?`, `viewer_ip_hash`, `viewed_at`, `source` (shared_link / search / saved_list)

### `SavedProspect`
- `recruiter_user_id`, `player_id`, `saved_at`, `tag` (freetext), `last_contacted_at?`

### `RecruiterMessage`
- `id`, `recruiter_user_id`, `player_id`, `routed_via_coach_user_id`, `body`, `sent_at`, `read_at?`
- Messages to unsigned juniors ALWAYS route via the coach (NCAA compliance).

---

## Messaging

### `Thread` / `Message`
Bog-standard. Thread participants polymorphic (`User[]`), message author, body, read receipts per participant.
Broadcast threads have a `scope` field: `team:<id>` / `level:<tid>:v` / `position:<tid>:P`.

---

## Field / venue

### `FieldZone`
Used by practice + tryout planners.
- `id`, `team_id`, `name` ("Infield", "Cage 1"), `color`, `svg_path`, `x`, `y`, `w`, `h`

---

## Access control

All reads filtered by `TeamMembership`. Public routes (player profile at `/<handle>`) bypass auth but redact sensitive fields:
- **Public:** name, photo, class year, position, measurables where `sport_stat.verification_status ≠ self_reported`, highlights, achievements, GPA range bucket (3.5–4.0 etc), academics summary, team history.
- **Coach-only:** notes, medical, disciplinary, full contact info, parent info, raw unverified stats.
- **Recruiter-only:** `ProfileView` attribution, saved-prospect tagging.

## Import mapping — GameChanger

| GC column | Rostr field |
|---|---|
| `First Name` | `player.first_name` |
| `Last Name` | `player.last_name` |
| `Jersey` | `player.jersey_number` |
| `Position` | `player.positions[0]` |
| `Bats` | `player.bats` |
| `Throws` | `player.throws` |
| `Grad Year` | `player.class_year` |
| `Height` | `player.height_in` (parse `6'2"`) |
| `Weight` | `player.weight_lb` |
| `AVG` | `SportStat{stat_key:'baseball.ba', source:'game_log'}` per game |
| `OBP/SLG/OPS` | same pattern |

Export is the inverse — generate a GC-compatible CSV with same columns.

## Import mapping — MaxPreps

Similar — maps to the same `Player` + `SportStat` rows. Full column list maintained in `apps/web/src/lib/import/maxpreps.ts`.

---

## API sketch

REST + tRPC hybrid (tRPC for internal app, REST for webhooks + integrations).

```
GET   /api/teams/:teamId/roster
POST  /api/teams/:teamId/roster/import
GET   /api/players/:handle           (public — redacted)
GET   /api/players/:id               (authed — full)
PATCH /api/players/:id

POST  /api/practices                 (create)
POST  /api/practices/:id/start       (field runner)
POST  /api/practices/:id/blocks/:bid/advance
POST  /api/practices/:id/complete

GET   /api/tryouts/:id
POST  /api/tryouts/:id/results       (mobile scoring)
POST  /api/tryouts/:id/finalize

GET   /api/games/:id
POST  /api/games/:id/lineup
POST  /api/games/:id/events          (dugout console)
POST  /api/games/:id/export/gc       (GameChanger JSON)

GET   /api/recruit/search            (recruiter seat)
POST  /api/recruit/messages
```

Realtime channels:
- `team:<id>:feed` — coach hub feed
- `practice:<id>` — field runner sync
- `tryout:<id>` — live scoring + rankings
- `game:<id>` — dugout console
