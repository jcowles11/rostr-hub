import Link from "next/link";
import { Check, ArrowRight, Trophy, Eye, Search } from "lucide-react";
import { PublicNav } from "@/components/organisms/public-nav";

/**
 * /pricing — public marketing pricing page.
 *
 * Three-tier model from ROSTR_NORTH_STAR.md:
 *   Program — coaches pay, runs the team OS
 *   Family  — parents pay, premium player profile + recruiter access
 *   Scout   — recruiters pay, search the verified-data layer
 *
 * Stripe checkout is intentionally NOT wired this iteration. The CTAs
 * route to /signup with a `plan=` param so the pricing intent is
 * captured at signup; we'll convert at the next step once Stripe price
 * IDs are configured.
 */

export const metadata = {
  title: "Pricing · Rostr",
  description:
    "Rostr is the operating system for high-school sports programs. Coaches run the team. Parents access verified profiles. Recruiters find verified athletes.",
};

const PROGRAM_FEATURES = [
  "Roster, tryouts, practice planner, live game scoring",
  "AI Assistant Coach (practice plans, lineup suggestions)",
  "Multi-coach access with role permissions",
  "Public game viewer + iCal feed for parents",
  "Email + chat support",
];

const FAMILY_FEATURES = [
  "Verified player profile with coach-vouched stats",
  "Highlight clip uploads (YouTube / Hudl / TikTok / IG)",
  "Per-field privacy controls + parental consent flow",
  "Direct messages with college recruiters",
  "Profile visibility toggle for scout discovery",
];

const SCOUT_FEATURES = [
  "Search verified athletes by position, class, region",
  "Per-player Verified Data Points + recency",
  "Saved searches with new-match alerts (coming soon)",
  "Direct outreach via the recruiter inbox",
  "Filter on coach-verified data only",
];

export default function PricingPage() {
  return (
    <div className="bg-paper min-h-[100dvh]">
      <PublicNav />

      <div className="max-w-layout-marketing mx-auto px-4 sm:px-6 lg:px-7 py-12 sm:py-16">
        <div className="text-center max-w-[640px] mx-auto">
          <h1 className="font-display text-[36px] sm:text-[48px] font-bold tracking-[-0.03em] leading-tight">
            One product, three audiences,
            <br className="hidden sm:block" />{" "}
            <span className="text-red">layered pricing.</span>
          </h1>
          <p className="mt-4 text-[15px] sm:text-[17px] text-ink-2 leading-relaxed">
            Coaches run the team. Parents control what their kid shares.
            Recruiters search verified data. Each tier pays for what they get —
            none subsidize the others.
          </p>
        </div>

        <div className="mt-12 sm:mt-16 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <PricingCard
            tier="Program"
            tagline="The coach's daily OS"
            price="$99"
            interval="/ month per program"
            yearly="or $999/year — saves 2 months"
            icon={<Trophy className="w-5 h-5" />}
            tone="bg-red text-white"
            ctaLabel="Start a 30-day free trial"
            ctaHref="/signup?plan=program"
            features={PROGRAM_FEATURES}
            footnote="Pro tip: pilot through pre-season tryouts. Most coaches commit before the first game."
          />
          <PricingCard
            tier="Family"
            tagline="Premium athlete profile"
            price="$10"
            interval="/ month per athlete"
            yearly="or $59/year — saves $61"
            icon={<Eye className="w-5 h-5" />}
            tone="bg-grass text-white"
            ctaLabel="Add my athlete's profile"
            ctaHref="/signup?plan=family"
            features={FAMILY_FEATURES}
            highlighted
            footnote="The first family month is free when your coach is on Rostr."
          />
          <PricingCard
            tier="Scout"
            tagline="College + recruiter access"
            price="$499"
            interval="/ month per program"
            yearly="Volume + agency tiers available"
            icon={<Search className="w-5 h-5" />}
            tone="bg-ink text-white"
            ctaLabel="Request access"
            ctaHref="/signup?plan=scout"
            features={SCOUT_FEATURES}
            footnote="College programs only at launch. Independent recruiters and agencies on the waitlist. Not currently available in California or New York while we complete state-specific compliance work."
          />
        </div>

        <section className="mt-16 max-w-[760px] mx-auto bg-card border border-hair rounded-2xl p-6 sm:p-8">
          <h2 className="font-display text-[20px] sm:text-[22px] font-semibold tracking-tight">
            What you don&apos;t pay for
          </h2>
          <ul className="mt-3 space-y-2 text-[14px] text-ink-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-grass mt-1 shrink-0" />
              <span>
                <strong>Public game viewer</strong> for parents and friends.
                Always free, no account required.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-grass mt-1 shrink-0" />
              <span>
                <strong>iCal feed</strong> so any parent can subscribe to
                practices + games in Apple/Google Calendar.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-grass mt-1 shrink-0" />
              <span>
                <strong>Read-only player profile</strong> if a coach has
                added the athlete to their roster. The premium tier
                unlocks the editor + scout discovery.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-grass mt-1 shrink-0" />
              <span>
                <strong>Privacy by default.</strong> Every minor profile
                requires parental consent before anything is publicly
                visible. No exceptions, no upsells.
              </span>
            </li>
          </ul>
        </section>

        <section className="mt-16 text-center max-w-[640px] mx-auto">
          <h2 className="font-display text-[20px] sm:text-[24px] font-semibold tracking-tight">
            Have a question that doesn&apos;t fit a tier?
          </h2>
          <p className="mt-2 text-[14px] text-ink-2">
            Athletic department, multi-program, school district licensing,
            data partnerships — we want to talk.
          </p>
          <a
            href="mailto:hello@rostr.app"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-ink text-paper px-5 py-2.5 text-[14px] font-bold transition active:scale-[0.97]"
          >
            hello@rostr.app
            <ArrowRight className="w-4 h-4" />
          </a>
        </section>
      </div>
    </div>
  );
}

function PricingCard({
  tier,
  tagline,
  price,
  interval,
  yearly,
  icon,
  tone,
  features,
  ctaLabel,
  ctaHref,
  highlighted,
  footnote,
}: {
  tier: string;
  tagline: string;
  price: string;
  interval: string;
  yearly?: string;
  icon: React.ReactNode;
  tone: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  footnote?: string;
}) {
  return (
    <div
      className={
        "bg-card border rounded-2xl p-6 sm:p-7 flex flex-col " +
        (highlighted
          ? "border-grass shadow-[0_8px_28px_-10px_rgba(47,125,79,0.35)] ring-1 ring-grass/15"
          : "border-hair")
      }
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className={"w-9 h-9 rounded-xl flex items-center justify-center " + tone}
        >
          {icon}
        </span>
        <div>
          <div className="font-display text-[16px] font-bold tracking-tight">
            {tier}
          </div>
          <div className="text-[11px] text-ink-3">{tagline}</div>
        </div>
      </div>

      <div className="mt-3 mb-1">
        <span className="font-display text-[36px] font-bold tracking-tight">
          {price}
        </span>
        <span className="text-[13px] text-ink-3 ml-1">{interval}</span>
      </div>
      {yearly && <div className="text-[11.5px] text-ink-3 mb-4">{yearly}</div>}

      <ul className="mt-3 space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-ink-2">
            <Check className="w-4 h-4 text-grass mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={
          "mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl font-bold text-[14px] py-2.5 px-4 " +
          "transition active:scale-[0.97] " +
          (highlighted
            ? "bg-grass text-white shadow-[0_4px_14px_-4px_rgba(47,125,79,0.5)]"
            : "bg-ink text-paper")
        }
      >
        {ctaLabel}
        <ArrowRight className="w-4 h-4" />
      </Link>
      {footnote && (
        <p className="mt-3 text-[11px] text-ink-3 leading-snug">{footnote}</p>
      )}
    </div>
  );
}
