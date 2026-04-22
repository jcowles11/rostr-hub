# Rostr Design Tokens

All values are literal. Copy directly into your Tailwind config or CSS variable file.

## Colors

### Semantic roles

| Token | Hex | Usage |
|---|---|---|
| `--paper` | `#f5f2ec` | App background (warm off-white) |
| `--paper-deep` | `#ebe6db` | Subtle containers, hover states |
| `--card` | `#ffffff` | Card surface, modals |
| `--ink` | `#0e1116` | Primary text, dark chrome (sidebar, top bar) |
| `--ink-2` | `#3a3f47` | Secondary text |
| `--ink-3` | `#6b7280` | Tertiary text, icons, labels |
| `--ink-4` | `#9ca3af` | Disabled, placeholder |
| `--hair` | `#e5e0d4` | Primary borders, dividers |
| `--hair-2` | `#efeadf` | Subtle internal dividers |

### Brand / accent

| Token | Hex | Usage |
|---|---|---|
| `--red` | `#c83a3a` | Primary brand, CTAs, active nav, alerts |
| `--red-soft` | `#f8dedc` | Red status pills, backgrounds |
| `--red-dim` | `#e8c9c4` | — |
| `--grass` | `#2f7d4f` | Success, positive delta, "keep" verdict |
| `--grass-dim` | `#cfe3d4` | Grass backgrounds, "linked" pills |
| `--dirt` | `#b37a4c` | Neutral brand accent, avatars |
| `--sky` | `#3a6ea8` | Secondary accent, JV pill, chart lines |
| `--gold` | `#d4a23a` | 1st place, achievement |
| `--amber` | `#d68620` | Warning, bubble/questionable |

### Status mapping (use consistently)

- **Success / keep / available / linked / positive delta:** `--grass` on `--grass-dim`
- **Warning / bubble / limited / pending:** `--amber` on `#f8e3c4`
- **Danger / cut / unavailable / negative delta:** `--red` on `--red-soft`
- **Neutral / undecided / not linked:** `--ink-3` on `--paper-deep`

## Typography

### Families

- **Display:** `Space Grotesk`, weights 400 / 500 / 600 / 700. `letter-spacing: -0.02em` on larger sizes.
- **UI:** `Inter`, weights 400 / 500 / 600 / 700.
- **Mono / numeric:** `JetBrains Mono`, weights 400 / 500 / 600 / 700. Use `font-variant-numeric: tabular-nums` for all stat numbers.

### Scale

| Role | Family | Size | Weight | Line | Tracking |
|---|---|---|---|---|---|
| `display-xl` | Space Grotesk | 64–80px | 600 | 1.02 | -0.04em |
| `display-lg` | Space Grotesk | 44–48px | 600 | 1.05 | -0.03em |
| `display-md` | Space Grotesk | 30–32px | 600 | 1.1 | -0.03em |
| `display-sm` | Space Grotesk | 20–22px | 600 | 1.2 | -0.02em |
| `h1` | Space Grotesk | 30px | 600 | 1.1 | -0.03em |
| `h2` | Space Grotesk | 20px | 600 | 1.2 | -0.02em |
| `h3` | Space Grotesk | 15px | 600 | 1.3 | -0.01em |
| `body` | Inter | 14px | 400 | 1.5 | 0 |
| `body-sm` | Inter | 13px | 400 | 1.5 | 0 |
| `caption` | Inter | 12px | 500 | 1.4 | 0 |
| `label` | Inter | 10–11px | 700 | 1.2 | 0.8–1px, UPPERCASE |
| `stat-xl` | JetBrains Mono | 26–32px | 600 | 1 | -0.02em |
| `stat-md` | JetBrains Mono | 16–18px | 600 | 1 | 0 |
| `stat-sm` | JetBrains Mono | 12–13px | 500 | 1.2 | 0 |

## Spacing scale

Use `4`, `8`, `12`, `16`, `20`, `24`, `28`, `32`, `40`, `48`, `60`, `80` px.
Internal card padding: `14–20px`. Page gutter: `28–32px`. Block gap: `22px`.

## Radii

- `--r-xs` 4–5px — status pills, small badges
- `--r-sm` 7–8px — buttons, inputs, chips
- `--r-md` 10–12px — cards, modals, stat tiles
- `--r-lg` 14–16px — panels, large cards
- `--r-xl` 20px — hero blocks, avatar frames
- `--r-phone` 32–36px — phone bezel mocks
- `--r-full` 999px — pills, circular avatars

## Shadows

- `shadow-card`: `0 1px 3px rgba(0,0,0,.06)` — default card lift
- `shadow-hover`: `0 4px 12px rgba(0,0,0,.08)` — hover on interactive cards
- `shadow-elev`: `0 10px 28px -8px rgba(14,17,22,.2)` — avatars, featured blocks
- `shadow-modal`: `0 30px 80px rgba(0,0,0,.3)` — modals, slideovers
- `shadow-phone`: `0 20px 50px rgba(0,0,0,.4)` — phone mocks

## Borders

- Default: `1px solid var(--hair)`
- Internal/dashed: `1px dashed var(--hair)`
- Focus ring: `0 0 0 3px var(--red-soft)` + border `var(--red)`

## Layout grid

- **Desktop content max-width:** 1400px (app views) / 1160px (marketing + public profile) / 1200px (coach hub).
- **Gutter:** 28–32px.
- **Column gap inside grids:** 22px.
- **App chrome:** 220px nav sidebar (left), 56–60px top bar (fixed), main content fills remainder.

## Motion

- Hover: `150ms ease` on color/bg.
- Slideover / modal: `250ms ease` on transform / opacity.
- Realtime pulse indicator: 1.4s infinite ease, opacity 1 → 0.4.
- Avoid elaborate page transitions.

## Z-index

- `0` base content
- `4` sticky tab bars
- `5` sticky top bar
- `20` sticky marketing nav
- `90` slideover panels
- `100` full-screen overlays/modals
