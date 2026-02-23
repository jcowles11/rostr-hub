

# Bridge Internal Roster to Public Profiles

## Problem
The coach-facing pages (Roster, Player Detail) are completely disconnected from the public/social side of the app. A coach viewing a player's detail page has no way to see or share that player's public profile. There's no obvious navigation path from the internal team management to the public-facing athlete profiles.

## Solution
Add clear navigation touchpoints at the two most natural places:

### 1. Player Detail Page -- "View Public Profile" Button
On the `PlayerDetail` page (the page a coach sees when they tap a player from the roster), add a prominent button/link in the player's hero section that opens their public profile (`/p/:slug`). This only shows if the player has a public profile enabled (`profile_public = true` and `profile_slug` exists).

- Appears as a small "Public Profile" link/button near the player's name area
- Opens in a new tab so the coach doesn't lose their place
- If the player hasn't enabled their public profile yet, show a subtle "Profile not public" label instead, so the coach knows to encourage the player

### 2. Roster Page -- Quick Share Icon on Player Cards
On each player card in the roster list, add a small share/link icon that copies the player's public profile URL to clipboard (or opens it). This gives coaches a fast way to share any player's profile without navigating into the detail page first.

- Only visible for players who have public profiles
- Small unobtrusive icon on the right side of the player card

### 3. Player Detail Page -- Fetch Profile Slug
Currently `PlayerDetail` doesn't fetch `profile_slug` or `profile_public` from the players table. We need to add these fields to the query so we can conditionally show the public profile link.

## Technical Changes

| File | Change |
|------|--------|
| `src/pages/PlayerDetail.tsx` | Add `profile_slug` and `profile_public` to the Player interface and query. Add a "View Public Profile" button in the hero section that links to `/p/:slug` (opens new tab). Show "Profile not public" hint when profile isn't enabled. |
| `src/pages/Roster.tsx` | Add `profile_slug` and `profile_public` to the player query. Show a small external-link icon on player cards for players with public profiles, linking to `/p/:slug`. |

## UX Details

**Player Detail hero area**: Below the player name/badges row, a new row with:
- If public: A button styled like the existing badge chips -- "View Public Profile" with an external-link icon, linking to `/p/{slug}` in a new tab
- If not public: A muted text "Public profile not enabled" so coaches can mention it to the player

**Roster player cards**: A small Globe or ExternalLink icon on the right side of cards where `profile_public = true`, that either navigates to the public profile or copies the URL on tap.

This is a lightweight change -- just 2 files, adding a few fields to existing queries and a couple of UI elements. No database changes needed.
