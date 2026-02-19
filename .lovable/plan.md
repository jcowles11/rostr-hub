

# ⚾ HS Baseball Tryout Manager

A full-featured tryout management app built to solve the real problems coaches face: slow data entry, hard-to-find players, siloed coach data, and rigid metric systems.

---

## 1. Coach Authentication & Program Setup
- Coaches sign up and create their **program** (school name, levels: Varsity/JV/Freshman)
- Head coach **invites assistant coaches** via email
- Role-based access: Head Coach (full control) vs. Assistant Coach (evaluate & view, no final roster decisions)

## 2. Player Registration Portal
- Shareable public registration link for players/parents
- Collects: name, grade, positions, travel ball experience, jersey number preference, emergency contact, medical notes
- Auto-populates the tryout roster — zero manual entry for coaches

## 3. Tryout Session Management
- Create sessions (e.g., "Day 1 - Fielding & Running")
- Check-in players for attendance tracking
- Organize players into groups/stations

## 4. ⚡ Quick-Entry Scoring System (Core Focus)
**This is the #1 priority — solving the speed problem on the field.**

- **Search-first player selection**: Type 2-3 letters and instantly filter to the right player. Always alphabetically sorted by last name.
- **Rapid numeric input**: Large number pad optimized for mobile — tap a player, tap a metric, punch in the number, done. No scrolling through dropdowns.
- **Station mode**: Lock into a specific drill (e.g., "60-yard dash") and cycle through players one at a time — just enter the number and swipe to next player.
- **Batch entry**: Enter the same metric for multiple players in a list view without navigating away.
- **Recent players**: Quick-access list of players you just scored so you can fix mistakes instantly.

## 5. 🔧 Fully Customizable Metrics
**Coaches define exactly what they want to measure — nothing is hardcoded.**

- Pre-loaded **metric templates** for common drills (60-yard, exit velo, arm velo, etc.) that coaches can use as a starting point
- **Add any custom metric** with a name, unit (seconds, mph, feet, 1-5 scale, 1-10 scale), and category (running, hitting, fielding, pitching, other)
- Remove or rename any default metric
- Set metric type: timed (lower is better), measured (higher is better), or rated (scale)
- Metrics are program-wide so all coaches use the same categories

## 6. 👀 Live Cross-Coach Visibility
**Every coach sees what every other coach has entered — in real time.**

- Player detail view shows **all evaluations from all coaches** side by side
- Color-coded by coach so you can tell who rated what
- **Aggregate scores** automatically calculated (average across coaches)
- Flag when coaches disagree significantly on a player (e.g., one coach rates 3, another rates 8)
- Coach filter: view just your scores, just another coach's, or the combined view
- Real-time sync — when Coach B enters a score on the field, Coach A sees it update on their device immediately

## 7. Coach Notes & Flags
- Free-form notes per player, tagged by coach and session
- Quick-tap flags: "Standout", "Needs Second Look", "Concern"
- All notes visible to every coach in the program

## 8. Player Dashboard & Comparison
- **Always sorted alphabetically by last name** (with option to sort by score, position, grade)
- Instant search/filter bar at the top of every list
- Side-by-side comparison of 2-3 players
- Filter by position, grade, score range, flag status
- Visual indicators for top performers and borderline players

## 9. Roster Decision Board
- Assign players: Varsity / JV / Freshman / Cut
- Drag-and-drop or quick dropdown assignment
- Head coach controls final assignments; assistants can view
- Decision history tracking

## 10. Export & Reporting
- Export final rosters as PDF or CSV
- Player report cards with all metrics, scores, and notes
- Print-friendly tryout summary

## 11. Design & Experience
- **Mobile-first** — designed for phones on the field in bright sunlight
- Large tap targets, high-contrast text, minimal navigation
- Bottom navigation bar for quick switching between: Roster, Score Entry, Dashboard, Settings
- Works offline-capable where possible (scores sync when back online)

---

## Technical Approach
- **Backend**: Lovable Cloud (Supabase) for database, auth, and real-time subscriptions
- **Real-time**: Supabase Realtime for live cross-coach score visibility
- **Key tables**: Programs, Coaches (with roles), Players, Tryout Sessions, Custom Metrics, Evaluations, Notes, Roster Assignments
- **Auth**: Email-based coach login with role management (separate roles table)

