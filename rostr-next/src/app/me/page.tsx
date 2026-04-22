import Link from "next/link";
import {
  Eye,
  Star,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { PublicNav } from "@/components/organisms/public-nav";
import { Avatar } from "@/components/atoms/avatar";
import { MOCK_PLAYERS } from "@/lib/mock-data";
import { MeActions, MeHeaderActions, SuggestionAction, QuickAction } from "./interactive";

/**
 * /me — Authenticated player's home.
 * Shows a private view of their own profile: who's been viewing, what to
 * improve, what to upload. Public profile lives at /p/[handle].
 */
export default function MePage() {
  const me = MOCK_PLAYERS[0]; // Marcus Johnson

  return (
    <div className="bg-paper min-h-screen">
      <PublicNav />
      <div className="max-w-layout-marketing mx-auto px-7 py-8">
        {/* Greeting */}
        <div className="flex items-center gap-5 mb-8">
          <Avatar size="lg" color={me.avatarColor} initials={me.initials} />
          <div>
            <div className="type-label !text-red">Your profile</div>
            <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em] leading-[1.1] mt-1">
              {me.firstName}, looking sharp.
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Class of {me.gradYear} · {me.positions.join("/")} · Lincoln HS · Varsity
            </p>
          </div>
          <MeHeaderActions handle={me.handle} />
        </div>

        <div className="grid grid-cols-[1fr_340px] gap-7">
          {/* Main column */}
          <div className="flex flex-col gap-5">
            {/* This week activity */}
            <div className="bg-card border border-hair rounded-lg">
              <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
                <h3 className="font-display text-[15px] font-semibold tracking-tight">
                  Profile activity · last 7 days
                </h3>
                <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
                  REAL-TIME
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-hair-2">
                <MeStat icon={<Eye className="w-4 h-4 text-sky" />} label="Profile views" value="142" delta="+31 vs prev" />
                <MeStat icon={<Star className="w-4 h-4 text-gold" />} label="Scout views" value="7" delta="3 new colleges" />
                <MeStat icon={<TrendingUp className="w-4 h-4 text-grass" />} label="Share clicks" value="18" delta="+12 vs prev" />
              </div>
            </div>

            {/* Suggestions */}
            <div className="bg-card border border-hair rounded-lg">
              <div className="px-5 py-4 border-b border-hair-2">
                <h3 className="font-display text-[15px] font-semibold tracking-tight">
                  What to improve
                </h3>
                <p className="text-[11.5px] text-ink-3 mt-0.5">
                  Small tweaks that make a recruiter stop scrolling.
                </p>
              </div>
              <div>
                <SuggestionAction iconColor="red" iconName="Upload" title="Upload a slow-motion swing" meta="10 sec clip · boosts recruiter engagement by ~4x" cta="Upload" />
                <SuggestionAction iconColor="grass" iconName="CheckCircle2" title="Claim your verified badge" meta="Your coach has to confirm measurables — done" cta="View" />
                <SuggestionAction iconColor="gold" iconName="Star" title="Add SAT / ACT score" meta="Required by D1 recruiters for initial contact" cta="Add" />
                <SuggestionAction iconColor="sky" iconName="TrendingUp" title="Update your target colleges" meta="Helps Rostr surface your profile to those recruiters" cta="Update" />
              </div>
            </div>

            {/* Career trajectory preview */}
            <div className="bg-card border border-hair rounded-lg p-6">
              <div className="flex items-baseline gap-2">
                <div className="type-label">Your career trajectory</div>
                <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
                  EV MAX · 4 SEASONS
                </span>
              </div>
              <svg viewBox="0 0 680 120" className="w-full h-[140px] mt-3">
                {[30, 60, 90].map((y) => (
                  <line key={y} x1="0" y1={y} x2="680" y2={y} stroke="var(--hair-2)" />
                ))}
                <polyline
                  points="30,100 120,88 220,72 320,54 420,34 520,26 620,22"
                  fill="none"
                  stroke="var(--red)"
                  strokeWidth="2.5"
                />
                <polygon
                  points="30,100 120,88 220,72 320,54 420,34 520,26 620,22 620,120 30,120"
                  fill="rgba(200,58,58,.08)"
                />
                {[[30, 100], [120, 88], [220, 72], [320, 54], [420, 34], [520, 26]].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="3.5" fill="var(--red)" />
                ))}
                <circle cx="620" cy="22" r="5" fill="var(--red)" stroke="white" strokeWidth="2" />
              </svg>
              <div className="flex justify-between text-[10px] font-mono text-ink-4 mt-2">
                <span>Fr Fall &apos;22</span>
                <span>So &apos;23</span>
                <span>So &apos;24</span>
                <span>Jr &apos;24</span>
                <span>Jr &apos;25</span>
                <span>Sr · now</span>
              </div>
            </div>
          </div>

          {/* Side column */}
          <div className="flex flex-col gap-5">
            <div className="relative overflow-hidden bg-ink text-white rounded-lg p-5">
              <div
                aria-hidden
                className="absolute -top-12 -right-12 w-44 h-44 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(200,58,58,.3), transparent 65%)" }}
              />
              <div className="relative">
                <div className="type-label !text-red">Scout interest</div>
                <div className="font-mono text-[36px] font-semibold leading-none mt-1.5">7</div>
                <div className="text-[12.5px] text-white/70 mt-1">
                  college programs viewed your profile in the last 30 days
                </div>
                <Link
                  href={`/p/${me.handle}`}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-red font-semibold mt-4 hover:underline"
                >
                  See who →
                </Link>
              </div>
            </div>
            <div className="bg-card border border-hair rounded-lg p-5">
              <div className="type-label">Your coaches</div>
              <div className="space-y-2 mt-3 text-[13px]">
                <div className="flex items-center gap-2.5">
                  <Avatar size="sm" color="ink" initials="JR" />
                  <div className="flex-1">
                    <div className="font-semibold">Coach Joe Ruiz</div>
                    <div className="font-mono text-[10.5px] text-ink-3">Head · Lincoln HS</div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-grass-dim text-grass text-[9.5px] font-bold uppercase">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Avatar size="sm" color="dirt" initials="DM" />
                  <div className="flex-1">
                    <div className="font-semibold">Coach Dan Morales</div>
                    <div className="font-mono text-[10.5px] text-ink-3">17U · Texas Storm</div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-grass-dim text-grass text-[9.5px] font-bold uppercase">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-card border border-hair rounded-lg p-5">
              <div className="type-label">Quick actions</div>
              <div className="mt-3 flex flex-col gap-2">
                <QuickAction label="Upload a highlight" feature="Upload highlight" detail="Mux video upload + recruiter push — next sprint." />
                <QuickAction label="Edit academics" feature="Edit academics" detail="GPA / test scores / target schools — next sprint." />
                <QuickAction label="Privacy + visibility" feature="Privacy settings" detail="Control what's public vs. recruiter-only — next sprint." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeStat({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="type-label">{label}</span>
      </div>
      <div className="font-mono text-[28px] font-semibold tracking-[-0.02em] mt-1">{value}</div>
      <div className="text-[11px] text-grass font-semibold mt-0.5">{delta}</div>
    </div>
  );
}
