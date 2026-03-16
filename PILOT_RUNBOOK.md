# Rostr Pilot Runbook

A step-by-step guide for coaches running tryouts with Rostr. Follow these steps in order on tryout day.

---

## 1. Program Setup

**What:** Create your organization and configure basic program settings before anything else.

**Workflow:**
1. Sign up at the Rostr login page using your email.
2. You'll be guided through program creation — enter your organization name, sport, and season.
3. After setup you land on the Roster page as Head Coach.
4. Go to **Settings** (bottom nav → "More") to review program details.

**Avoid:**
- Don't skip program creation — all players, metrics, and sessions are scoped to your program.
- Don't create multiple programs for the same tryout. One program = one tryout cycle.

---

## 2. Adding Assistant Coaches

**What:** Invite assistant coaches so they can enter evaluations during tryouts.

**Workflow:**
1. Go to **Settings → Coaching Staff**.
2. Tap **Invite Coach** and enter the assistant's name and email.
3. Share the Rostr login link with them verbally or via text — no email is sent automatically.
4. The assistant signs up using the **exact same email** you entered. They'll be linked to your program automatically.

**Avoid:**
- Don't assume the invitation sends an email — you must share the link yourself.
- Double-check the email address. If it doesn't match exactly, the assistant won't be linked to your program.
- Don't invite coaches after scoring has started unless necessary — they'll need time to orient themselves.

---

## 3. Importing a Roster

**What:** Load your player list so you don't have to add players one by one.

**Workflow:**
1. Prepare a CSV or Excel file with columns for: First Name, Last Name, Grade, Position(s), Jersey Number.
2. Go to **Settings → Import Roster**.
3. Upload the file, map your columns to Rostr fields, and preview the import.
4. The importer flags duplicates — review and toggle "skip duplicates" if re-importing an updated file.
5. Confirm the import. Players appear on the Roster page immediately.

**Alternatively:** Add players one at a time from the **Roster** page using the + button.

**Avoid:**
- Don't import the same file twice without the duplicate skip toggle — you'll get duplicate player entries.
- Ensure names are spelled consistently. "Mike Smith" and "Michael Smith" will be treated as different players.
- Don't leave the Grade column empty — it's used for filtering on the Dashboard.

---

## 4. Configuring Evaluation Metrics

**What:** Define the drills and measurements coaches will score players on.

**Workflow:**
1. Go to **Settings → Metrics & Drills**.
2. Tap **Add Metric** for each drill. For each one, set:
   - **Name** — what coaches will see (e.g., "60-Yard Dash")
   - **Unit** — the measurement label (e.g., "sec", "mph", "1–10")
   - **Scoring direction** — Timed (lower is better), Measured (higher is better), or Rated (scale)
   - **Attempts** — how many attempts per player (1–5) and aggregation method (best, average, latest)
   - **Min/Max values** — bounds for rated metrics to catch data entry errors
3. Review the full metric list before tryout day. Metrics can be added later, but editing a metric after scores exist requires caution.

**Avoid:**
- Don't delete a metric after scores have been entered — all associated scores are permanently deleted with it.
- Don't set max attempts too low. If a drill allows 3 tries, set attempts to 3 so all data is captured.
- Don't forget to set min/max on rated metrics (e.g., 1–10). Without bounds, coaches can accidentally enter 100 instead of 10.

---

## 5. Creating a Tryout Session

**What:** Create a named event that scores will be grouped under.

**Workflow:**
1. Tap the **event selector** in the top header bar.
2. Tap **Create Session** and give it a clear name (e.g., "Day 1 — Field Tryouts").
3. The session is now active. All scores entered will be tagged to this session.
4. Create additional sessions for each tryout day or event type.

**Avoid:**
- Don't forget to switch sessions between tryout days. Scores go to whichever session is currently selected.
- Don't use vague session names. "Session 1" is harder to review later than "Day 1 — Field Tryouts."

---

## 6. Using Station Mode Scoring

**What:** The fastest way to score an entire group of players on one drill.

**Workflow:**
1. Go to the **Score** tab (bottom nav).
2. Select the **session** and **metric** you're scoring.
3. Enable **Station Mode** — players appear one at a time with left/right navigation arrows.
4. Enter the score and press Enter (or tap Save). The value saves and auto-advances to the next player.
5. The **progress bar** below the player name shows how many players you've scored (e.g., "12/40 scored — 30%").
6. Use the **search bar** to jump to a specific player by name or jersey number.
7. Recent scores appear in a scrolling list on the right — use it to verify entries.

**Avoid:**
- Don't change the search filter while in station mode — it can reset your position in the player list.
- Don't navigate away from the Score page during entry — unsaved values in the input field will be lost.
- Don't worry about network hiccups. If a save fails, it's automatically queued for retry. An amber banner shows pending retries.

---

## 7. Reviewing Rankings and Filters

**What:** After scoring, use the Dashboard to sort and compare players.

**Workflow:**
1. Go to the **Stats** tab (bottom nav).
2. Select a **metric** from the dropdown to see rankings for that specific drill.
3. Use filters to narrow the view:
   - **Position** — show only catchers, shortstops, etc.
   - **Grade** — show only freshmen, sophomores, etc.
   - **Evaluation status** — show only players who have been scored, or only those still missing scores.
   - **Evaluator** — show "My scores" to see only your evaluations, or select a specific assistant coach.
   - **Score threshold** — show only players above a minimum composite score.
4. Select **All Metrics** to see composite percentile rankings across all drills.
5. Players with incomplete evaluations show a "partial" label with a metric coverage count (e.g., "3/6 metrics").

**Avoid:**
- Don't rely on composite scores for players with partial data — a player scored on only 1 metric may rank misleadingly high.
- Check the "metrics scored" count before making cut decisions.
- Don't forget the evaluator filter resets when you switch metrics.

---

## 8. Viewing Player Profiles

**What:** Drill into individual player performance for a complete picture.

**Workflow:**
1. Tap any player name on the Roster, Dashboard, or Score page to open their profile.
2. The profile shows: all metric scores, percentile rankings, evaluator notes, position, grade, and jersey number.
3. Use this view during cut meetings to review a specific player's full evaluation.
4. Coaches can add or edit individual scores directly from the player profile using the inline evaluation form.

**Avoid:**
- Don't make cut decisions from the list view alone — always check the full profile to see the complete picture.
- Remember that percentiles are relative to your program's player pool, not national benchmarks.

---

## 9. Making Roster Decisions

**What:** Use the Roster Board to assign players to team levels after evaluations are complete.

**Workflow:**
1. Go to **Settings → Roster Board**.
2. Define team levels if you haven't already (Varsity, JV, Freshman, Cut, etc.) via **Settings → Team Levels**.
3. Drag players from the unassigned pool to the appropriate team level.
4. Use the Dashboard rankings and player profiles as reference while making assignments.
5. Review the final roster assignments with your coaching staff before communicating decisions.

**Avoid:**
- Don't assign players to levels until all evaluations are complete and reviewed.
- Don't rely solely on composite rankings — use the profile view and coach discussion for borderline players.

---

## Developer Monitoring Guide

This section is for the Rostr development team during the pilot.

### Analytics Signals to Watch

Access pilot analytics via **Settings → Pilot Analytics** (head coach only) or query the `analytics_events` table directly in Supabase Studio.

| Signal | What to Look For | Where |
|--------|-----------------|-------|
| **Score entries** | Volume per session, station vs. direct mode split | `analytics_scores_per_session` view |
| **Active coaches** | How many unique coach_ids per day | `analytics_scores_daily` view |
| **Roster imports** | Import count and player count per import | `analytics_roster_activity` view |
| **Filter usage** | Which filters coaches use most (metric, position, grade, threshold) | `analytics_filter_usage` view |
| **Profile views** | How often coaches drill into player detail | `analytics_profile_views` view |
| **Evaluator filters** | Whether multi-evaluator comparison is used | `analytics_evaluator_filter` view |
| **Event summary** | High-level event type breakdown | `analytics_event_summary` view |

### Success Indicators

- **Score entry volume:** 200+ scores entered across a tryout day indicates real usage, not just a test.
- **Multiple active coaches:** 2+ unique coach_ids entering scores confirms multi-evaluator workflow is functional.
- **Station mode adoption:** Station mode scores outnumber direct scores, confirming the primary workflow is preferred.
- **Filter engagement:** Ranking filter events > 10 per session means coaches are actively using the Dashboard for decision-making.
- **Profile views:** Profile view count > 20% of player count means coaches are reviewing individual players, not just list rankings.
- **Retry queue:** Zero or near-zero retry events indicate stable network. High retry counts signal connectivity issues at the venue.

### Warning Signs

- **Zero score entries after 30 minutes** — coaches may be stuck on setup or confused by the UI.
- **Scores only from one coach_id** — assistants may not have been linked correctly (check KI-7a migration status).
- **No filter events** — coaches may not know the Dashboard exists or may find the Roster page sufficient.
- **High retry queue failures** — venue Wi-Fi may be unreliable. Ensure coaches know about the retry banner.
- **No session_create events** — coaches may be scoring without creating a named session, making data harder to organize later.

### Pre-Pilot Checklist (Developer)

1. Run all 4 prepared migrations in order:
   - `20260315000001_add_evaluation_unique_constraint.sql` (check for existing dupes first)
   - `20260315000002_coach_email_linking.sql`
   - `20260315000003_analytics_events.sql`
   - `20260315000004_analytics_views.sql`
2. Verify RLS policies allow coach insert/select on `analytics_events`.
3. Confirm the pilot program's head coach can access `/analytics`.
4. Test the full workflow end-to-end: create session → add player → configure metric → enter score → view dashboard → view profile.
5. Have a fallback plan (paper scoring sheets) in case of critical failure.
