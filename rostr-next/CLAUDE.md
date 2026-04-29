# CLAUDE.md — rostr-next engineering context

This is the **active** Rostr engineering doc. The same content lives at the worktree root (`../CLAUDE.md`) — duplicated here so that wherever you cd, you find it.

The dormant Vite SPA at the worktree root is reference-only and not the source of truth for current behavior.

---

> **For the full content, see [`../CLAUDE.md`](../CLAUDE.md).**
>
> If you've made it here without reading the parent, the canonical doc is one directory up. Both files are kept in sync; the parent is the editable copy. If the two ever diverge, the parent wins.

---

## Quick orientation

You're working on **Next.js 14 (App Router) + Supabase + Anthropic**. Deployed to **Vercel** (root directory = `rostr-next/`).

**The fastest sanity-check after any change:**

```bash
npx tsc --noEmit && npm run build
```

Both must pass with zero errors.

**Common tasks:**

| Task | Command |
|------|---------|
| Local dev | `npm run dev` (port 3000) |
| Production build | `npm run build` |
| Production server (after build) | `PORT=3000 npm run start` |
| Strict typecheck only | `npx tsc --noEmit` |
| Apply pending Supabase migrations | `cd .. && export SUPABASE_DB_PASSWORD=$(grep "^SUPABASE_DB_PASSWORD=" rostr-next/.env.local \| sed 's/^[^=]*=//' \| tr -d '"') && supabase db push --linked --password "$SUPABASE_DB_PASSWORD"` |
| List migration state (local vs remote) | Same env-var setup, then `supabase migration list --linked --password "$SUPABASE_DB_PASSWORD"` |

**Current migration state (April 29 2026):** all 28 migrations in `../supabase/migrations/` are applied to the linked remote project (`fubylvgkvnjjrpvdavjy.supabase.co`). The Supabase CLI is authenticated and the project is linked workspace-wide.

**Always-on patterns** (read the parent doc for details):

- Server actions (`"use server"`) for all mutations. Never call Supabase directly from a client component.
- Demo guard: `if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };` at the top of every mutation.
- AI rate limit: `checkAIRateLimit(coach.id)` before any Anthropic call.
- Error + loading boundaries on every route segment that does server work.
- `RouteErrorCard` (not custom JSX) for `error.tsx` bodies.
- Migration-resilience: try the full SELECT; fall back to base columns on `column does not exist` errors.

---

For the full architecture, demo-mode rules, deploy steps, and feature inventory, see [`../CLAUDE.md`](../CLAUDE.md).
