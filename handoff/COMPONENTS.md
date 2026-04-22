# Rostr Component Inventory

Components are grouped atoms → molecules → organisms. Every prop/variant you'll need to build is listed. Copy names into your codebase (e.g. `<StatTile/>`, `<PlayerRow/>`).

---

## Atoms

### `<Button variant size icon>`
- Variants: `primary` (ink bg, white text, hover → red), `red` (red bg, white), `ghost` (no bg, ink-2 text, hover → ink), `secondary` (white bg, hair border, ink text), `dark-ghost` (on dark bg: `rgba(255,255,255,.08)` bg, white text).
- Sizes: `sm` (7px 12px, 12.5px font), `md` (8px 14px, 13px font), `lg` (10px 18px, 13.5px font).
- Radius 7–8px. Icon + label gap 6px. Icons at 15px stroke 1.8.

### `<Badge variant>`
- Variants: `live` (red-soft bg + red text + pulsing dot), `keep` (grass-dim/grass), `bubble` (amber soft/amber), `cut` (red-soft/red), `undecided` (paper-deep/ink-3), `linked` (grass), `pending` (amber), `unlinked` (ink-3), `verified` (grass-dim/grass with ✓), `ai` (ink bg/white text/red accent dot).
- Shape: 3px 7px, radius 5px, font 10.5px/700, letter-spacing 0.4px, UPPERCASE.

### `<LevelPill level>`
- `V` (varsity — red-soft/red), `JV` (sky-soft/sky `#e0ebf4`), `F` (paper-deep/ink-2).

### `<StatusDot status>`
- 7px circle. `ok`/`q` (questionable, amber)/`out`/`idle`.

### `<Avatar size initials color>`
- Sizes: `xs`(18)/`sm`(22)/`md`(30)/`lg`(56)/`xl`(128–144).
- Radius: full on sm/md; 20px rounded-square on xl (hero avatar with 5px white border + shadow-elev).
- Color presets: `c-red`, `c-sky`, `c-grass`, `c-dirt`, `c-gold`, `c-amber`, `c-ink`, `c-ink2`. Derived deterministically from player id.

### `<IconButton icon tooltip>`
- 4–8px padding, radius 5px, ink-3 color, hover → paper-deep bg + ink color.

### `<SparkLine points width height stroke>`
- Inline SVG. 60×18 default. 1.5px stroke in grass or red depending on delta sign.

### `<Input label icon trailing>`
- Paper bg, hair border, radius 7–8px, 7–9px padding, 12.5–13px font.
- Search variant: leading magnifying glass + trailing `⌘K` kbd hint.

### `<Kbd>` — `⌘K` style
- JetBrains Mono 10.5px, 2px 6px padding, card bg, hair border, radius 4px, ink-4 color.

### `<Toggle on>`
- 34×20px track. Radius 10px. Ink bg when on, paper-deep when off. 16px white knob.

### `<Checkbox checked>`
- 14×14px. Ink bg + white ✓ when checked; otherwise hair border.

### `<Chip on removable>`
- 6px 11px, radius 7px, card bg, hair border. `on` = ink bg + white text. With × remove affordance.

---

## Molecules

### `<StatTile label value delta sparkline>`
- Card, 14–16px padding, radius 12px.
- Label: `label` token (10px/700/uppercase/ink-3).
- Value: JetBrains Mono 26–32px/600.
- Optional delta: 11px/600 with ▲/▼ arrow, grass or red.
- Optional inline sparkline right-aligned.

### `<StatHeroCell label value unit delta sparkline>`
- Variant of StatTile used in 4-across grid inside a single card. Right border `hair-2` between cells, last cell has no border. Padding 22px 20px.

### `<PlayerRow dense|table|card>`
Standard player card/row used everywhere.
- **Table row variant:** `<Avatar sm>` + `<Name>` + `@handle` (JetBrains Mono 11px/ink-3) + cells (number, level pill, position, class, stats, availability, profile status, row ⋯ actions).
- **Dense variant** (sidebars): avatar + name + position, no extra columns.
- **Card variant** (live feed, queue): avatar + initials + name truncated + position + time.

### `<VerdictPill verdict>`
- `LOCK` / `KEEP · V` / `KEEP · JV` (grass-dim/grass), `BUBBLE` (amber), `CUT` / `THANK & RELEASE` (red-soft/red), `UNDECIDED` (paper-deep/ink-3).

### `<RankBadge rank delta>`
- Rank number in Space Grotesk 18px/700, `-0.02em` tracking.
- 1st → gold, 2nd → #9ca3af silver, 3rd → dirt bronze, else ink.
- Delta line below: `↑ 2` / `↓ 3` / `—`, JetBrains Mono 10px, grass/red/ink-3.

### `<MetricCard value label color>`
- Used on player profile + tryout mobile. Paper bg, radius 8–10px, padding 10–14px. Centered value + label.

### `<Note kind author date>`
- Quote-style block with left border (ink / grass / amber / red based on kind). Paper bg, 10–12px padding, radius 8px, 12.5px body.
- Meta line: JetBrains Mono 10.5px ink-3 with author + date + context.

### `<DrillCard category title duration focus>`
Used in practice library.
- Category dot (6px) + title (12.5px/600) + duration right (mono 10.5px).
- Focus line below (10.5px/ink-3). Draggable. Hover: paper bg + hair border.

### `<PracticeBlock time duration category name focus meta>`
- Time column (56px): start time mono 12px/700 + duration mono 10.5px/ink-3.
- Body: left-border color-coded to category, paper bg, radius 10px, 10px 14px padding.
- Head: category label (10px/uppercase) + name (Space Grotesk 15px/600) + ⋯ actions.
- Focus: 11px italic ink-3.
- Meta row: 11px labels with bold values; avatar stacks for groups.

### `<FeedItem icon body time>`
- 10×18 padding. Circular icon avatar (26px) with category color. Body text wraps; mono monochrome time row 10px/ink-4.

### `<StationCard name coach progress live>`
- Rounded card, paper bg if idle, card bg + red border + red-soft glow if live.
- Header: 24px colored square icon + name.
- Coach line: 11px mono/ink-3.
- Progress row + bar (6px, `paper-deep` track, colored fill).

### `<ShareCard url handle>`
- Ink bg, radius 14px, 18px padding, radial red glow top-right.
- Mono 11.5px URL on `rgba(255,255,255,.08)` bg, with `rostr.app/` in ink-4 and `handle` in red.

### `<AICoach prompt suggestions>`
- Ink card with red glow.
- Red pill "AI CO-COACH" + dot.
- Display heading 15–16px.
- Suggestion list as clickable rows.
- Input at bottom.

### `<FilterChipRow>`
- Horizontal row of `<Chip>` + `+ Filter` terminator + right-aligned view-mode toggle.

### `<ViewToggle options>`
- 3px padded paper-deep container. Each option 6–10px padding, radius 5px. Active = card bg + shadow.

### `<Tabs underline|pill>`
- **Underline:** 14×18px, 13.5px/600, ink-3 default, ink on hover. Active adds 2px red border-bottom (`-1px` margin to overlap container border). Optional count badge `count` in JetBrains Mono 10.5px.
- **Pill:** 4–8px padding rounded full, paper bg when inactive, ink bg + white text when active.

### `<Stepper steps active>`
Horizontal wizard stepper.
- Each step: 22px circle (paper-deep bg ink-3 text; ink+white when active; grass+✓ when done) + 12px/500 label.
- Connectors: 1px horizontal hair line; grass when step is done.

### `<LiveIndicator label>`
- Red-soft pill with pulsing red 8px dot + UPPERCASE red text.

### `<Phone variant>` — Phone mockup frame
- 230–260px width, black bezel 8px, radius 32–36px, shadow-phone.
- Inner screen: paper bg, radius 26–30px, `aspect-ratio: 9/19.5`, overflow hidden.
- Status bar: 28–30px high, notch `78×22px` pinned top-center.

---

## Organisms

### `<AppSidebar team nav user>`
- 220px wide, ink bg, 12–16px padding.
- Brand mark (28px square, white bg/ink text, red dashed inner border).
- Team switcher card with level + sport + player count, chevron.
- Sections labeled by 10px/700 UPPERCASE label in `rgba(255,255,255,.4)`.
- Nav item: 9–10px padding, radius 7px, 13.5px/500. Icon 16px. Active = red bg + white text. Badge mono 10px right-aligned.
- Bottom: user card (avatar + name + role), divider above.

### `<TopBar breadcrumbs search actions>`
- 56–60px height, card bg, hair border-bottom.
- Breadcrumb ink-3 with bold final segment.
- Right-aligned search input (260px) + `<Button ghost>`s + `<Button primary>` for primary action.

### `<RosterTable columns rows selected bulk>`
- Sticky header (paper bg, 10px/700/uppercase ink-3 labels).
- Rows: 12px 14px padding. Hover → paper bg. Selected → `--red-soft` bg.
- First column: checkbox 32px wide.
- Bulk toolbar appears as ink bg strip above table when any rows selected. Shows count + bulk actions + clear.
- Footer: "Showing X of Y" + last-synced indicator.

### `<ImportWizardModal file mapping levels review>`
See SCREENS.md §3 for full flow. Uses `<Stepper>`, file drop zone, column-mapping grid (`1fr 60px 1fr 90px`), data-peek table, level-split buckets, invite options with toggles.

### `<PlayerSlideover player tabs>`
- 460px wide panel sliding in from right over RosterTable. Shadow `-20px 0 60px rgba(0,0,0,.15)`.
- Header: prev/next IconButtons + "Player N of M" + close.
- Hero: lg avatar + name (Space Grotesk 22px/600) + JetBrains Mono meta + badges.
- Tabs: Overview / Metrics / Notes / Eligibility / Comms.
- KV list: 100px label col / 1fr value col, 13px.
- Metric grid 4-col.
- Notes list of `<Note>`.
- Foot: 3 full-width buttons (Message / Add note / Open profile).

### `<PublicProfile>` (see SCREENS.md §4)
Hero (3.6:1 min-height 260px) → identity band (avatar 128px + name 40px + actions) → 4-column stat hero → career chart → season timeline → 6-card highlights grid → combine metrics → sidebar (share card, scout interest, team history, achievements, academics, coach verification).

### `<TryoutRankings>`
Sortable 9-column table. Divider row at cutoff ("VARSITY BUBBLE · N above · M on the line · K below") in amber/mono.

### `<PracticeTimeline blocks totals stripBar>`
- Totals row 4-col (Total time / Swings / Ground balls / Throws).
- Color-coded proportion strip (`grid-template-columns: 1.25fr 1fr ...`), 44px tall. Each segment centered text 9.5px white.
- Block list below, each `<PracticeBlock>`.

### `<FieldMap zones>`
- Radial-gradient grass pitch inside aspect-ratio:1 box.
- SVG diamond path + mound circle.
- Absolutely positioned `.fz` labels with left border color-coded to category.

### `<LiveFeed items limit>`
- Stream of `<FeedItem>`s with staggered 1s entrance.

### `<StatusPanel coaches|players|availability>`
- List with small avatars, name, role, status dot, last-active time (mono).

---

## Mobile-only components

### `<FieldRunnerScreen>`
Full-screen mobile view during an active practice block.
- Current block header card (category label + block name + sub).
- Big timer (Space Grotesk 48px/700 red, countdown).
- Now-up groups (2-col), each with group label + avatar stack.
- Coach note quote.
- Next-up row (ic + label + time right).
- Bottom 2-button row (+ Note / Advance).

### `<TryoutScoringScreen>`
- Ink header with station + player + attempt.
- Paper metric card: big number (42px Space Grotesk), best-of-3 attempts grid.
- Numeric keypad 3×4.
- Footer: Retry / Save.

### `<TryoutStationQueue>`
- Queue of next players. "NOW" highlighted red. Each row: position num + xs avatar + truncated name + position right.

---

## Charts

Line chart used on player profile (career exit-velo trajectory). 2-line chart style:
- Stroke 2px, `--red` primary / `--sky` comparison.
- Area fill at 10% opacity.
- X axis dates mono 10px/ink-3; Y axis mono 10px/ink-3.
- Dots 3px filled at data points; hover state 6px with tooltip.
- Recommend Recharts or Visx.

Sparklines inline: 1.5px stroke, no axes, 60×18px.

Bar charts (season strike-zone heatmap): 9-cell grid; each cell colored on grass → amber → red scale.
