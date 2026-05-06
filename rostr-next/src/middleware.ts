import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Auth middleware.
 * - /app/*, /me, /scout/* → require signed-in user (redirect to /login)
 * - /login, /signup → redirect to post-login destination if already
 *   signed in (honors ?next=); fallback /app for coaches, /scout for
 *   recruiters, /me for athletes
 * - everything else is public
 *
 * Also refreshes the Supabase auth cookie on every request so sessions
 * stay alive across SSR + client navigations.
 */
/**
 * State codes where the scout / recruiter feature is geo-blocked at the
 * edge until per-state compliance work is complete:
 *
 *   CA — SOPIPA (Cal. Bus. & Prof. Code §22584) restricts ed-tech
 *        operators from amassing student profiles for non-K-12 purposes.
 *        Our scout/recruiter feature falls under that restriction and
 *        we don't yet have the carve-out infrastructure.
 *   NY — Education Law 2-d / Part 121 imposes Bill of Rights, DPA,
 *        Data Protection Officer, and 7-day breach notification
 *        requirements that we don't yet meet.
 *
 * The block is at the edge so users in those states never reach the
 * scout signup or discovery surfaces. Coach + player flows are
 * unaffected — the team OS continues to work.
 */
const SCOUT_GEO_BLOCKED_REGIONS: ReadonlySet<string> = new Set(["CA", "NY"]);

/**
 * Read Vercel's edge geolocation header. Returns the two-letter US
 * state code (e.g. "CA") or null when unavailable (local dev,
 * non-Vercel deploys, IP couldn't be geolocated).
 */
function vercelRegion(req: NextRequest): string | null {
  const r = req.headers.get("x-vercel-ip-country-region");
  if (!r) return null;
  return r.trim().toUpperCase();
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // Geo-block: scout signup + discovery in CA + NY. Routes covered:
  //   /scout/setup       — scout/recruiter onboarding
  //   /scout/discover    — flag-gated discovery search
  //   /scout/discover/*  — any future sub-pages
  //
  // /scout/* OTHER than these routes (existing recruiter system: lists,
  // outreach, searches) is NOT blocked — those are existing recruiter
  // accounts that pre-date the geo-restriction. New recruiter setups in
  // restricted states are blocked at /scout/setup.
  const isGeoBlockedRoute =
    pathname === "/scout/setup" ||
    pathname.startsWith("/scout/discover");
  if (isGeoBlockedRoute) {
    const region = vercelRegion(req);
    if (region && SCOUT_GEO_BLOCKED_REGIONS.has(region)) {
      const url = req.nextUrl.clone();
      url.pathname = "/scout/unavailable";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Demo continuity: when a visitor inside /demo clicks something that
  // links to /app/* (Hub → "Open practice plan", roster row → game
  // detail, etc.), don't bounce them to /login — rewrite the URL to
  // the equivalent /demo/* path instead so the tour stays seamless.
  // Paths without a /demo mirror fall through to the /demo/[...rest]
  // catch-all which renders a friendly "not in demo" page.
  if (pathname.startsWith("/app")) {
    const referer = req.headers.get("referer") ?? "";
    let fromDemo = false;
    try {
      if (referer) {
        const refPath = new URL(referer).pathname;
        fromDemo = refPath === "/demo" || refPath.startsWith("/demo/");
      }
    } catch {
      /* malformed referer — ignore */
    }
    if (fromDemo) {
      const url = req.nextUrl.clone();
      const rest = pathname.slice("/app".length); // "" for /app, "/practice" for /app/practice
      url.pathname = "/demo" + rest;
      return NextResponse.redirect(url);
    }
  }

  // Fast path: most routes don't need auth at all (marketing, demo,
  // public profiles, public games, legal). Skip the Supabase round-trip
  // entirely — middleware previously called auth.getUser() on EVERY
  // request, adding ~100-300ms to every page load (marketing included).
  const requiresAuth =
    pathname.startsWith("/app") ||
    pathname.startsWith("/me") ||
    pathname.startsWith("/scout");
  const guestOnly = pathname === "/login" || pathname === "/signup";
  if (!requiresAuth && !guestOnly) {
    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (requiresAuth && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (guestOnly && user) {
    // If the visitor arrived with a ?next= (e.g. from a claim or
    // invite link), honor that. Otherwise default to /app.
    const nextParam = req.nextUrl.searchParams.get("next");
    const url = req.nextUrl.clone();
    url.pathname = nextParam && nextParam.startsWith("/") ? nextParam : "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Skip asset paths and API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
