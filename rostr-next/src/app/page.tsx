import Link from "next/link";
import { ArrowRight, Check, Sparkles, Zap, Users, Trophy } from "lucide-react";
import { PublicNav } from "@/components/organisms/public-nav";
import { LogoMark } from "@/components/atoms/logo";
import { cn } from "@/lib/utils";
import { MobileStickyCTA } from "./_marketing/mobile-sticky-cta";

/**
 * / — Marketing landing page.
 *
 * Mobile-first revamp: every section uses responsive padding + scales
 * its typography for the device. The Hero now shows a real phone-frame
 * mockup of the demo Hub on mobile (so visitors see the product
 * immediately, not just text). A sticky bottom CTA hovers on the
 * mobile viewport so "Try free" is one tap from anywhere on the page.
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
      {/* Sticky mobile-only CTA. Stays out of the way on desktop. */}
      <MobileStickyCTA />
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-6 pb-10 md:pt-14 md:pb-18 relative overflow-hidden">
      {/* Subtle radial accent on the mobile hero so the page doesn't
          start as a flat cream slab — color cue toward "premium app"
          instead of "static webpage." */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] md:hidden pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 80% 0%, rgba(200,58,58,0.10), transparent 55%), radial-gradient(ellipse at 0% 30%, rgba(58,110,168,0.08), transparent 60%)",
        }}
      />
      <div className="relative max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid md:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="text-center md:text-left">
            <div className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.12em] uppercase text-red inline-flex items-center gap-2 mb-4 md:mb-[18px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-sparkle" />
              Built by a coach, for coaches
            </div>
            <h1 className="font-display font-semibold leading-[0.98] tracking-[-0.04em] text-[40px] sm:text-[52px] md:text-[68px] mb-4 md:mb-6">
              Stop running your team from a{" "}
              <span className="relative inline-block">
                spreadsheet.
                <span className="absolute left-0 right-0 -bottom-0.5 h-2.5 sm:h-3 bg-red/20 -z-10 rounded" />
              </span>
            </h1>
            <p className="text-[15px] sm:text-[17px] md:text-[19px] leading-relaxed text-ink-2 mb-5 md:mb-7 max-w-[540px] mx-auto md:mx-0">
              One app for the full lifecycle of your season — and beyond.
              Roster, practice plans, lineups, tryouts, parent comms,
              and a profile every player keeps for life.
            </p>
            <div className="flex gap-2.5 sm:gap-3 items-center mb-4 md:mb-5 flex-wrap justify-center md:justify-start">
              <Link
                href="/signup"
                className={cn(
                  "inline-flex items-center gap-2 px-5 sm:px-[22px] h-12 sm:h-auto sm:py-3.5",
                  "bg-red hover:bg-red/90 text-white rounded-full sm:rounded-sm text-[14.5px] sm:text-[15px] font-bold sm:font-semibold",
                  "shadow-[0_8px_22px_-6px_rgba(200,58,58,0.55)] sm:shadow-none",
                  "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.96]",
                )}
              >
                Try it free <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </Link>
              <Link
                href="/demo"
                className={cn(
                  "inline-flex items-center gap-2 px-5 sm:px-[22px] h-12 sm:h-auto sm:py-3.5",
                  "bg-card border border-hair hover:border-ink text-ink rounded-full sm:rounded-sm text-[14.5px] sm:text-[15px] font-semibold",
                  "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.96]",
                )}
              >
                See the product tour
              </Link>
            </div>
            <div className="flex gap-3 sm:gap-5 text-[11.5px] sm:text-[12.5px] text-ink-3 flex-wrap justify-center md:justify-start">
              <div>
                <b className="text-ink font-bold font-mono">Any team, any level</b>
              </div>
              <div className="hidden sm:block">
                <b className="text-ink font-bold font-mono">Every player</b> gets a profile
              </div>
              <div>
                <b className="text-ink font-bold font-mono">Free</b> forever for players
              </div>
            </div>
          </div>
          {/* Visual proof: phone mockup of the actual product, visible
              on every device. Mobile sees the phone frame; desktop
              sees the laptop + phone combo via HeroShot below it. */}
          <div className="mt-6 md:mt-0">
            <PhoneOnlyHeroShot />
            <div className="hidden md:block">
              <HeroShot />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * PhoneOnlyHeroShot — mobile-only phone frame mockup of the demo Hub.
 *
 * Visitors on a phone need to see the product immediately, not a
 * desktop laptop frame they can't relate to. This renders a centered
 * iPhone-style frame at md:hidden so it owns the mobile hero, then
 * disappears at md+ where the full HeroShot (laptop + phone combo)
 * takes over.
 */
function PhoneOnlyHeroShot() {
  return (
    <div className="md:hidden flex justify-center">
      <div
        className="w-[230px] bg-ink rounded-[34px] p-1.5 border border-white/5 relative"
        style={{
          boxShadow:
            "0 40px 80px -20px rgba(14,17,22,0.45), 0 0 0 1px rgba(0,0,0,0.4)",
        }}
      >
        <div className="bg-paper rounded-[28px] overflow-hidden relative aspect-[9/19.5]">
          {/* Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[80px] h-[20px] bg-ink rounded-full z-10" />
          {/* Status bar */}
          <div className="px-4 pt-2 pb-1 flex items-center justify-between text-[9px] font-bold text-ink z-20 relative">
            <span>9:41</span>
            <span className="font-mono">●●●</span>
          </div>
          {/* Top app bar — matches the real /demo mobile chrome */}
          <div className="bg-ink text-white px-3 py-2.5 mt-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
              <span className="w-3 h-[2px] bg-white block" />
            </span>
            <span className="w-4 h-4 rounded-sm bg-red flex items-center justify-center text-[7px] font-bold">
              R
            </span>
            <span className="font-display text-[10.5px] font-bold tracking-tight">
              Lincoln HS
            </span>
            <span className="ml-auto w-6 h-6 rounded-full bg-dirt flex items-center justify-center text-[8px] font-bold">
              JC
            </span>
          </div>
          <div className="px-3 py-3 space-y-2.5">
            {/* Greeting + record */}
            <div>
              <div className="text-[8.5px] font-bold uppercase tracking-[0.08em] text-red">
                Tuesday · Apr 21
              </div>
              <div className="font-display text-[15px] font-semibold tracking-tight leading-tight mt-0.5">
                Morning, Coach.
              </div>
              <div className="text-[8.5px] text-ink-3 mt-0.5">
                Friday · vs Central · Senior Night
              </div>
            </div>
            {/* Hero card — next game */}
            <div className="rounded-lg bg-[linear-gradient(135deg,#0e1116,#191d24)] text-white p-2.5 relative overflow-hidden">
              <div
                aria-hidden
                className="absolute -top-4 -right-4 w-20 h-20 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(200,58,58,.4), transparent 65%)",
                }}
              />
              <div className="relative">
                <div className="text-[7px] font-bold uppercase tracking-[0.1em] text-white/55">
                  Next game
                </div>
                <div className="font-display text-[14px] font-semibold tracking-tight leading-tight mt-0.5">
                  vs Central Hawks
                </div>
                <div className="font-mono text-[8.5px] text-white/75 mt-1">
                  Fri · 5:00 PM · Home
                </div>
              </div>
            </div>
            {/* AI Coach card — pulse to draw the eye */}
            <div className="rounded-lg bg-[linear-gradient(135deg,#0e1116,#191d24)] text-white p-2.5">
              <div className="inline-flex items-center gap-1 text-[7.5px] font-bold uppercase tracking-[0.1em] text-red">
                <span className="w-1 h-1 rounded-full bg-red animate-sparkle" />
                AI Assistant Coach
              </div>
              <div className="font-display text-[11px] font-semibold tracking-tight leading-snug mt-1">
                Build Friday lineup vs lefties
              </div>
              <div className="grid gap-1 mt-2">
                <div className="bg-white/10 rounded-sm px-2 py-1 text-[8.5px]">
                  Plan tonight&apos;s practice
                </div>
                <div className="bg-white/10 rounded-sm px-2 py-1 text-[8.5px]">
                  Draft a parent email
                </div>
              </div>
            </div>
            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-1">
              <div className="bg-card border border-hair rounded-sm p-1.5">
                <div className="font-mono text-[14px] font-bold text-ink leading-none">
                  8-3
                </div>
                <div className="text-[7px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-0.5">
                  Record
                </div>
              </div>
              <div className="bg-card border border-hair rounded-sm p-1.5">
                <div className="font-mono text-[14px] font-bold text-ink leading-none">
                  22
                </div>
                <div className="text-[7px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-0.5">
                  Avail
                </div>
              </div>
              <div className="bg-card border border-hair rounded-sm p-1.5">
                <div className="font-mono text-[14px] font-bold text-red leading-none">
                  1
                </div>
                <div className="text-[7px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-0.5">
                  Out
                </div>
              </div>
            </div>
          </div>
          {/* Bottom tab bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-hair px-2 py-1.5 flex items-stretch">
            {[
              { label: "Hub", active: true },
              { label: "Roster" },
              { label: "Sched" },
              { label: "Score" },
              { label: "More" },
            ].map((t) => (
              <div
                key={t.label}
                className="flex-1 flex flex-col items-center gap-0.5 relative"
              >
                {t.active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-3 rounded-full bg-red" />
                )}
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-sm",
                    t.active ? "bg-red" : "bg-ink-4",
                  )}
                />
                <span
                  className={cn(
                    "text-[7px] font-semibold leading-none",
                    t.active ? "text-red font-bold" : "text-ink-3",
                  )}
                >
                  {t.label}
                </span>
              </div>
            ))}
          </div>
          {/* Home indicator */}
          <div className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-[60px] h-0.5 bg-ink/30 rounded-full" />
        </div>
      </div>
    </div>
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
    // Height set to clear a 16:10 lid + base + iPhone overlap, not the
    // tall stacked Hub content (which gets cropped inside the screen).
    <div className="relative min-h-[400px] hidden md:block">
      {/* ── MacBook-style frame showing Team Home (/app) ─────────
           Proportional MacBook silhouette: thicker top bezel with a
           camera notch + dot, balanced side bezels, screen with
           rounded corners flush to the bezel, then a hinge gradient
           and a wedge-shaped base wider than the lid. The screen
           content itself is unchanged — the chrome around it is what
           reads as a Mac. */}
      <div className="absolute inset-0">
        {/* Lid + screen */}
        <div
          className="relative rounded-[14px] shadow-elev"
          style={{
            // Aluminum gradient — Space Black / graphite top, slightly
            // lighter on the sides where light would catch the bezel.
            background:
              "linear-gradient(180deg, #1c2026 0%, #14181f 50%, #0f1218 100%)",
            // Asymmetric padding mirrors a real MacBook: top bezel is
            // ~1.4× the side bezels to leave room for the camera notch.
            padding: "14px 10px 12px 10px",
          }}
        >
          {/* Camera notch — small pill protruding from the top bezel
              into the screen area. Real on Mn-series MacBook Pros. */}
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 top-[3px] h-[10px] w-[80px] rounded-b-[6px] bg-black/95 z-10 flex items-center justify-center"
          >
            {/* Camera lens dot */}
            <span className="block w-[5px] h-[5px] rounded-full bg-[#0a0a0a] ring-[1.5px] ring-[#1d2026]" />
          </div>
          {/* Screen — locked to 16:10 like a real Retina display so
              the laptop reads as a Mac. The Hub content inside is
              taller than 16:10; we crop it with overflow-hidden so
              just the top portion (header + greeting + Today + part
              of This week) shows. The cropped scroll position is
              what a coach would actually see at the top of the page. */}
          <div className="bg-card rounded-[6px] overflow-hidden border border-white/5 aspect-[16/10] flex flex-col">
            {/* Browser chrome */}
            <div className="bg-paper-deep px-3 py-1.5 flex items-center gap-1.5 border-b border-hair-2 shrink-0">
              <span className="w-2 h-2 rounded-full bg-red/40" />
              <span className="w-2 h-2 rounded-full bg-amber/50" />
              <span className="w-2 h-2 rounded-full bg-grass/50" />
              <span className="ml-3 px-2 py-0.5 bg-card rounded-sm text-[9px] font-mono text-ink-3 border border-hair-2">
                rostr.app/app
              </span>
            </div>
            {/* Screen content — Team Home (Coach Hub at /app). flex-1
                lets the inner area expand to fill the 16:10 box; the
                inner overflow-hidden clips anything past the viewport. */}
            <div className="bg-paper flex-1 overflow-hidden">
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
        {/* ── Hinge + base ────────────────────────────────────
             Real MacBook silhouette from the front: thin dark hinge
             line directly under the lid, then a base that's slightly
             WIDER than the lid (the keyboard deck sits behind a small
             "lip"), with a subtle indent at the bottom-center for the
             trackpad/grip cutout. Heights kept tight so the base
             doesn't visually compete with the screen content. */}
        {/* Hinge — sits flush under the lid */}
        <div
          aria-hidden
          className="h-[3px] mx-[-2px] rounded-b-[2px]"
          style={{
            background:
              "linear-gradient(180deg, #0a0d12 0%, #1a1e26 60%, #0a0d12 100%)",
          }}
        />
        {/* Base / palm-rest — extends past the lid on each side */}
        <div
          aria-hidden
          className="relative h-[10px] mx-[-14px] rounded-b-[10px] shadow-[0_8px_18px_-6px_rgba(0,0,0,0.45)]"
          style={{
            background:
              "linear-gradient(180deg, #1a1e25 0%, #14181f 55%, #0c0f15 100%)",
          }}
        >
          {/* Trackpad cutout indent — short pill centered along the
              front lip, suggests where you'd grip to open the lid. */}
          <span
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 bottom-[1.5px] w-[60px] h-[2px] rounded-full bg-black/70"
          />
        </div>
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
  const proofs = [
    "60+ player rosters",
    "4 teams per program",
    "60-game seasons",
    "Tryout weeks",
    "College recruiting",
  ];
  return (
    <div className="border-y border-hair bg-card">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8 py-3.5 sm:py-5">
        <div className="md:flex md:items-center md:gap-8">
          <div className="type-label !text-[10px] mb-2 md:mb-0 shrink-0">
            Built for the way real programs run
          </div>
          {/* Wrap on mobile (no horizontal scroll) so the page never
              forces the user to swipe sideways. Desktop keeps the
              wrapping inline list it always had. */}
          <div className="flex flex-wrap gap-2 md:gap-7 text-[12px] md:text-[13px] text-ink-2 font-medium">
            {proofs.map((p) => (
              <span
                key={p}
                className="px-2.5 py-1 md:p-0 rounded-full bg-paper md:bg-transparent border border-hair md:border-0"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Problem ───────────────────────────────────────────────────

function Problem() {
  // Visual list of the actual tools coaches stitch together today.
  // Reads as a "before" snapshot — the pain we replace.
  const stitched = [
    { app: "Excel", purpose: "Tryout sheets" },
    { app: "Word", purpose: "Practice plans" },
    { app: "Paper", purpose: "Lineups" },
    { app: "Notes", purpose: "Depth chart" },
    { app: "GroupMe", purpose: "Parent comms" },
    { app: "GameChanger", purpose: "Stats" },
  ];
  return (
    <section className="py-12 md:py-20">
      <div className="max-w-[780px] mx-auto px-4 sm:px-6 md:px-8">
        <div className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          The problem
        </div>
        <h2 className="font-display font-semibold text-[28px] sm:text-[40px] md:text-[52px] leading-[1.05] tracking-[-0.03em] mb-4 md:mb-5">
          Your roster lives in 6 places.
          <br className="hidden sm:block" />
          <span className="sm:hidden"> </span>
          None of them talk to each other.
        </h2>
        <p className="text-[14.5px] sm:text-[17px] leading-relaxed text-ink-2 mb-6 md:mb-8">
          A HS baseball coach manages 60+ kids across 4 teams. Tryouts
          in Excel. Practice plans in Word. Lineups on paper. Depth chart in a
          notes app. Parent updates by group text. No connection between any of
          it — and no record of a kid&apos;s development when they graduate.
        </p>
        {/* "Before" stitched-tools grid — visual cue for the chaos */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {stitched.map((s) => (
            <div
              key={s.app}
              className="bg-card border border-hair rounded-md p-2 sm:p-3 text-center"
            >
              <div className="font-display font-bold text-[12px] sm:text-[13px] text-ink truncate">
                {s.app}
              </div>
              <div className="text-[9.5px] sm:text-[10.5px] text-ink-3 mt-0.5 leading-tight">
                {s.purpose}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Product tour ──────────────────────────────────────────────

function Tour() {
  const features = [
    {
      icon: <Sparkles className="w-5 h-5" strokeWidth={2.25} />,
      tone: "bg-red-soft text-red",
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
      icon: <Users className="w-5 h-5" strokeWidth={2.25} />,
      tone: "bg-sky-soft text-sky",
      label: "Roster + recruiting",
      title: "Every player gets a profile",
      copy:
        "Enter a player once. The career that follows — every metric, every season, every verified stat — is theirs. Discoverable by college coaches the moment they want it to be.",
      bullet: [
        "Verified-by-coach measurables (your name on the stat)",
        "Shareable public profile at rostr.app/<handle>",
        "College recruiter routing follows NCAA compliance",
      ],
    },
    {
      icon: <Zap className="w-5 h-5" strokeWidth={2.25} />,
      tone: "bg-amber-soft text-amber",
      label: "Practice planner",
      title: "Practice plans in seconds",
      copy:
        "Tell the AI Assistant Coach tonight's focus and your field constraint. It drafts a plan tailored to your roster + recent games. Tap drills, drag time blocks, run it from your phone at the field.",
      bullet: [
        "AI Assistant Coach drafts a plan in one tap",
        "Drill library + weekly templates + per-day adjustments",
        "Phone field-runner with offline queue",
      ],
    },
    {
      icon: <Trophy className="w-5 h-5" strokeWidth={2.25} />,
      tone: "bg-grass-dim text-grass",
      label: "Tryouts",
      title: "A roster nobody can dispute",
      copy:
        "Station-based scoring on phones. Live rankings on your laptop. Auto-suggested verdicts tied to a real cutoff — with a clear paper trail for every one.",
      bullet: [
        "Station coaches score on phones, you watch the leaderboard",
        "Composite scoring you control, not hidden",
        "Verdict notifications to athletes after finalization",
      ],
    },
  ];
  return (
    <section id="tour" className="py-12 md:py-20 bg-card border-y border-hair scroll-mt-16">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8">
        <div className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          Product tour
        </div>
        <h2 className="font-display font-semibold text-[28px] sm:text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-8 sm:mb-12 md:mb-14 max-w-[720px]">
          Four surfaces. One program.
        </h2>
        <div className="grid md:grid-cols-2 gap-3 sm:gap-5 md:gap-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-4 sm:p-5 md:p-7 border border-hair rounded-2xl md:rounded-lg bg-paper"
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    f.tone,
                  )}
                >
                  {f.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="type-label !text-red !text-[10px] sm:!text-[11px]">
                    {f.label}
                  </div>
                  <h3 className="font-display text-[17px] sm:text-[20px] md:text-[22px] font-semibold tracking-tight mt-0.5 leading-snug">
                    {f.title}
                  </h3>
                </div>
              </div>
              <p className="text-[13px] sm:text-[14px] text-ink-2 mb-3 sm:mb-4 leading-relaxed">
                {f.copy}
              </p>
              <ul className="space-y-1.5 text-[12.5px] sm:text-[13px] text-ink-2">
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
    <section id="audiences" className="py-12 md:py-20 scroll-mt-16">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8">
        <div className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          Who it&apos;s for
        </div>
        <h2 className="font-display font-semibold text-[28px] sm:text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-3 max-w-[760px]">
          Built for every coach who runs a team.
        </h2>
        <p className="text-[14px] sm:text-[16px] text-ink-2 max-w-[680px] mb-8 sm:mb-12 md:mb-14 leading-relaxed">
          Youth and travel ball. Middle school and high school. Club, summer ball,
          and elite programs. If you have a roster and a schedule, this works for you.
        </p>
        <div className="grid md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {audiences.map((a) => (
            <div
              key={a.label}
              className="p-4 sm:p-5 md:p-7 bg-card border border-hair rounded-2xl md:rounded-lg"
            >
              <div className="type-label !text-red !text-[10px] sm:!text-[11px]">
                {a.label}
              </div>
              <h3 className="font-display text-[17px] sm:text-[19px] md:text-[20px] font-semibold tracking-tight mt-1 mb-3 leading-snug">
                {a.title}
              </h3>
              <ul className="space-y-1.5 text-[12.5px] sm:text-[13px] text-ink-2">
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
    <section id="flywheel" className="py-12 md:py-20 bg-card border-y border-hair scroll-mt-16">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8 grid md:grid-cols-[1fr_auto] gap-8 lg:gap-12 items-center">
        <div className="max-w-[620px]">
          <div className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
            Why it compounds
          </div>
          <h2 className="font-display font-semibold text-[28px] sm:text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-4 md:mb-5">
            The coach saves hours.
            <br />
            The player gets found.
            <br />
            The career outlives the season.
          </h2>
          <p className="text-[14.5px] sm:text-[16px] text-ink-2 leading-relaxed mb-5 md:mb-6">
            Every practice, every game, every tryout builds a real record of a
            high school athlete&apos;s career. That record is the athlete&apos;s
            forever — long after the team moves on, the season ends, the coach
            retires. It&apos;s also what makes Rostr the only place college
            coaches can source HS talent at scale.
          </p>
          <Link
            href="#pricing"
            className="inline-flex items-center gap-2 text-[14.5px] sm:text-[15px] font-semibold text-red hover:underline active:scale-[0.97] transition-transform"
          >
            See plans <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="bg-paper border border-hair rounded-2xl md:rounded-lg p-4 sm:p-5 md:p-7 max-w-sm space-y-3">
          <FlywheelStep n={1} label="Coach runs the program in Rostr" meta="Tryouts · roster · practice · games" />
          <FlywheelStep n={2} label="Player accumulates verified career data" meta="Four years of metrics · highlights" />
          <FlywheelStep n={3} label="Profile becomes scoutable" meta="Public at rostr.app/<handle>" />
          <FlywheelStep n={4} label="Recruiters discover the talent" meta="Rostr becomes the source" active />
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
    <section className="py-12 md:py-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8">
        <div className="bg-ink text-white rounded-2xl md:rounded-xl p-6 sm:p-10 md:p-12 lg:p-16 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-24 -right-24 w-[300px] sm:w-[420px] h-[300px] sm:h-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(200,58,58,.3), transparent 65%)",
            }}
          />
          <div className="relative max-w-[680px]">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[10px] text-red font-bold uppercase tracking-[0.14em]">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-sparkle" />
              AI Assistant Coach
            </div>
            <h2 className="font-display font-semibold text-[28px] sm:text-[40px] md:text-[52px] leading-[1.05] tracking-[-0.03em] mt-2 sm:mt-3 mb-3 sm:mb-5">
              Your assistant coach that never sleeps.
            </h2>
            <p className="text-[14.5px] sm:text-[17px] text-white/70 leading-relaxed mb-5 sm:mb-7">
              Ask for a practice plan for tonight&apos;s focus. Pull a Friday
              lineup against the opponent&apos;s lefties. Draft a mid-season
              parent email. All grounded in your real program data — not a
              generic chatbot.
            </p>
            <div className="grid sm:grid-cols-2 gap-2 sm:gap-2.5">
              {[
                "Build Friday lineup · vs Central",
                "Practice plan · bullpen day",
                "Scout opponent · last 5 games",
                "Draft parent email · tournament",
              ].map((p) => (
                <Link
                  key={p}
                  href="/signup"
                  className={cn(
                    "flex items-center justify-between gap-2 px-3.5 sm:px-4 py-3",
                    "bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl sm:rounded-sm text-left text-[12.5px] sm:text-[13.5px]",
                    "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97] active:bg-white/15",
                  )}
                >
                  <span>{p}</span>
                  <span className="text-red text-[10.5px] sm:text-[11px] font-semibold font-mono shrink-0">
                    2 min
                  </span>
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
    <section id="pricing" className="py-12 md:py-20 bg-card border-y border-hair">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8">
        <div className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.12em] uppercase text-red mb-3">
          Plans
        </div>
        <h2 className="font-display font-semibold text-[28px] sm:text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.03em] mb-3 max-w-[680px]">
          Free for athletes.
          <br />
          One conversation for everyone else.
        </h2>
        <p className="text-[14px] sm:text-[16px] text-ink-2 mb-8 sm:mb-12 md:mb-14 max-w-[620px]">
          Athletes never pay. Coaches and recruiters: drop us a line and
          we&apos;ll set you up — pricing depends on team size and what you need.
        </p>
        <div className="grid md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "p-5 sm:p-6 md:p-7 rounded-2xl md:rounded-lg flex flex-col",
                t.emphasis
                  ? "bg-ink text-white border border-ink shadow-elev"
                  : "bg-paper border border-hair",
              )}
            >
              <div className="type-label !text-red !text-[10px] sm:!text-[11px]">
                {t.name}
              </div>
              {/* Tagline replaces the dollar block — keeps the visual
                  weight of a "price line" without quoting numbers. */}
              <div className="font-display text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] leading-tight mt-2 sm:mt-2.5">
                {t.tagline}
              </div>
              <p
                className={cn(
                  "mt-2 sm:mt-3 text-[13px] sm:text-[13.5px] leading-relaxed",
                  t.emphasis ? "text-white/75" : "text-ink-2",
                )}
              >
                {t.description}
              </p>
              <ul className="mt-4 sm:mt-5 space-y-1.5 sm:space-y-2 text-[12.5px] sm:text-[13px] flex-1">
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
                    "mt-5 sm:mt-7 w-full inline-flex items-center justify-center rounded-full sm:rounded-sm h-12 sm:h-[42px] text-[13.5px] font-bold sm:font-semibold",
                    "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97]",
                    t.emphasis
                      ? "bg-red text-white hover:bg-red/90 shadow-[0_6px_18px_-4px_rgba(200,58,58,0.55)]"
                      : "bg-ink text-white hover:bg-red",
                  )}
                >
                  {t.cta}
                </Link>
              ) : (
                <a
                  href={t.ctaHref}
                  className={cn(
                    "mt-5 sm:mt-7 w-full inline-flex items-center justify-center rounded-full sm:rounded-sm h-12 sm:h-[42px] text-[13.5px] font-bold sm:font-semibold",
                    "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97]",
                    t.emphasis
                      ? "bg-red text-white hover:bg-red/90 shadow-[0_6px_18px_-4px_rgba(200,58,58,0.55)]"
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
    <section id="cta" className="py-14 md:py-24">
      <div className="max-w-[980px] mx-auto px-4 sm:px-6 md:px-8 text-center">
        <h2 className="font-display font-semibold text-[34px] sm:text-[44px] md:text-[60px] leading-[1.02] tracking-[-0.04em] mb-3 sm:mb-5">
          Run your team.
          <br />
          Build the career.
        </h2>
        <p className="text-[15px] sm:text-[17px] text-ink-2 max-w-[600px] mx-auto mb-6 md:mb-8 leading-relaxed">
          Coaches: get in touch and we&apos;ll set you up. Players: claim your
          profile in 30 seconds — free, forever.
        </p>
        <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
          <Link
            href="/signup"
            className={cn(
              "inline-flex items-center gap-2 px-5 sm:px-[22px] h-12 sm:h-auto sm:py-3.5",
              "bg-red hover:bg-red/90 text-white rounded-full sm:rounded-sm text-[14.5px] sm:text-[15px] font-bold sm:font-semibold",
              "shadow-[0_8px_22px_-6px_rgba(200,58,58,0.55)] sm:shadow-none",
              "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.96]",
            )}
          >
            Try it free <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Link>
          <Link
            href="/demo"
            className={cn(
              "inline-flex items-center gap-2 px-5 sm:px-[22px] h-12 sm:h-auto sm:py-3.5",
              "bg-card border border-hair hover:border-ink text-ink rounded-full sm:rounded-sm text-[14.5px] sm:text-[15px] font-semibold",
              "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.96]",
            )}
          >
            See the product tour
          </Link>
          <a
            href="mailto:hello@rostr.app?subject=Rostr%20-%20coach%20account%20inquiry"
            className="hidden sm:inline-flex items-center gap-2 px-[22px] py-3.5 text-ink-3 hover:text-ink rounded-sm text-[15px] font-semibold transition-colors"
          >
            Talk to sales
          </a>
        </div>
        {/* Mobile-only "talk to sales" surface — separate from primary
            buttons so the two-CTA hierarchy stays clean on small screens. */}
        <a
          href="mailto:hello@rostr.app?subject=Rostr%20-%20coach%20account%20inquiry"
          className="sm:hidden mt-3 inline-block text-[13px] font-semibold text-ink-3 hover:text-ink underline"
        >
          Talk to sales
        </a>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────

function Footer() {
  return (
    /* Bottom padding bumped (pb-24) on mobile so the sticky CTA bar
       doesn't overlap the last row of footer links. */
    <footer className="bg-ink text-white pt-10 md:pt-12 pb-24 lg:pb-8">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 font-display text-[17px] sm:text-[18px] font-bold">
              <LogoMark size="sm" variant="light" />
              rostr
            </Link>
            <p className="mt-3 sm:mt-4 text-[12px] sm:text-[12.5px] text-white/55 max-w-[280px] leading-relaxed">
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
              <ul className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-[12.5px] sm:text-[13px] text-white/75">
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
        <div className="mt-10 sm:mt-14 pt-5 sm:pt-7 border-t border-white/10 flex items-center justify-between text-[11px] sm:text-[11.5px] text-white/50 flex-wrap gap-3 sm:gap-4">
          <div>© {new Date().getFullYear()} Rostr Labs. Built by a coach.</div>
          <div className="font-mono">v0.1 · pilot</div>
        </div>
      </div>
    </footer>
  );
}
