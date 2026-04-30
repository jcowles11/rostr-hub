import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  GraduationCap,
  ListChecks,
  AtSign,
} from "lucide-react";
import { requireFlag } from "@/lib/feature-flags";
import {
  PlayerReportedBadge,
  VerifiedBadge,
} from "@/components/atoms/data-source-badge";

/**
 * /demo/me/profile — read-only preview of the advanced player profile
 * editor. Flag-gated: returns 404 unless
 * NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES is on. So in production
 * (flags omitted on Vercel) this route does not exist.
 *
 * Why static-only: the demo tour must never accept writes, and the
 * editor component is interactive. Rather than risk a stray writeable
 * input slipping into the demo, this page is plain Markdown-style
 * cards using mock data. Coaches touring the demo can see what an
 * athlete would type into the live editor without any chance of
 * mutating anything.
 */
export const metadata = {
  title: "Demo profile preview · Rostr",
  robots: { index: false, follow: false },
};

const MOCK_PRIOR_SEASONS = [
  {
    season: "2024 (Sophomore)",
    level: "Varsity",
    ba: ".341",
    ops: ".923",
    hr: "4",
    rbi: "27",
    pitching: null as string | null,
    context: "All-conference 2nd team",
  },
  {
    season: "2023 (Freshman)",
    level: "JV",
    ba: ".388",
    ops: "1.012",
    hr: "2",
    rbi: "19",
    pitching: "1-0, 1.85 ERA in 12 IP",
    context: null,
  },
];

const MOCK_CONTACT: Array<[string, string]> = [
  ["Email", "alex.rivera@example.com"],
  ["Instagram", "@alex.r.baseball"],
  ["TikTok", "@alex_rivera_27"],
  ["YouTube", "@alex-rivera-baseball"],
];

export default function DemoProfilePreviewPage() {
  // 404 in production (flag OFF). Catch-all /demo/[...rest] does NOT
  // take over for a matching segment that calls notFound, so this is
  // genuinely invisible until a developer flips the flag locally.
  requireFlag("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES");

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="sticky top-0 z-topbar h-12 px-3 flex items-center gap-2 bg-paper/85 backdrop-blur-xl backdrop-saturate-150 border-b border-hair">
        <Link
          href="/demo"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-hair-2 active:scale-[0.92] transition"
        >
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.25} />
        </Link>
        <div className="flex-1 min-w-0 font-display text-[15px] font-bold tracking-tight truncate">
          Profile preview
        </div>
        <span className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-ink-3 px-2 py-1 rounded-full bg-paper-deep border border-hair">
          Demo · Read-only
        </span>
      </header>

      <div className="max-w-[640px] mx-auto px-4 sm:px-6 pt-5 pb-24">
        <p className="text-[12.5px] text-ink-3 leading-relaxed mb-5">
          This is what athletes see in the advanced player profile editor.
          On a real account, every field below is a save-on-blur input.
          Here it&apos;s static — the demo never writes data.
        </p>

        {/* Privacy preview */}
        <DemoCard
          tone="bg-ink/5 text-ink"
          icon={<Eye className="w-4 h-4" />}
          title="Profile visibility"
          subtitle="Three iOS-style toggles. All default OFF."
        >
          <PreviewToggleRow label="Public profile" on={true} />
          <PreviewToggleRow label="Show academics" on={true} />
          <PreviewToggleRow label="Show contact info" on={false} />
        </DemoCard>

        {/* Prior seasons preview */}
        <DemoCard
          tone="bg-amber-soft text-amber"
          icon={<ListChecks className="w-4 h-4" />}
          title="Prior seasons"
          subtitle="Player-typed history from before Rostr or outside-of-program play."
          badge={<PlayerReportedBadge size="sm" />}
        >
          {MOCK_PRIOR_SEASONS.map((row, i) => {
            const battingBits: string[] = [];
            if (row.ba) battingBits.push(`${row.ba} BA`);
            if (row.ops) battingBits.push(`${row.ops} OPS`);
            if (row.hr) battingBits.push(`${row.hr} HR`);
            if (row.rbi) battingBits.push(`${row.rbi} RBI`);
            return (
              <div
                key={i}
                className="px-4 py-3 border-b border-hair-2 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="font-display text-[13.5px] font-semibold">
                    {row.season}
                  </div>
                  <span className="text-[11.5px] text-ink-3">{row.level}</span>
                </div>
                <div className="mt-1 text-[12px] text-ink-2 font-mono tabular-nums">
                  {battingBits.join(" · ")}
                </div>
                {row.pitching && (
                  <div className="mt-1 text-[12px] text-ink-2">
                    <span className="text-ink-3 font-mono text-[10.5px] uppercase tracking-[0.06em] mr-1.5">
                      Pitching
                    </span>
                    {row.pitching}
                  </div>
                )}
                {row.context && (
                  <div className="mt-1 text-[11.5px] text-ink-3 italic">
                    {row.context}
                  </div>
                )}
              </div>
            );
          })}
        </DemoCard>

        {/* Contact preview */}
        <DemoCard
          tone="bg-sky-soft text-sky"
          icon={<AtSign className="w-4 h-4" />}
          title="Contact + socials"
          subtitle="Hidden until the player flips Show contact info."
          badge={<PlayerReportedBadge size="sm" />}
        >
          {MOCK_CONTACT.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between items-center px-4 py-2.5 border-b border-hair-2 last:border-b-0 text-[13px] gap-3"
            >
              <span className="text-ink-3 font-medium shrink-0">{label}</span>
              <span className="font-mono text-[12.5px] truncate text-right">
                {value}
              </span>
            </div>
          ))}
        </DemoCard>

        <DemoCard
          tone="bg-grass-dim text-grass"
          icon={<GraduationCap className="w-4 h-4" />}
          title="Verified vs Player Reported"
          subtitle="Live game stats, tryout measurables, coach-verified clips get the Verified atom. Anything self-typed (academics, prior seasons, contact, untouched highlights) is Player Reported."
        >
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <VerifiedBadge size="sm" source="Live scoring" />
            <PlayerReportedBadge size="sm" />
          </div>
        </DemoCard>

        <div className="mt-6 text-[12px] text-ink-3 leading-relaxed text-center">
          Want to try the editor for real?{" "}
          <Link
            href="/signup"
            className="font-semibold text-red hover:underline"
          >
            Sign up free
          </Link>
          .
        </div>
      </div>
    </div>
  );
}

// ── Demo subcomponents (no shared imports — single-file static preview)

function DemoCard({
  tone,
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  tone: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-hair rounded-2xl mb-4 overflow-hidden">
      <header className="px-4 py-3 border-b border-hair-2 flex items-start gap-3">
        <span
          className={
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 " +
            tone
          }
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-[14px] font-bold tracking-tight">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && (
            <p className="text-[11px] text-ink-3 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}

function PreviewToggleRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-hair-2 last:border-b-0 text-[13px]">
      <span className="font-medium">{label}</span>
      <span
        className={
          "relative w-10 h-6 rounded-full " + (on ? "bg-grass" : "bg-hair-2")
        }
        aria-hidden
      >
        <span
          className={
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm " +
            (on ? "left-[18px]" : "left-0.5")
          }
        />
      </span>
    </div>
  );
}
