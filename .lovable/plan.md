
# Redesign the "More" Tab as a Feature Hub

## The Idea
Transform the current Settings page (the "More" tab) from a long scrolling settings page into a clean **menu hub** with categorized action tiles. Each tile either navigates to a dedicated sub-page or opens a dialog. This keeps the four primary tabs (Roster, Score, Stats, Board) focused on core workflows while the "More" tab becomes the organized home for everything else.

## Current State
The "More" tab is a single scrolling page containing: program logo upload, registration link, coach management, levels, visibility settings, metrics configuration, and sign out. Meanwhile, features like roster CSV import, data import, and export live scattered on other pages (Roster page has import buttons, Export is a separate route accessed from... nowhere obvious in the nav).

## New Layout

The "More" page becomes a categorized grid of action tiles:

```text
+----------------------------------+
| [Logo] Program Name              |
| Head Coach - John Smith           |
+----------------------------------+
|                                  |
| TRYOUT PLANNING                  |
| [Calendar] Tryout Planner        |
| [Sliders] Metrics & Drills       |
|                                  |
| DATA                             |
| [Upload] Import Roster (CSV)     |
| [Database] Import Scores (CSV)   |
| [Download] Export & Reports       |
|                                  |
| PROGRAM                          |
| [Users] Manage Coaches            |
| [Layers] Team Levels              |
| [Eye] Player Visibility           |
| [Image] Program Logo              |
| [Share] Registration Link         |
|                                  |
| ACCOUNT                          |
| [LogOut] Sign Out                 |
+----------------------------------+
```

Each tile is a compact row with an icon, title, and optional subtitle -- like a native settings app. Tapping a tile either:
- **Navigates** to a dedicated page (Tryout Planner, Export)
- **Opens a dialog** (Import Roster, Import Scores)
- **Expands inline** (Manage Coaches, Levels, Visibility, Logo -- these stay as collapsible cards on the same page to avoid too many sub-pages)

## What Changes

### 1. Restructure SettingsPage.tsx into a hub layout
- Replace the stacked cards with a categorized list of action tiles
- Keep inline-expandable sections for simple settings (coaches, levels, visibility, logo)
- Add navigation tiles for Tryout Planner and Export pages
- Add dialog-trigger tiles for Roster Import and Data Import

### 2. Create TryoutPlanner page (`/plan`)
- New page with two sections: **Sessions** (CRUD for tryout_sessions) and **Metrics Overview** (grouped by category, showing name, unit, attempts, scoring direction -- all editable inline)
- Two-column layout on desktop, stacked on mobile
- This is where coaches go to plan their tryout before game day

### 3. Wire up Export page in navigation
- The ExportPage already exists at `/export` but isn't easily discoverable. Now it's one tap away from the More menu.

### 4. Add route for `/plan`
- Add the new TryoutPlanner route to App.tsx wrapped in ProtectedRoute

## Technical Changes

| File | Change |
|------|--------|
| `src/pages/SettingsPage.tsx` | Redesign as hub with categorized action tiles, import dialogs, collapsible inline sections |
| `src/pages/TryoutPlanner.tsx` | **New** -- sessions CRUD + metrics overview grid, responsive two-column layout |
| `src/App.tsx` | Add `/plan` route |

### SettingsPage tile structure
Each tile is a simple button/link row:
- Icon + Title + optional chevron (for navigation) or expand arrow (for inline)
- Grouped under section headers (Tryout Planning, Data, Program, Account)
- Import Roster and Import Scores tiles open the existing `RosterUpload` and `DataImport` dialog components directly from this page
- Metrics tile navigates to `/plan` (the new Tryout Planner)

### TryoutPlanner.tsx details
- **Sessions panel**: List all `tryout_sessions` with name + date. Inline edit/delete. Add new session button.
- **Metrics panel**: Fetch all `metrics` for the program. Group by `category`. Each metric shows: name, unit, max_attempts, aggregation, scoring direction. Inline edit any field. Add new metric per category.
- Desktop: side-by-side columns. Mobile: stacked with sessions on top.
- Hero with gradient background, summary stats (X sessions, Y metrics)

### No database changes required
All tables (`tryout_sessions`, `metrics`) already exist with proper RLS policies.
