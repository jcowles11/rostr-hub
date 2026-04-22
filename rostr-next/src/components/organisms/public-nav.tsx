import Link from "next/link";

/**
 * PublicNav — organisms/public-nav
 * Used on public pages (landing, player profile) where the /app sidebar
 * doesn't apply. Matches the top nav in handoff/designs/04_Player_Profile.html
 * and 01_Landing.html.
 */
export function PublicNav({
  sticky = false,
}: {
  sticky?: boolean;
}) {
  return (
    <nav
      className={
        "border-b border-hair bg-paper " +
        (sticky ? "sticky top-0 z-[20] backdrop-blur" : "")
      }
    >
      <div className="max-w-layout-marketing mx-auto px-7 h-[60px] flex items-center">
        <Link href="/" className="flex items-center gap-2.5 font-display text-[18px] font-bold">
          <span className="relative inline-flex w-[26px] h-[26px] rounded-sm bg-ink text-red items-center justify-center font-display text-[15px] font-bold brand-dashed">
            R
          </span>
          rostr
        </Link>
        <div className="ml-7 flex gap-5 text-[13.5px] text-ink-2 font-medium">
          <Link href="#" className="hover:text-ink">Discover</Link>
          <Link href="#" className="hover:text-ink">Teams</Link>
          <Link href="#" className="hover:text-ink">Leaderboards</Link>
          <Link href="#" className="hover:text-ink">For coaches</Link>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="text-[13px] text-ink-2 hover:text-ink px-2">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center h-[34px] px-3.5 bg-red hover:bg-red/90 text-white rounded-sm text-[13px] font-semibold transition-colors"
          >
            Get your profile
          </Link>
        </div>
      </div>
    </nav>
  );
}
