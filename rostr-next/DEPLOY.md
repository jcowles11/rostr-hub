# Deploy Rostr to Vercel

Two steps: apply the pending Supabase migrations, then push to Vercel.

## 1. Apply migrations (one-time, ~2 min)

Supabase migrations in `supabase/migrations/` are applied manually. For
the stats importer to work, you **must** apply migration `000021`. The
others are optional for today's pilot but still good to apply.

**Required for stats importer:**
- `20260315000021_imported_stats.sql` — creates `player_imported_batting` + `player_imported_pitching` tables

**Optional (enables more features):**
- `20260315000018_batting_stats_views.sql` — live batting stats from event log
- `20260315000019_pitching_stats_views.sql` — live pitching stats from event log
- `20260315000020_saved_search_diffs.sql` — "new matches" badges on saved searches

**How to apply:**
1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/fubylvgkvnjjrpvdavjy/sql/new)
2. Copy the contents of each `.sql` file into a new query
3. Click **Run** — should return success
4. Repeat for each file (do `000021` first, minimum)

## 2. Deploy to Vercel (~5 min)

```bash
cd rostr-next
npx vercel        # first time — prompts you to link/create a project
```

When prompted:
- **Set up and deploy?** → `Y`
- **Which scope?** → your personal account
- **Link to existing project?** → `N` (first time)
- **Project name?** → `rostr` (or whatever)
- **In which directory is your code located?** → `./` (just press Enter)
- **Want to modify settings?** → `N`

After the preview deploy completes, add environment variables and redeploy to production:

```bash
# Public (safe to expose)
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste: https://fubylvgkvnjjrpvdavjy.supabase.co

npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste the anon key from .env.local

npx vercel env add NEXT_PUBLIC_APP_URL production
# Paste your production URL, e.g.: https://rostr.vercel.app

# Optional — only needed for AI Coach feature
npx vercel env add ANTHROPIC_API_KEY production
# Paste the Anthropic key from .env.local (server-only)
```

Then push to production:

```bash
npx vercel --prod
```

You'll get a URL like `https://rostr.vercel.app`. Share that for testing.

## 3. Update Supabase Auth redirect URL

Once deployed, add your Vercel URL to Supabase's allowed redirects so email confirmations + password resets work:

1. Go to https://supabase.com/dashboard/project/fubylvgkvnjjrpvdavjy/auth/url-configuration
2. **Site URL**: set to your Vercel URL (e.g. `https://rostr.vercel.app`)
3. **Redirect URLs**: add `https://rostr.vercel.app/**`

## 4. Use it

1. Visit `https://rostr.vercel.app/signup`
2. Create account → coach role → program name "Heritage"
3. Hit `/app/setup` → set levels to just `["JV"]`
4. Go to `/app/roster` → click **"Import stats"** (new button)
5. Drop the `Heritage Eagles Junior Varsity Spring 2026 Stats.csv` file
6. Preview → Confirm → All 13 players + their batting + pitching lines load

## Troubleshooting

- **"Could not find table 'player_imported_batting'"** → migration 000021 wasn't applied. Go back to step 1.
- **Build fails on Vercel with ESLint errors** → add `"eslint": { "ignoreDuringBuilds": true }` to `next.config.js` (the pre-existing lint debt is mostly unused imports in unrelated files).
- **Sign-in redirects to localhost** → you need to update `NEXT_PUBLIC_APP_URL` and Supabase redirects (step 3).
