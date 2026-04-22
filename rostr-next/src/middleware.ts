import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Auth middleware.
 * - /app/*, /me → require signed-in user (redirect to /login)
 * - /login, /signup → redirect to /app if already signed in
 * - everything else is public
 *
 * Also refreshes the Supabase auth cookie on every request so sessions
 * stay alive across SSR + client navigations.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

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

  const { pathname } = req.nextUrl;

  const requiresAuth =
    pathname.startsWith("/app") || pathname.startsWith("/me");
  const guestOnly = pathname === "/login" || pathname === "/signup";

  if (requiresAuth && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (guestOnly && user) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Skip asset paths and API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
