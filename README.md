# Rostr

Rostr is a sports team operating system for coaches, evaluators, and program administrators. It digitizes tryout evaluations, roster management, practice planning, game-day operations, and player development tracking.

**This is a Vite + React 18 + TypeScript + TailwindCSS + Supabase SPA.** It is not Next.js — there is no SSR, no server components, no API routes. All data flows through the Supabase JS client. The app is deployed as a static build.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Vite 5 + React 18 (via `@vitejs/plugin-react-swc`) |
| Language | TypeScript 5 (strict) |
| Styling | TailwindCSS 3 + tailwind-merge + tailwindcss-animate |
| UI Components | Radix UI primitives + shadcn/ui |
| Data | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Validation | Zod |
| Routing | react-router-dom v6 |
| Testing | Vitest |

## Local Development

Prerequisites: Node.js 18+ and npm.

```bash
# Install dependencies
npm install

# Copy environment template and fill in your Supabase credentials
cp .env.example .env

# Start dev server (http://localhost:8080)
npm run dev
```

## Commands

```bash
npm run dev          # Start dev server on :8080
npm run build        # Production build (vite build)
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run test         # Run unit tests (vitest run)
npm run lint         # ESLint
```

### Verification (run after every change)

```bash
npm run typecheck && npm run build
```

Both must pass with zero errors.

## Environment Variables

Copy `.env.example` to `.env` and provide your Supabase project credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

## Project Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](./CLAUDE.md) | Engineering context and guardrails for AI-assisted development |
| [PRODUCT_VISION.md](./PRODUCT_VISION.md) | Product thesis, scope discipline, out-of-scope list |
| [LAUNCH_READINESS.md](./LAUNCH_READINESS.md) | Pilot readiness rubric, must-pass workflows, blockers |
| [ROLE_MATRIX.md](./ROLE_MATRIX.md) | Role definitions, jobs to be done, implementation priority |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture, routing, service layer, data flow |
| [TASK_QUEUE.md](./TASK_QUEUE.md) | Active and upcoming development tasks by phase |
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | Tracked bugs with severity and mitigation status |
| [DECISIONS.md](./DECISIONS.md) | 51+ technical decision records with rationale |
| [PROGRESS.md](./PROGRESS.md) | Chronological build log |
| [BUILD_SUMMARY.md](./BUILD_SUMMARY.md) | Comprehensive snapshot of what was built and current state |
| [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md) | Coach-facing pilot walkthrough |

## Current Status

The product is in its **UI Productization Sprint** — core features work; the current focus is polish, reliability, and demo/pilot readiness. See LAUNCH_READINESS.md for the pilot readiness rubric and TASK_QUEUE.md for active work items.

Seven prepared Supabase migrations (in `supabase/migrations/`) must be applied to the live instance before full feature availability. See CLAUDE.md §7 for details.
