import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PublicNav } from "@/components/organisms/public-nav";
import { LogoMark } from "@/components/atoms/logo";
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
              Stop running your team from a{" "}
              <span className="relative inline-block">
                spreadsheet.
                <span className="absolute left-0 right-0 -bottom-0.5 h-3 bg-red/20 -z-10 rounded" />
              </span>
            </h1>
            <p className="text-[19px] leading-relaxed text-ink-2 mb-7 max-w-[540px]">
              One app for the full lifecycle of your season — and beyond.
              Roster, practice plans, lineups, tryout scoring, parent comms,
              and a profile every player keeps for life. Built for the field,
              not the desk.
            </p>
            <div className="flex gap-3 items-center mb-5 flex-wrap">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-[22px] py-3.5 bg-red hover:bg-red/90 text-white rounded-sm text-[15px] font-semibold transition-colors"
              >
                Try it free <ArrowRight className="w-4 h-4" />
              </Link>
              {/* Now points to the static product tour (/demo) instead
                  of /app, which would just bounce to /login. The tour
                  uses fictional Lincoln HS data and is clearly labeled
                  so a prospect can scroll through the product before
                  committing to signup. */}
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-[22px] py-3.5 bg-card border border-hair hover:border-ink text-ink rounded-sm text-[15px] font-semibold transition-colors"
              >
                See the product tour
              </Link>
            </div>
            <div className="flex gap-5 text-[12.5px] text-ink-3 flex-wrap">
              <div>
                <b className="text-ink font-bold font-mono">Any team, any level</b>
              </div>
              <div>
                <b className="text-ink font-bold font-mono">Every player</b> gets a profile
              </div>
              <div>
                <b className="text-ink font-bold font-mono">Free</b> forever for players
              </div>
            </div>
          </div>
          <HeroShot />
        </div>
      </div>
    </section>
  );
}

/**
 * HeroShot — laptop frame (Coach Hub) + iPhone frame (tryout scoring).
 *
 * Pure CSS device mockups so prospects see the product on the actual
 * form factors a coach uses: a laptop in the office (Hub overview)
 * and a phone at the field (rapid tryout scoring). Replaces the
 * earlier floating-cards mock that didn't match any real device.
 */
function HeroShot() {
  return (
    // Container sized so the laptop (Team Home) is the dominant visual
    // and the iPhone (tryout scoring) sits clearly tucked in the bottom-
    // right corner WITHOUT covering the laptop's screen content.
    <div className="relative min-h-[520px] hidden md:block">
      {/* ── Laptop showing Team Home (/app) ─────────────────────── */}
      <div className="absolute inset-0">
        {/* Laptop bezel + screen */}
        <div className="bg-ink rounded-t-lg p-2 shadow-elev">
          <div className="bg-card rounded-md overflow-hidden border border-white/5">
            {/* Browser chrome */}
            <div className="bg-paper-deep px-3 py-1.5 flex items-center gap-1.5 border-b border-hair-2">
              <span className="w-2 h-2 rounded-full bg-red/40" />
              <span className="w-2 h-2 rounded-full bg-amber/50" />
              <span className="w-2 h-2 rounded-full bg-grass/50" />
              <span className="ml-3 px-2 py-0.5 bg-card rounded-sm text-[9px] font-mono text-ink-3 border border-hair-2">
                rostr.app/app
              </span>
            </div>
            {/* Screen content — Team Home (Coach Hub at /app) */}
            <div className="bg-paper">
              {/* Program header strip — shows the full program scale
                  (4 teams, ~64 players) instead of pretending it's a
                  single Varsity squad. Coaches need to recognize the
                  scope this app is built for. */}
              <div className="bg-ink text-white px-4 py-2.5 flex items-center gap-2 text-[11px]">
                <span className="w-5 h-5 rounded-sm bg-red flex items-center justify-center text-[9px] font-bold">
                  LH
                </span>
                <span className="font-bold tracking-tight">Lincoln HS Baseball</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70">4 teams · 64 players</span>
                <span className="ml-auto font-mono text-[9px] text-white/50 tracking-[0.08em]">
                  TUE · APR 21
                </span>
              </div>
              <div className="p-5">
                {/* Greeting + record */}
                <div className="flex items-end gap-3 mb-4">
                  <div>
                    <div className="font-display text-[22px] font-semibold tracking-tight leading-tight">
                      Good morning, Coach.
                    </div>
                    <div className="text-[11px] text-ink-3 mt-0.5">
                      3 practices today across V/JV/Soph · V game tomorrow
                    </div>
                  </div>
                  <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.04em]">
                    V 8-3 · W2
                  </span>
                </div>

                {/* Today's events */}
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
                  Today
                </div>
                <div className="space-y-1.5 mb-4">
                  <HubEventRow
                    color="grass"
                    label="PRAC"
                    title="Practice — situational hitting"
                    sub="3:30 PM · Field A · 22 players"
                  />
                </div>

                {/* This week */}
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
                  This week
                </div>
                <div className="space-y-1.5 mb-4">
                  <HubEventRow
                    color="red"
                    label="GAME"
                    title="vs Central Hawks · conference"
                    sub="Wed 5:00 PM · Home"
                    emphasis
                  />
                  <HubEventRow
                    color="red"
                    label="GAME"
                    title="@ Westfield Panthers"
                    sub="Sat 1:00 PM · Bus 11:15"
                  />
                  <HubEventRow
                    color="grass"
                    label="PRAC"
                    title="Light BP + pregame prep"
                    sub="Thu 3:30 PM · 90 min"
                  />
                </div>

                {/* Availability snapshot */}
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-2">
                  Availability
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Available" value="22" />
                  <MiniStat label="Limited" value="2" />
                  <MiniStat label="Out" value="1" valueColor="text-red" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Laptop base */}
        <div className="h-2 bg-ink rounded-b-2xl mx-[-12px]" />
        <div className="h-1 bg-ink/80 rounded-b mx-[-4px]" />
      </div>

      {/* ── iPhone (tryout scoring) ─────────────────────────────
          Sized + positioned so it's a clear secondary visual — tucked
          into the bottom-right outside the laptop screen, not overlapping
          its content. Realistic 9:19.5 aspect with notch + bezel. */}
      <div className="absolute -bottom-10 -right-2 w-[160px]">
        <div
          className="bg-ink rounded-[26px] p-1.5 border border-white/5"
          style={{
            boxShadow:
              "0 30px 60px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.45)",
          }}
        >
          <div className="bg-paper rounded-[20px] overflow-hidden relative aspect-[9/19.5]">
            {/* Notch */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[58px] h-[16px] bg-ink rounded-full z-10" />
            {/* Status bar */}
            <div className="px-3 pt-1 pb-0.5 flex items-center justify-between text-[7px] font-bold text-ink z-20 relative">
              <span>9:41</span>
              <span className="font-mono">●●●</span>
            </div>
            {/* Top bar */}
            <div className="bg-ink text-white px-2 py-1.5 flex items-center gap-1 mt-2">
              <span className="text-[6.5px] text-white/60 font-bold uppercase tracking-[0.08em] truncate">
                60-yard dash
              </span>
              <span className="ml-auto font-mono text-[7px] font-bold">
                12/18
              </span>
            </div>
            {/* Progress */}
            <div className="h-0.5 bg-ink/10">
              <div className="h-full bg-red" style={{ width: "67%" }} />
            </div>
            {/* Player hero */}
            <div className="px-2 py-1.5 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-sky text-white flex items-center justify-center text-[7px] font-bold">
                JK
              </span>
              <div className="min-w-0">
                <div className="font-display text-[9px] font-semibold tracking-tight truncate leading-tight">
                  Jordan Kim
                </div>
                <div className="font-mono text-[6.5px] text-ink-3 leading-tight">
                  #12 · SS
                </div>
              </div>
            </div>
            {/* Score readout */}
            <div className="mx-2 bg-card border border-hair rounded-sm p-1.5 text-center">
              <div className="text-[6px] font-bold uppercase tracking-[0.06em] text-ink-3">
                Time
              </div>
              <div className="font-mono font-bold text-[18px] tracking-[-0.02em] leading-none mt-0.5">
                6.84
                <span className="text-[8px] text-ink-3">s</span>
              </div>
            </div>
            {/* Keypad (3x3) */}
            <div className="px-2 py-1.5">
              <div className="grid grid-cols-3 gap-1">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
                  <div
                    key={k}
                    className="h-5 bg-card border border-hair rounded-xs flex items-center justify-center text-[9px] font-bold"
                  >
                    {k}
                  </div>
                ))}
              </div>
            </div>
            {/* Save */}
            <div className="px-2 pb-2">
              <div className="h-6 bg-red text-white rounded-xs flex items-center justify-center text-[8px] font-bold">
                Save &amp; next →
              </div>
            </div>
            {/* Home indicator */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[60px] h-0.5 bg-ink/30 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * HubEventRow — compact event row used inside the laptop's Team Home
 * mockup. Color-coded type badge + title + sub. Mirrors the actual
 * shape of the today/upcoming cards inside the real /app Hub.
 */
function HubEventRow({
  color,
  label,
  title,
  sub,
  emphasis,
}: {
  color: "red" | "grass";
  label: string;
  title: string;
  sub: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-md border",
        emphasis ? "border-red bg-red-soft/40" : "border-hair bg-paper",
      )}
    >
      <span
        className={cn(
          "px-1.5 py-0.5 rounded-xs text-[8.5px] font-bold uppercase tracking-[0.06em] shrink-0",
          color === "red" ? "bg-red text-white" : "bg-grass-dim text-grass",
        )}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold tracking-tight truncate">
          {title}
        </div>
        <div className="text-[10px] text-ink-3 truncate">{sub}</div>
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
        <div className="type-label">Built for the way real programs actually run</div>
        <div className="flex gap-7 text-[13px] text-ink-2 font-medium flex-wrap">
          <span>60+ player rosters</span>
          <span>4 teams per program</span>
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
          Coaches run programs on
          <br />
          Sheets, Word docs, and group texts.
        </h2>
        <p className="text-[17px] leading-relaxed text-ink-2">
          A HS baseball coach manages 60+ kids across 4 teams. Tryouts
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
      title: "Every player gets a profile",
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
      title: "Practice plans made in seconds",
      copy:
        "Tell the AI Assistant Coach your field constraint and tonight's focus, and it drafts a plan tailored to your roster + recent games. Tap drills from your library, drag-and-drop time blocks, run it from your phone at the field.",
      bullet: [
        "AI Assistant Coach drafts a plan in one tap",
        "Drill library + weekly templates + per-day adjustments",
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
    {
      label: "Coaches",
      title: "Run your whole program in one place",
      bullets: [
        "Tryouts, roster, practice plans, lineups — all linked",
        "Assistants on the same page automatically",
        "Designed for the field, not just the desk",
      ],
    },
    {
      label: "Athletes",
      title: "The profile that gets you seen",
      bullets: [
        "Career-long metric history",
        "Verified by your coaches",
        "Free. Always.",
      ],
    },
    {
      label: "Recruiters",
      title: "Source talent from the source",
      bullets: [
        "Filter by measurables + class year + region",
        "Coach-verified data, not self-reported",
        "Compliance-aware contact routing",
      ],
    },
  ];
  return (
    <section id="audiences" className="py-20 scroll-mt-16">
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          Who it&apos;s for
        </div>
        <h2 className="font-display font-semibold text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-3 max-w-[760px]">
          Built for every coach who runs a team.
        </h2>
        <p className="text-[16px] text-ink-2 max-w-[680px] mb-14 leading-relaxed">
          Youth and travel ball. Middle school and high school. Club, summer ball,
          and elite programs. If you have a roster and a schedule, this works for you.
        </p>
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
            See plans <ArrowRight className="w-4 h-4" />
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
              AI Assistant Coach
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
                <Link
                  key={p}
                  href="/signup"
                  className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-sm text-left text-[13.5px] transition-colors"
                >
                  <span>{p}</span>
                  <span className="text-red text-[11px] font-semibold font-mono">2 min</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ──────────────────────────────────────────────────

/**
 * Plans — three audience-scoped panels, no dollar amounts.
 *
 * Pricing for Coach + Recruiter is intentionally not on the marketing
 * site (we don't have public pricing yet). CTAs route to a "Talk to
 * sales" mailto so prospects can ask. Athlete tier is free forever
 * and CTAs straight to the signup flow.
 */
function Pricing() {
  const tiers = [
    {
      name: "Coach",
      tagline: "Run your team",
      description:
        "Everything to run a team — roster, practice plans, tryouts, games, lineups, parent comms.",
      bullet: [
        "Unlimited players, practices, and games",
        "Public profile for every player you coach",
        "Built for the field — phone-first",
        "AI assistant for practice plans + lineups",
      ],
      cta: "Talk to sales",
      ctaHref: "mailto:hello@rostr.app?subject=Rostr%20-%20coach%20account%20inquiry",
      emphasis: true,
    },
    {
      name: "Player",
      tagline: "Free, forever",
      description:
        "The profile and the career record — always free for the athlete.",
      bullet: [
        "Public profile at rostr.app/<handle>",
        "Career-long metric history",
        "Highlight uploads",
        "Claim at any time from any team",
      ],
      cta: "Claim your profile",
      ctaHref: "/signup?role=player",
      ctaIsLink: true,
    },
    {
      name: "Recruiter",
      tagline: "Talent funnel",
      description:
        "Source, save, and contact athletes with coach-verified data.",
      bullet: [
        "Filter by measurables + class + region",
        "Saved prospects + notes",
        "Compliance-aware messaging",
        "Multiple seats per program",
      ],
      cta: "Talk to sales",
      ctaHref: "mailto:hello@rostr.app?subject=Rostr%20-%20recruiter%20access%20inquiry",
    },
  ];
  return (
    <section id="pricing" className="py-20 bg-card border-y border-hair">
      <div className="max-w-[1240px] mx-auto px-8">
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          Plans
        </div>
        <h2 className="font-display font-semibold text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-3 max-w-[680px]">
          Free for athletes.
          <br />
          One conversation for everyone else.
        </h2>
        <p className="text-[16px] text-ink-2 mb-14 max-w-[620px]">
          Athletes never pay. Coaches and recruiters: drop us a line and we'll
          set you up — pricing depends on team size and what you need.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "p-7 rounded-lg flex flex-col",
                t.emphasis
                  ? "bg-ink text-white border border-ink shadow-elev"
                  : "bg-paper border border-hair",
              )}
            >
              <div className="type-label !text-red">{t.name}</div>
              {/* Tagline replaces the dollar block — keeps the visual
                  weight of a "price line" without quoting numbers. */}
              <div className="font-display text-[28px] font-semibold tracking-[-0.02em] leading-tight mt-2.5">
                {t.tagline}
              </div>
              <p
                className={cn(
                  "mt-3 text-[13.5px] leading-relaxed",
                  t.emphasis ? "text-white/75" : "text-ink-2",
                )}
              >
                {t.description}
              </p>
              <ul className="mt-5 space-y-2 text-[13px] flex-1">
                {t.bullet.map((b) => (
                  <li key={b} className="flex gap-2 items-start">
                    <Check
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 mt-1",
                        t.emphasis ? "text-red" : "text-grass",
                      )}
                    />
                    <span className={t.emphasis ? "text-white/90" : "text-ink-2"}>
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
              {t.ctaIsLink ? (
                <Link
                  href={t.ctaHref}
                  className={cn(
                    "mt-7 w-full inline-flex items-center justify-center rounded-sm h-[42px] text-[13.5px] font-semibold",
                    t.emphasis
                      ? "bg-red text-white hover:bg-red/90"
                      : "bg-ink text-white hover:bg-red",
                  )}
                >
                  {t.cta}
                </Link>
              ) : (
                <a
                  href={t.ctaHref}
                  className={cn(
                    "mt-7 w-full inline-flex items-center justify-center rounded-sm h-[42px] text-[13.5px] font-semibold",
                    t.emphasis
                      ? "bg-red text-white hover:bg-red/90"
                      : "bg-ink text-white hover:bg-red",
                  )}
                >
                  {t.cta}
                </a>
              )}
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
          Run your team.
          <br />
          Build the career.
        </h2>
        <p className="text-[17px] text-ink-2 max-w-[600px] mx-auto mb-8 leading-relaxed">
          Coaches: get in touch and we'll set you up. Players: claim your
          profile in 30 seconds — free, forever.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-[22px] py-3.5 bg-red hover:bg-red/90 text-white rounded-sm text-[15px] font-semibold transition-colors"
          >
            Try it free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-[22px] py-3.5 bg-card border border-hair hover:border-ink text-ink rounded-sm text-[15px] font-semibold transition-colors"
          >
            See the product tour
          </Link>
          <a
            href="mailto:hello@rostr.app?subject=Rostr%20-%20coach%20account%20inquiry"
            className="inline-flex items-center gap-2 px-[22px] py-3.5 text-ink-3 hover:text-ink rounded-sm text-[15px] font-semibold transition-colors"
          >
            Talk to sales
          </a>
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
              <LogoMark size="sm" variant="light" />
              rostr
            </Link>
            <p className="mt-4 text-[12.5px] text-white/55 max-w-[240px] leading-relaxed">
              The operating system for coaches. Built for any team — youth,
              travel, school, or club.
            </p>
          </div>
          {[
            { heading: "Product", links: [
              { label: "Coach Hub", href: "/app" },
              { label: "Roster", href: "/app/roster" },
              { label: "Practice planner", href: "/app/practice" },
              { label: "Tryouts", href: "/app/tryouts" },
              { label: "Profiles", href: "/p/marcusjohnson21" },
              { label: "Demo tour", href: "/demo" },
            ] },
            { heading: "Company", links: [
              { label: "About", href: "/#audiences" },
              { label: "Built by a coach", href: "/#flywheel" },
              { label: "Careers", href: "mailto:careers@rostr.app" },
              { label: "Contact", href: "mailto:hello@rostr.app" },
            ] },
            { heading: "Resources", links: [
              { label: "Pilot program", href: "mailto:hello@rostr.app?subject=Pilot%20program" },
              { label: "Help center", href: "mailto:support@rostr.app" },
              { label: "Privacy", href: "/legal/privacy" },
              { label: "Terms", href: "/legal/terms" },
            ] },
          ].map((col) => (
            <div key={col.heading}>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/50">
                {col.heading}
              </div>
              <ul className="mt-4 space-y-2 text-[13px] text-white/75">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="hover:text-white">
                      {l.label}
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
