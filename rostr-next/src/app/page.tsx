import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PublicNav } from "@/components/organisms/public-nav";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

/**
 * / — Marketing landing page.
 * Draws from handoff/designs/01_Landing.html.
 * Spec: handoff/SCREENS.md §1.
 */
export default function LandingPage() {
  return (
    <div className="bg-paper min-h-screen">
      <PublicNav sticky />
      <Hero />
      <ProofStrip />
      <Problem />
      <Tour />
      <Audiences />
      <Flywheel />
      <AI />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="py-14 md:py-18 relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="grid md:grid-cols-2 gap-14 items-center">
          <div>
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red flex items-center gap-2 mb-[18px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red" />
              Built by a coach, for coaches
            </div>
            <h1 className="font-display font-semibold leading-[0.98] tracking-[-0.04em] text-[52px] md:text-[68px] mb-6">
              The operating system for{" "}
              <span className="relative inline-block">
                coaches.
                <span className="absolute left-0 right-0 -bottom-0.5 h-3 bg-red/20 -z-10 rounded" />
              </span>
            </h1>
            <p className="text-[19px] leading-relaxed text-ink-2 mb-7 max-w-[520px]">
              One app for tryouts, roster, practice plans, lineups, parent comms — and a
              player profile that every athlete actually wants to have. Built for high
              school and elite club programs.
            </p>
            <div className="flex gap-3 items-center mb-5 flex-wrap">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-[22px] py-3.5 bg-red hover:bg-red/90 text-white rounded-sm text-[15px] font-semibold transition-colors"
              >
                Start free trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-[22px] py-3.5 bg-card border border-hair hover:border-ink text-ink rounded-sm text-[15px] font-semibold transition-colors"
              >
                See the product
              </Link>
            </div>
            <div className="flex gap-5 text-[12.5px] text-ink-3 flex-wrap">
              <div>
                <b className="text-ink font-bold font-mono">HS + club</b> purpose-built
              </div>
              <div>
                <b className="text-ink font-bold font-mono">Every player</b> gets a profile
              </div>
              <div>
                <b className="text-ink font-bold font-mono">$0</b> forever for players
              </div>
            </div>
          </div>
          <HeroShot />
        </div>
      </div>
    </section>
  );
}

function HeroShot() {
  return (
    <div className="relative min-h-[480px] hidden md:block">
      {/* Main dashboard card */}
      <div className="absolute inset-0 bg-card border border-hair rounded-lg shadow-elev overflow-hidden">
        <div className="bg-ink text-white/80 px-5 py-3 flex items-center gap-2.5 text-[11px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-red" />
          Lincoln HS · Baseball · Varsity
          <span className="ml-auto font-mono text-[10px] text-white/50 tracking-[0.08em]">
            TODAY · APR 21
          </span>
        </div>
        <div className="p-6">
          <div className="type-label">Command center</div>
          <div className="font-display text-[24px] font-semibold tracking-tight mt-0.5">
            Pre-practice huddle
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <MiniStat label="Available" value="22" />
            <MiniStat label="Limited" value="2" />
            <MiniStat label="Out" value="1" valueColor="text-red" />
          </div>
          <div className="mt-4 text-[11px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2">
            Today&apos;s focus
          </div>
          <FocusRow n={1} text="Situational hitting · runners on corners" chips={["20 min", "Field A", "Coach Ruiz"]} active />
          <FocusRow n={2} text="Bullpen rotation · 4 pitchers" />
          <FocusRow n={3} text="Base running · 2nd-to-home reads" />
        </div>
      </div>
      {/* Scout card floating */}
      <div className="absolute -right-6 top-24 bg-ink text-white rounded-md p-4 w-[260px] shadow-elev border border-white/10">
        <div className="text-[10px] text-white/50 font-bold tracking-[0.1em]">
          SCOUT · UNC BASEBALL
        </div>
        <div className="font-display text-[15px] font-semibold tracking-tight mt-0.5">
          LHH · CF · 85+ mph · &lt;6.9 60yd
        </div>
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-red flex items-center justify-center text-[11px] font-bold">
            MJ
          </span>
          <div>
            <div className="text-[12px] font-semibold">Marcus Johnson</div>
            <div className="font-mono text-[10px] text-white/55">
              Lincoln HS · Sr · .372 BA
            </div>
          </div>
          <div className="ml-auto font-mono text-[14px] font-semibold text-red">86</div>
        </div>
      </div>
      {/* Phone mock */}
      <div className="absolute -bottom-3 -left-6 w-[168px] rounded-xl overflow-hidden bg-ink border-[6px] border-ink shadow-phone">
        <div className="bg-ink text-white p-3">
          <div className="text-[8.5px] text-white/50 font-bold tracking-[0.08em]">
            SCORING · LIVE
          </div>
          <div className="font-display text-[13px] font-semibold mt-0.5">
            Tryout #47
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-red flex items-center justify-center text-[9px] font-bold font-mono">
              #21
            </span>
            <div>
              <div className="text-[10px] font-semibold">Jordan Kim</div>
              <div className="text-[8px] text-white/50">SS · Jr</div>
            </div>
          </div>
        </div>
        <div className="bg-card p-3 text-ink">
          <div className="text-[8.5px] font-bold text-ink-3 uppercase tracking-[0.06em]">
            60 YD DASH
          </div>
          <div className="font-mono text-[30px] font-semibold tracking-[-0.02em]">
            6.84<span className="text-[12px] text-ink-3">s</span>
          </div>
          <div className="flex gap-1 mt-2">
            <div className="flex-1 h-6 bg-paper-deep rounded-xs flex items-center justify-center text-[10px] font-bold text-ink-2">
              −
            </div>
            <div className="flex-1 h-6 bg-ink text-white rounded-xs flex items-center justify-center text-[10px] font-bold">
              SAVE
            </div>
            <div className="flex-1 h-6 bg-paper-deep rounded-xs flex items-center justify-center text-[10px] font-bold text-ink-2">
              +
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  valueColor = "text-ink",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-paper border border-hair rounded-md p-2.5">
      <div className={cn("font-mono text-[22px] font-semibold", valueColor)}>{value}</div>
      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-0.5">
        {label}
      </div>
    </div>
  );
}

function FocusRow({
  n,
  text,
  chips,
  active,
}: {
  n: number;
  text: string;
  chips?: string[];
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-paper border border-hair rounded-md p-3",
        n > 1 && "mt-2",
      )}
    >
      <div className="flex items-center gap-2.5 text-[13px] font-semibold">
        <span
          className={cn(
            "w-7 h-7 rounded-sm flex items-center justify-center text-[11px] font-bold font-mono shrink-0",
            active ? "bg-red text-white" : "bg-paper-deep text-ink-2",
          )}
        >
          {n}
        </span>
        {text}
      </div>
      {chips && (
        <div className="flex gap-1.5 mt-2 text-[10.5px] flex-wrap ml-[38px]">
          <span className="px-2 py-0.5 bg-red-soft text-red rounded-xs font-semibold">
            {chips[0]}
          </span>
          {chips.slice(1).map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 bg-paper-deep text-ink-3 rounded-xs font-semibold"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Proof strip ───────────────────────────────────────────────

function ProofStrip() {
  return (
    <div className="border-y border-hair bg-card">
      <div className="max-w-[1240px] mx-auto px-8 py-5 flex items-center gap-8 flex-wrap">
        <div className="type-label">Built for the way HS programs actually run</div>
        <div className="flex gap-7 text-[13px] text-ink-2 font-medium flex-wrap">
          <span>40+ player rosters</span>
          <span>V / JV / Frosh</span>
          <span>60-game seasons</span>
          <span>Tryout weeks</span>
          <span>College recruiting</span>
        </div>
      </div>
    </div>
  );
}

// ── Problem ───────────────────────────────────────────────────

function Problem() {
  return (
    <section className="py-20">
      <div className="max-w-[1240px] mx-auto px-8 max-w-[780px]">
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          The problem
        </div>
        <h2 className="font-display font-semibold text-[40px] md:text-[52px] leading-[1.05] tracking-[-0.03em] mb-5">
          HS coaches run programs on
          <br />
          Sheets, Word docs, and group texts.
        </h2>
        <p className="text-[17px] leading-relaxed text-ink-2">
          A HS baseball coach manages 60+ kids across Varsity, JV, and Freshman. Tryouts
          in Excel. Practice plans in Word. Lineups on paper. Depth chart in a notes app.
          Parent updates by group text. No connection between any of it — and no record
          of a kid&apos;s development when they graduate.
        </p>
      </div>
    </section>
  );
}

// ── Product tour ──────────────────────────────────────────────

function Tour() {
  const features = [
    {
      label: "Command center",
      title: "Your program, one glance",
      copy:
        "Today's availability, this week's schedule, the parent message that needs a reply. A real home for the program — not a screenshot-able mess of spreadsheets.",
      bullet: [
        "Availability tracking tied to practice groups",
        "Schedule that syncs with parents automatically",
        "Season record, team BA, ERA trending live",
      ],
    },
    {
      label: "Roster + recruiting",
      title: "Every player gets a profile — without anyone asking",
      copy:
        "You enter a player once. The career that follows — every metric, every season, every verified stat — is theirs. And it's discoverable by college coaches the moment they want it to be.",
      bullet: [
        "Verified-by-coach measurables (your name on the stat)",
        "Shareable public profile at rostr.app/<handle>",
        "College recruiter routing follows NCAA compliance",
      ],
    },
    {
      label: "Practice planner",
      title: "Practice plans your assistants can actually run",
      copy:
        "Drag-and-drop time blocks, auto-assigned coaches, field-runner mode on your phone when you're on the field.",
      bullet: [
        "Weekly templates + per-day adjustments",
        "Field map with zones + parallel groups",
        "Phone field-runner with offline queue",
      ],
    },
    {
      label: "Tryouts",
      title: "Finalize your roster in a way nobody can dispute",
      copy:
        "Station-based scoring on phones. Live rankings on your laptop at the field. Auto-suggested verdicts tied to a real cutoff — with a clear paper trail for every one.",
      bullet: [
        "Station coaches score on phones, you watch the leaderboard",
        "Composite scoring you control, not hidden",
        "Verdict notifications to athletes after finalization",
      ],
    },
  ];
  return (
    <section id="tour" className="py-20 bg-card border-y border-hair scroll-mt-16">
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          Product tour
        </div>
        <h2 className="font-display font-semibold text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-14 max-w-[720px]">
          Four surfaces. One program.
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((f) => (
            <div key={f.title} className="p-7 border border-hair rounded-lg bg-paper">
              <div className="type-label !text-red">{f.label}</div>
              <h3 className="font-display text-[22px] font-semibold tracking-tight mt-2 mb-3 leading-snug">
                {f.title}
              </h3>
              <p className="text-[14px] text-ink-2 mb-4 leading-relaxed">{f.copy}</p>
              <ul className="space-y-1.5 text-[13px] text-ink-2">
                {f.bullet.map((b) => (
                  <li key={b} className="flex gap-2 items-start">
                    <Check className="w-3.5 h-3.5 text-grass shrink-0 mt-1" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Audiences ────────────────────────────────────────────────

function Audiences() {
  const audiences = [
    { label: "Coaches", title: "Run your whole program in one place", bullets: ["Ops, tryouts, recruiting all linked", "Assistants on the same page automatically", "Works on the field, not just the desk"] },
    { label: "Athletes", title: "The profile that gets you seen", bullets: ["Career-long metric history", "Verified by your coaches", "Free. Always."] },
    { label: "Recruiters", title: "Source talent from the source", bullets: ["Filter by measurables + class year + region", "Coach-verified data, not self-reported", "Compliance-aware contact routing"] },
  ];
  return (
    <section id="audiences" className="py-20 scroll-mt-16">
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          Who it&apos;s for
        </div>
        <h2 className="font-display font-semibold text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-14 max-w-[680px]">
          Three audiences. One data pipeline.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {audiences.map((a) => (
            <div key={a.label} className="p-7 bg-card border border-hair rounded-lg">
              <div className="type-label !text-red">{a.label}</div>
              <h3 className="font-display text-[20px] font-semibold tracking-tight mt-2 mb-3.5 leading-snug">
                {a.title}
              </h3>
              <ul className="space-y-1.5 text-[13px] text-ink-2">
                {a.bullets.map((b) => (
                  <li key={b} className="flex gap-2 items-start">
                    <Check className="w-3.5 h-3.5 text-grass shrink-0 mt-1" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Flywheel ─────────────────────────────────────────────────

function Flywheel() {
  return (
    <section id="flywheel" className="py-20 bg-card border-y border-hair scroll-mt-16">
      <div className="max-w-[1240px] mx-auto px-8 grid md:grid-cols-[1fr_auto] gap-12 items-center">
        <div className="max-w-[620px]">
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
            Why it compounds
          </div>
          <h2 className="font-display font-semibold text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-5">
            The coach saves hours.
            <br />
            The player gets found.
            <br />
            The data builds a moat.
          </h2>
          <p className="text-[16px] text-ink-2 leading-relaxed mb-6">
            Every practice, every game, every tryout builds a real record of a high
            school athlete&apos;s career. That record is the athlete&apos;s forever.
            It&apos;s also what makes Rostr the only place college coaches can source
            HS-level talent at scale.
          </p>
          <Link
            href="#pricing"
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-red hover:underline"
          >
            See pricing <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="bg-paper border border-hair rounded-lg p-7 max-w-sm space-y-3">
          <FlywheelStep n={1} label="Coach runs the program in Rostr" meta="Tryouts · roster · practice · games" />
          <FlywheelStep n={2} label="Player accumulates verified career data" meta="Four years of metrics · highlights" />
          <FlywheelStep n={3} label="Profile becomes scoutable" meta="Public at rostr.app/<handle>" />
          <FlywheelStep n={4} label="Recruiters subscribe for access" meta="Rostr becomes the source" active />
        </div>
      </div>
    </section>
  );
}

function FlywheelStep({
  n,
  label,
  meta,
  active,
}: {
  n: number;
  label: string;
  meta: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span
        className={cn(
          "w-7 h-7 rounded-sm flex items-center justify-center text-[11px] font-bold font-mono shrink-0",
          active ? "bg-red text-white" : "bg-paper-deep text-ink-2",
        )}
      >
        {n}
      </span>
      <div>
        <div className="text-[13.5px] font-semibold">{label}</div>
        <div className="font-mono text-[10.5px] text-ink-3 mt-0.5">{meta}</div>
      </div>
    </div>
  );
}

// ── AI ───────────────────────────────────────────────────────

function AI() {
  return (
    <section className="py-20">
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="bg-ink text-white rounded-xl p-12 md:p-16 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(200,58,58,.3), transparent 65%)",
            }}
          />
          <div className="relative max-w-[680px]">
            <div className="inline-flex items-center gap-1.5 text-[10px] text-red font-bold uppercase tracking-[0.14em]">
              <span className="w-1.5 h-1.5 rounded-full bg-red" />
              AI Co-coach
            </div>
            <h2 className="font-display font-semibold text-[40px] md:text-[52px] leading-[1.05] tracking-[-0.03em] mt-3 mb-5">
              Your assistant coach that never sleeps.
            </h2>
            <p className="text-[17px] text-white/70 leading-relaxed mb-7">
              Ask for a practice plan for tonight&apos;s focus. Pull a Friday lineup
              against the opponent&apos;s left-handers. Draft a mid-season parent email.
              All grounded in your real program data — not a generic chatbot.
            </p>
            <div className="grid md:grid-cols-2 gap-2.5">
              {[
                "Build Friday lineup · vs Central",
                "Practice plan · bullpen day",
                "Scout opponent · last 5 games",
                "Draft parent email · tournament",
              ].map((p) => (
                <button
                  key={p}
                  className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-sm text-left text-[13.5px] transition-colors"
                >
                  <span>{p}</span>
                  <span className="text-red text-[11px] font-semibold font-mono">2 min</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ──────────────────────────────────────────────────

function Pricing() {
  const tiers = [
    {
      name: "Coach",
      price: "$49",
      period: "/ season / coach",
      description: "Everything to run a team — roster, practice, tryouts, games, profiles.",
      bullet: [
        "Unlimited players",
        "Unlimited practices + games",
        "Public profiles for every player",
        "CSV bi-directional with GameChanger",
      ],
      cta: "Start free trial",
      emphasis: true,
    },
    {
      name: "Athlete",
      price: "Free",
      period: "forever",
      description: "The profile and the career record — always free for the player.",
      bullet: [
        "Public profile at rostr.app/<handle>",
        "Career-long metric history",
        "Highlight uploads (up to 50)",
        "Claim at any time from any team",
      ],
      cta: "Claim your profile",
    },
    {
      name: "Recruiter",
      price: "$2,400",
      period: "/ year / seat",
      description: "Source, save, and contact HS athletes with coach-verified data.",
      bullet: [
        "Filter by measurables + class + region",
        "Saved prospects + notes",
        "Compliance-aware messaging",
        "Multiple seats per program",
      ],
      cta: "Request access",
    },
  ];
  return (
    <section id="pricing" className="py-20 bg-card border-y border-hair">
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          Pricing
        </div>
        <h2 className="font-display font-semibold text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-3 max-w-[680px]">
          Free for athletes.
          <br />
          Paid where it pays for itself.
        </h2>
        <p className="text-[16px] text-ink-2 mb-14 max-w-[620px]">
          Athletes never pay. Coaches pay a season fee. Recruiters pay for the funnel.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "p-7 rounded-lg",
                t.emphasis
                  ? "bg-ink text-white border border-ink shadow-elev"
                  : "bg-paper border border-hair",
              )}
            >
              <div
                className={cn(
                  "type-label",
                  t.emphasis ? "!text-red" : "!text-red",
                )}
              >
                {t.name}
              </div>
              <div className="flex items-baseline gap-2 mt-2.5">
                <span className="font-display text-[44px] font-semibold tracking-[-0.03em] leading-none">
                  {t.price}
                </span>
                <span
                  className={cn(
                    "text-[13px]",
                    t.emphasis ? "text-white/60" : "text-ink-3",
                  )}
                >
                  {t.period}
                </span>
              </div>
              <p
                className={cn(
                  "mt-3 text-[13.5px] leading-relaxed",
                  t.emphasis ? "text-white/75" : "text-ink-2",
                )}
              >
                {t.description}
              </p>
              <ul className="mt-5 space-y-2 text-[13px]">
                {t.bullet.map((b) => (
                  <li key={b} className="flex gap-2 items-start">
                    <Check
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 mt-1",
                        t.emphasis ? "text-red" : "text-grass",
                      )}
                    />
                    <span className={t.emphasis ? "text-white/90" : "text-ink-2"}>{b}</span>
                  </li>
                ))}
              </ul>
              <button
                className={cn(
                  "mt-7 w-full rounded-sm h-[42px] text-[13.5px] font-semibold",
                  t.emphasis
                    ? "bg-red text-white hover:bg-red/90"
                    : "bg-ink text-white hover:bg-red",
                )}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section id="cta" className="py-24">
      <div className="max-w-[980px] mx-auto px-8 text-center">
        <h2 className="font-display font-semibold text-[44px] md:text-[60px] leading-[1.02] tracking-[-0.04em] mb-5">
          Run your program.
          <br />
          Build the career.
        </h2>
        <p className="text-[17px] text-ink-2 max-w-[580px] mx-auto mb-8 leading-relaxed">
          Start free during preseason. Have your full roster in by week one.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button variant="red" size="lg">
            <span className="text-[15px] px-2">Start free trial</span>
          </Button>
          <Button variant="secondary" size="lg">
            <span className="text-[15px] px-2">Book a demo</span>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-ink text-white pt-12 pb-8">
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <Link href="/" className="flex items-center gap-2.5 font-display text-[18px] font-bold">
              <span className="relative inline-flex w-[26px] h-[26px] rounded-sm bg-white text-ink items-center justify-center font-display text-[15px] font-bold brand-dashed">
                R
              </span>
              rostr
            </Link>
            <p className="mt-4 text-[12.5px] text-white/55 max-w-[220px] leading-relaxed">
              The operating system for coaches. Built for high school and elite club
              programs.
            </p>
          </div>
          {[
            { heading: "Product", links: ["Coach Hub", "Roster", "Practice planner", "Tryouts", "Profiles"] },
            { heading: "Company", links: ["About", "Built by a coach", "Careers", "Contact"] },
            { heading: "Resources", links: ["Pilot program", "Help center", "Privacy", "Terms"] },
          ].map((col) => (
            <div key={col.heading}>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/50">
                {col.heading}
              </div>
              <ul className="mt-4 space-y-2 text-[13px] text-white/75">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link href="#" className="hover:text-white">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-7 border-t border-white/10 flex items-center justify-between text-[11.5px] text-white/50 flex-wrap gap-4">
          <div>© {new Date().getFullYear()} Rostr Labs. Built by a coach.</div>
          <div className="font-mono">v0.1 · pilot</div>
        </div>
      </div>
    </footer>
  );
}
