import { notFound } from "next/navigation";
import {
  Link2,
  Trophy,
  Star,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";
import { PublicNav } from "@/components/organisms/public-nav";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import { MOCK_PLAYERS } from "@/lib/mock-data";
import { PlayerProfileTabs, PlayerProfileActions } from "./interactive";

/**
 * /p/[handle] — Public player profile.
 * Pixel target: handoff/designs/04_Player_Profile.html.
 * Spec: handoff/SCREENS.md §4.
 *
 * NOTE: Final spec puts public profiles at /<handle>. We use /p/<handle>
 * for now to avoid root catch-all collisions with /app, /signup, etc.
 * Migrate via redirect when handle reservations are implemented.
 */

export default function PlayerProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const player = MOCK_PLAYERS.find((p) => p.handle === params.handle) ?? MOCK_PLAYERS[0];
  if (!player) notFound();

  return (
    <div className="bg-paper min-h-screen">
      <PublicNav />
      <div className="max-w-layout-marketing mx-auto px-7">
        <Hero player={player} />
        <Identity player={player} />
        <PlayerProfileTabs />
        <Layout player={player} />
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────

function Hero({ player }: { player: (typeof MOCK_PLAYERS)[number] }) {
  return (
    <div
      className="relative mt-6 rounded-xl overflow-hidden bg-ink text-white min-h-[260px]"
      style={{
        aspectRatio: "3.6 / 1",
        backgroundImage: [
          "radial-gradient(circle at 70% 30%, rgba(200,58,58,.4), transparent 55%)",
          "radial-gradient(circle at 20% 80%, rgba(58,110,168,.25), transparent 60%)",
          "linear-gradient(135deg, #14181f, #0a0d12)",
        ].join(", "),
      }}
    >
      {/* grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* faux diamond */}
      <svg
        className="absolute right-12 top-0 bottom-0 h-[85%] my-auto"
        viewBox="0 0 300 200"
        aria-hidden
      >
        <path d="M 150 180 L 30 60 L 150 -60 L 270 60 Z" fill="rgba(47,125,79,.2)" />
        <circle cx="150" cy="80" r="42" fill="rgba(179,122,76,.2)" />
        <rect x="146" y="176" width="8" height="8" fill="rgba(255,255,255,.4)" transform="rotate(45 150 180)" />
        <rect x="266" y="56" width="8" height="8" fill="rgba(255,255,255,.4)" transform="rotate(45 270 60)" />
        <rect x="146" y="-64" width="8" height="8" fill="rgba(255,255,255,.4)" transform="rotate(45 150 -60)" />
        <rect x="26" y="56" width="8" height="8" fill="rgba(255,255,255,.4)" transform="rotate(45 30 60)" />
      </svg>
      <div className="absolute top-5 left-5 flex gap-2">
        <span className="px-2.5 py-1 bg-white/10 text-white rounded-xs text-[10.5px] font-bold uppercase tracking-[0.08em] backdrop-blur">
          ⚾ Baseball
        </span>
        {player.hot && (
          <span className="px-2.5 py-1 bg-red text-white rounded-xs text-[10.5px] font-bold uppercase tracking-[0.08em]">
            🔥 On a 7-game hit streak
          </span>
        )}
      </div>
    </div>
  );
}

// ── Identity ──────────────────────────────────────────────────

function Identity({ player }: { player: (typeof MOCK_PLAYERS)[number] }) {
  return (
    <div className="flex gap-6 items-start -mt-14 relative z-[2] px-2">
      <div className="shrink-0">
        <div
          className="w-32 h-32 rounded-xl border-[5px] border-card flex items-center justify-center font-display text-[44px] font-semibold text-white shadow-elev"
          style={{
            backgroundImage: "linear-gradient(135deg, #c83a3a, #0e1116)",
          }}
        >
          {player.initials}
        </div>
      </div>
      <div className="flex-1 pt-16 min-w-0">
        <div className="text-[11px] font-bold text-red tracking-[0.12em] uppercase">
          Class of {player.gradYear}
        </div>
        <h1 className="font-display text-[40px] font-semibold tracking-[-0.03em] leading-[1.05] mt-1">
          {player.firstName} {player.lastName}{" "}
          <span className="font-mono text-ink-3 text-[24px] align-middle">
            #{player.jerseyNumber}
          </span>
        </h1>
        <div className="flex flex-wrap gap-3.5 mt-2 text-[14px] text-ink-2">
          <span>
            <b className="font-semibold text-ink">{player.positions.join("/")}</b>
          </span>
          <span>·</span>
          <span>
            <b className="font-semibold text-ink">Lincoln HS</b> · Varsity
          </span>
          <span>·</span>
          <span>Austin, TX</span>
          <span>·</span>
          <span>
            <b className="font-semibold text-ink">6&apos;1&quot;</b> · 180 · R/R
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.04em]">
            <CheckCircle2 className="w-3 h-3" /> Verified
          </span>
        </div>
      </div>
      <PlayerProfileActions handle={player.handle} name={`${player.firstName} ${player.lastName}`} />
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────

function Layout({ player }: { player: (typeof MOCK_PLAYERS)[number] }) {
  return (
    <div className="grid grid-cols-[1fr_340px] gap-7 my-7 mb-20">
      <div className="flex flex-col gap-5">
        <StatHero />
        <CareerChart />
        <Career />
        <Highlights />
        <Combine />
      </div>
      <div className="flex flex-col gap-5">
        <ShareCard handle={player.handle} />
        <RecruitingCard />
        <AcademicsCard />
        <CoachVerification />
      </div>
    </div>
  );
}

// ── Stat Hero (4-cell) ───────────────────────────────────────

function StatHero() {
  const cells = [
    { label: "Exit velo", value: "94", unit: "mph", delta: "+3.2 · 90d", up: true },
    { label: "60 yd", value: "6.74", unit: "s", delta: "−0.18 · 1yr", up: true },
    { label: "BA · 2026", value: ".372", delta: "+.054 vs Jr", up: true },
    { label: "OPS", value: ".979", delta: "+.112 vs Jr", up: true },
  ];
  return (
    <div className="grid grid-cols-4 bg-card border border-hair rounded-lg overflow-hidden">
      {cells.map((c, i) => (
        <div
          key={i}
          className={cn(
            "px-5 py-[22px]",
            i < cells.length - 1 && "border-r border-hair-2",
          )}
        >
          <div className="type-label">{c.label}</div>
          <div className="font-mono text-[32px] font-semibold tracking-[-0.03em] mt-1.5 leading-none">
            {c.value}
            {c.unit && <span className="text-[14px] text-ink-3 font-medium ml-0.5">{c.unit}</span>}
          </div>
          <div
            className={cn(
              "mt-1.5 text-[11px] font-semibold flex items-center gap-1",
              c.up ? "text-grass" : "text-red",
            )}
          >
            <span>{c.up ? "▲" : "▼"} {c.delta}</span>
            <svg viewBox="0 0 100 20" className="flex-1 h-[18px] ml-2.5" preserveAspectRatio="none">
              <polyline
                points={c.up ? "0,16 15,14 30,12 45,10 60,8 75,5 100,3" : "0,4 25,8 50,12 75,15 100,18"}
                fill="none"
                stroke={c.up ? "var(--grass)" : "var(--red)"}
                strokeWidth="1.6"
              />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Career Chart ────────────────────────────────────────────

function CareerChart() {
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="p-5">
        <div className="flex items-baseline gap-2.5 mb-3.5">
          <div className="text-[14px] font-semibold">Exit velocity · career</div>
          <div className="ml-auto flex gap-1">
            {["60yd", "EV", "Pop", "BA"].map((t) => (
              <button
                key={t}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-xs transition-colors",
                  t === "EV"
                    ? "bg-paper text-ink"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 680 180" className="w-full h-[180px]">
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1="0" y1={y} x2="680" y2={y} stroke="#efeadf" />
          ))}
          {[
            [4, 36, "95"], [4, 76, "85"], [4, 116, "75"], [4, 156, "65"],
          ].map(([x, y, t], i) => (
            <text
              key={i}
              x={x as number}
              y={y as number}
              fontFamily="JetBrains Mono"
              fontSize="9"
              fill="#9ca3af"
            >
              {t}
            </text>
          ))}
          <polyline
            points="30,130 120,118 220,102 320,84 420,64 520,46 620,34"
            fill="none"
            stroke="#c83a3a"
            strokeWidth="2.5"
          />
          <polygon
            points="30,130 120,118 220,102 320,84 420,64 520,46 620,34 620,180 30,180"
            fill="rgba(200,58,58,.08)"
          />
          {[[30, 130], [120, 118], [220, 102], [320, 84], [420, 64], [520, 46]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="4" fill="#c83a3a" />
          ))}
          <circle cx="620" cy="34" r="5" fill="#c83a3a" stroke="#fff" strokeWidth="2" />
          <text
            x="620"
            y="22"
            fontFamily="JetBrains Mono"
            fontSize="10"
            fontWeight="600"
            fill="#0e1116"
            textAnchor="middle"
          >
            94
          </text>
        </svg>
        <div className="font-mono flex justify-between text-[10px] text-ink-4 mt-1 px-2">
          <span>Fr Fall &apos;22</span>
          <span>Fr &apos;23</span>
          <span>So &apos;23</span>
          <span>So &apos;24</span>
          <span>Jr &apos;24</span>
          <span>Jr &apos;25</span>
          <span>Sr · now</span>
        </div>
      </div>
    </div>
  );
}

// ── Career (timeline) ────────────────────────────────────────

function Career() {
  const seasons = [
    {
      year: "Senior · 2026",
      badge: "VARSITY", badgeKind: "v" as const,
      team: "Lincoln HS · 19 G (in progress)",
      stats: [
        ["BA", ".372"], ["OBP", ".448"], ["SLG", ".531"], ["SB", "14"], ["RBI", "21"],
      ],
      note: "Current run. **All-Conference frontrunner**. Hitting streak active (7G).",
    },
    {
      year: "Junior · 2025",
      badge: "VARSITY", badgeKind: "v" as const,
      team: "Lincoln HS · 31 G",
      stats: [
        ["BA", ".318"], ["OBP", ".402"], ["SLG", ".445"], ["SB", "22"], ["RBI", "28"],
      ],
      note: "Moved from RF to CF midseason. **All-District 2nd team**. Playoff series loss to Ridgewood Prep, 1-2.",
    },
    {
      year: "Summer '25",
      badge: "CLUB · 17U", badgeKind: "club" as const,
      team: "Texas Storm Baseball · PG showcases",
      stats: [
        ["BA", ".341"], ["EV HIGH", "91"], ["60YD", "6.82"], ["TOURN", "4"], ["CAMPS", "2"],
      ],
    },
    {
      year: "Sophomore · 2024",
      badge: "JV", badgeKind: "jv" as const,
      team: "Lincoln HS · 28 G (14 V callups)",
      stats: [
        ["BA", ".294"], ["OBP", ".371"], ["SLG", ".398"], ["SB", "11"], ["RBI", "16"],
      ],
    },
  ];
  const badgeStyles: Record<typeof seasons[number]["badgeKind"], string> = {
    v: "bg-red-soft text-red",
    jv: "bg-paper-deep text-ink-2",
    club: "bg-grass-dim text-grass",
  };

  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Career</h3>
        <span className="text-[12px] text-ink-3 ml-2">4 seasons · HS + club</span>
      </div>
      <div>
        {seasons.map((s, i) => (
          <div key={i} className="px-[22px] py-5 border-b border-hair-2 last:border-b-0">
            <div className="flex items-baseline gap-2.5 mb-3.5 flex-wrap">
              <span className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                {s.year}
              </span>
              <span className={cn("px-2 py-0.5 rounded-xs text-[10.5px] font-bold tracking-[0.04em]", badgeStyles[s.badgeKind])}>
                {s.badge}
              </span>
              <span className="text-ink-3 text-[12.5px] ml-auto">{s.team}</span>
            </div>
            <div className="grid grid-cols-5 gap-2.5 text-[12px]">
              {s.stats.map(([label, value], j) => (
                <div key={j}>
                  <div className="font-mono text-[17px] font-semibold">{value}</div>
                  <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {s.note && (
              <div className="mt-3 px-3 py-2.5 bg-paper rounded-md text-[12.5px] text-ink-2 border-l-[3px] border-l-red leading-relaxed">
                {s.note.split("**").map((part, j) =>
                  j % 2 === 1 ? <b key={j} className="text-ink font-semibold">{part}</b> : part,
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Highlights ──────────────────────────────────────────────

function Highlights() {
  const highlights = [
    { title: "Triple vs Eastside · 4/19", meta: "0:24 · 12.4k views", new: true, gradient: "from-[#1a1e26] to-[#0e1116]" },
    { title: "Diving catch · CF gap", meta: "0:18 · 8.2k views", gradient: "from-[#1d2430] to-[#0e1116]" },
    { title: "Walk-off vs Westfield", meta: "0:31 · 21.1k views", gradient: "from-[#301a1a] to-[#0e1116]" },
    { title: "BP round · July showcase", meta: "1:04 · 4.8k views", gradient: "from-[#1a2a1f] to-[#0e1116]" },
    { title: "6.74 60yd · PG South", meta: "0:12 · 3.3k views", gradient: "from-[#1a2230] to-[#0e1116]" },
    { title: "Runner out at home", meta: "0:22 · 6.5k views", gradient: "from-[#2a2218] to-[#0e1116]" },
  ];
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Highlights</h3>
        <span className="text-[12px] text-ink-3 ml-2">Latest 6 of 18</span>
        <button className="ml-auto text-[12px] text-ink-3 hover:text-ink">View all →</button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2.5">
          {highlights.map((h, i) => (
            <div
              key={i}
              className={cn(
                "relative aspect-[9/16] rounded-md overflow-hidden cursor-pointer bg-gradient-to-br",
                h.gradient,
              )}
            >
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(200,58,58,.2), transparent 45%), radial-gradient(circle at 50% 45%, rgba(255,255,255,.08), transparent 55%)",
                }}
              />
              {h.new && (
                <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-red text-white rounded-[4px] text-[9px] font-bold uppercase tracking-[0.06em]">
                  NEW
                </span>
              )}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-ink flex items-center justify-center text-[12px]">
                ▶
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white bg-gradient-to-t from-black/90 to-transparent">
                <div className="text-[11.5px] font-semibold leading-tight">{h.title}</div>
                <div className="font-mono text-[9.5px] text-white/70 mt-0.5">{h.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Combine & measurables ───────────────────────────────────

function Combine() {
  const metrics = [
    { v: "94", u: "mph", l: "Exit velo", d: "+3.2 vs last" },
    { v: "87", u: "mph", l: "OF velo", d: "+4.0 vs last" },
    { v: "6.74", u: "s", l: "60 yard", d: "−0.18 vs last" },
    { v: "4.05", u: "s", l: "Home to 1B", d: "−0.09 vs last" },
    { v: "28", u: "\"", l: "Vert jump", d: "+2 vs last" },
    { v: "6'1\"", u: "", l: "Height" },
    { v: "180", u: "", l: "Weight", d: "+8 vs last" },
    { v: "R/R", u: "", l: "Bats/Throws" },
  ];
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Combine &amp; measurables
        </h3>
        <span className="text-[12px] text-ink-3 ml-2">verified by Coach Ruiz · 4/02/2026</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-4 gap-2.5">
          {metrics.map((m, i) => (
            <div key={i} className="p-3.5 bg-paper rounded-md">
              <div className="font-mono text-[22px] font-semibold tracking-[-0.02em]">
                {m.v}
                {m.u && <span className="text-[11px] text-ink-3 ml-0.5 font-normal">{m.u}</span>}
              </div>
              <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-1">{m.l}</div>
              {m.d && <div className="text-[10px] text-grass mt-0.5 font-semibold">{m.d}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Side column ─────────────────────────────────────────────

function ShareCard({ handle }: { handle: string }) {
  return (
    <div className="relative overflow-hidden bg-ink text-white rounded-lg p-[18px]">
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(200,58,58,.3), transparent 65%)",
        }}
      />
      <div className="relative">
        <h4 className="font-display text-[16px] font-semibold tracking-tight">Share your profile</h4>
        <p className="text-[12.5px] text-white/70 mt-1 leading-relaxed">
          College coaches, scouts, recruits — send your whole career in one link.
        </p>
        <div className="mt-3 px-3 py-2.5 bg-white/[0.08] rounded-md font-mono text-[11.5px] flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-white/50 shrink-0" />
          <span className="text-white/55">rostr.app/</span>
          <b className="text-red">{handle}</b>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <button className="flex-1 py-2.5 bg-red text-white rounded-sm text-[12px] font-semibold">
            Copy link
          </button>
          <button className="flex-1 py-2.5 bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm text-[12px] font-semibold">
            📸 Story
          </button>
          <button className="px-3 py-2.5 bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm text-[12px] font-semibold">
            ⇪
          </button>
        </div>
      </div>
    </div>
  );
}

function RecruitingCard() {
  const interest = [
    { initials: "TX", color: "bg-sky", name: "Texas State", meta: "saved · 3d ago", interested: true },
    { initials: "BU", color: "bg-grass", name: "Baylor", meta: "viewed · 6d ago" },
    { initials: "OU", color: "bg-amber", name: "Oklahoma", meta: "viewed · 12d ago" },
    { initials: "AR", color: "bg-dirt", name: "Arkansas", meta: "viewed · 18d ago" },
  ];
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Recruiting interest</h3>
      </div>
      <div className="p-4 space-y-2">
        <div className="bg-paper-deep border border-dashed border-hair rounded-md p-3.5 text-center">
          <div className="font-mono text-[20px] font-semibold text-red">7</div>
          <div className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-0.5">
            college coaches viewed · 30d
          </div>
        </div>
        <div className="space-y-2 mt-3.5">
          {interest.map((i, idx) => (
            <div key={idx} className="px-3 py-2.5 bg-paper rounded-md flex items-center gap-2.5 text-[12px]">
              <div className={cn("w-[26px] h-[26px] rounded-xs flex items-center justify-center text-white text-[10px] font-bold", i.color)}>
                {i.initials}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{i.name}</div>
                <div className="font-mono text-[10px] text-ink-3">{i.meta}</div>
              </div>
              {i.interested && <span className="text-red text-[11px] font-semibold">Interested</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AcademicsCard() {
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-ink-3" />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Academic</h3>
      </div>
      <div>
        {[
          ["GPA", "3.78"],
          ["SAT", "1320"],
          ["Class rank", "32 / 412"],
          ["Major (intended)", "Business"],
          ["Target div", "D1 / D2"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between items-center px-4 py-2.5 border-b border-hair-2 last:border-b-0 text-[13px]">
            <span className="text-ink-3 font-medium">{label}</span>
            <span className="font-mono font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachVerification() {
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-ink-3" />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Verification chain</h3>
      </div>
      <div>
        {[
          { initials: "JR", name: "Coach Joe Ruiz", role: "Head Coach · Lincoln HS", what: "verified combine measurables", when: "Apr 2, 2026" },
          { initials: "DM", name: "Coach Dan Morales", role: "Head Coach · Texas Storm 17U", what: "verified summer game stats", when: "Aug 14, 2025" },
          { initials: "AR", name: "Anthony Reyes", role: "PG South Showcase Eval", what: "verified 60yd time + EV", when: "Jul 22, 2025" },
        ].map((v, i) => (
          <div key={i} className="px-[18px] py-3.5 border-b border-hair-2 last:border-b-0 flex gap-2.5 items-start">
            <Avatar size="md" color="ink" initials={v.initials} />
            <div className="flex-1 text-[13px] leading-relaxed">
              <div>
                <b className="font-semibold">{v.name}</b>{" "}
                <span className="text-ink-3">— {v.what}</span>
              </div>
              <div className="font-mono text-[10.5px] text-ink-3 mt-0.5">
                {v.role} · {v.when}
              </div>
            </div>
            <Star className="w-3.5 h-3.5 text-grass shrink-0 mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
