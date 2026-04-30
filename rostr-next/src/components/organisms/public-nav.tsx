import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSessionUser, initialsFrom, displayName } from "@/lib/auth";
import { Avatar } from "@/components/atoms/avatar";
import { LogoMark } from "@/components/atoms/logo";

/**
 * PublicNav — organisms/public-nav
 *
 * SaaS pattern: role-agnostic marketing nav.
 * - Signed-out: Product / Pricing / For coaches · Sign in · Start free
 * - Signed-in:  Product / Pricing / For coaches · <avatar> · Open app
 *
 * Used on / (landing) and /p/[handle] (public profile).
 */
export async function PublicNav({ sticky = false }: { sticky?: boolean }) {
  const user = await getSessionUser();
  const name = displayName(user);
  return (
    <nav
      className={
        "border-b border-hair bg-paper " +
        (sticky ? "sticky top-0 z-[20] backdrop-blur" : "")
      }
    >
      {/* Tighter horizontal padding + height on mobile, original at md+.
          The 4 inline marketing links overflow tight phone widths, so
          they're hidden below md. Mobile users get to those sections by
          scrolling the page or tapping the sticky bottom CTA. */}
      <div className="max-w-layout-marketing mx-auto px-4 sm:px-6 md:px-7 h-[52px] md:h-[60px] flex items-center">
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-2.5 font-display text-[16px] sm:text-[18px] font-bold"
        >
          <LogoMark size="sm" variant="dark" />
          rostr
        </Link>
        <div className="ml-7 hidden md:flex gap-5 text-[13.5px] text-ink-2 font-medium">
          <Link href="/#tour" className="hover:text-ink">Product</Link>
          <Link href="/#pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/#audiences" className="hover:text-ink">For coaches</Link>
          <Link href="/#flywheel" className="hover:text-ink">For athletes</Link>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/me"
                className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink px-1"
              >
                <Avatar size="sm" color="dirt" initials={initialsFrom(name)} />
                <span className="hidden md:inline">{name}</span>
              </Link>
              <Link
                href="/app"
                className="inline-flex items-center gap-1.5 h-9 px-3 sm:h-[34px] sm:px-3.5 bg-ink hover:bg-red text-white rounded-full sm:rounded-sm text-[12.5px] sm:text-[13px] font-semibold transition-colors active:scale-[0.96]"
              >
                Open app <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[12.5px] sm:text-[13px] text-ink-2 hover:text-ink px-2 py-1.5"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center h-9 px-3 sm:h-[34px] sm:px-3.5 bg-red hover:bg-red/90 text-white rounded-full sm:rounded-sm text-[12.5px] sm:text-[13px] font-semibold transition-colors active:scale-[0.96]"
              >
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
