

## Plan: Transform Player Feed into TikTok/Instagram-Style Experience

### What Changes

**1. Navigation Updates (`UnifiedNavShell.tsx`)**
- Rename "Social" to "Feed" for the player role
- Add a "Search" tab (magnifying glass icon) for players: Feed | Search | Profile
- Bottom nav stays fixed at bottom (already is), confirming it works correctly on mobile

**2. New Search Page (`src/pages/SearchPage.tsx`)**
- Full-screen search bar at top (Instagram Explore style)
- Queries the existing `search_public_players` RPC as user types
- Shows results as tappable player cards that navigate to `/p/:slug`
- New route `/search` added to `App.tsx`

**3. Feed Redesign (`SocialHome.tsx` → full rewrite)**
- Remove the old tabbed layout (Featured/Recent/Commitments tabs)
- Replace with a vertical, full-bleed "For You" card feed:
  - Each card is a large player profile card (photo fills ~60% of card height, name/school/positions overlaid at bottom, like TikTok/Instagram Reels thumbnails)
  - Cards are tappable → navigates to `/p/:slug`
  - Commitment announcements appear inline as special "commitment" cards with trophy styling
- Keep the "Featured Players" horizontal stories strip at top (like Instagram Stories)
- Feed fetches from the existing `get_social_feed` RPC (no DB changes needed initially)

**4. Feed Page Header (`SocialPage.tsx`)**
- Remove the old hero banner
- Replace with a minimal top section: just "Feed" title, clean and minimal like Instagram's top bar

**5. Follow System (Database)**
- New `follows` table: `id`, `follower_id` (uuid, references auth user), `followed_player_id` (uuid), `created_at`
  - RLS: users can insert/delete their own follows, anyone authenticated can read
  - Unique constraint on (follower_id, followed_player_id)
- Add a "Follow" button on the public profile page (`PublicProfile.tsx`)
- Add a "Following" tab on the Feed page that shows only followed players' updates

**6. App.tsx Route Updates**
- Add `/search` route for players (wrapped in `PlayerRoute` + `UnifiedNavShell`)
- Update `SocialRoute` to use the redesigned feed

### Technical Details

**Database migration:**
```sql
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  followed_player_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, followed_player_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Authenticated users can see follows
CREATE POLICY "Anyone can view follows" ON public.follows
  FOR SELECT USING (true);

-- Users can follow
CREATE POLICY "Users can insert own follows" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can delete own follows" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);
```

**Navigation items for player role:**
```text
[ Feed ]  [ Search ]  [ Profile ]
  (home)    (search)    (user)
```

**Feed card layout (vertical scroll):**
```text
┌─────────────────────────┐
│  [Stories strip]        │  ← horizontal scroll, existing featured players
│  ○ ○ ○ ○ ○ ○           │
├─────────────────────────┤
│  ┌───────────────────┐  │
│  │                   │  │
│  │   Player Photo    │  │  ← large image, ~200px tall
│  │                   │  │
│  │  Name • School    │  │  ← overlaid at bottom
│  │  [POS] [POS] '27  │  │
│  │  [Follow]         │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │  🏆 COMMITTED     │  │  ← commitment card variant
│  │  Player → School  │  │
│  └───────────────────┘  │
│  ...                    │
└─────────────────────────┘
```

**Files to create:**
- `src/pages/SearchPage.tsx` — player search with search bar
- Migration file for `follows` table

**Files to modify:**
- `src/components/UnifiedNavShell.tsx` — add Search nav item for players, rename Social→Feed
- `src/pages/SocialHome.tsx` — full redesign to vertical card feed with For You / Following tabs
- `src/pages/SocialPage.tsx` — simplify header
- `src/pages/PublicProfile.tsx` — add Follow/Unfollow button
- `src/App.tsx` — add `/search` route
- `src/integrations/supabase/types.ts` — auto-updated after migration

