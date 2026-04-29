import Link from "next/link";
import {
  HelpCircle,
  Upload,
  Users,
  Radio,
  ClipboardList,
  Megaphone,
  GraduationCap,
  Mail,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";

/**
 * /app/help — coach-facing FAQ + getting-started guide.
 * Designed to make confused coaches into power users instead of churn.
 */
export default function HelpPage() {
  return (
    <>
      <TopBar breadcrumbs={[{ label: "Help & docs" }]} />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-[800px] mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-md bg-red-soft text-red flex items-center justify-center">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Help &amp; docs
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-0.5">
                Quick answers and how-tos for the things coaches ask most.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <ContactCard />
            <PilotCard />
          </div>

          <h2 className="font-display text-[18px] font-semibold tracking-tight mb-3">
            Getting started
          </h2>
          <div className="space-y-3 mb-8">
            <FaqItem
              icon={<Users className="w-4 h-4" />}
              q="How do I import my roster from GameChanger?"
              a="Go to Roster → click 'Import roster' (top-right). Drop in your GameChanger CSV export, preview the table, click Import. Auto-detects columns like First Name, Last Name, Number, Position. Duplicates are skipped automatically."
            />
            <FaqItem
              icon={<Upload className="w-4 h-4" />}
              q="How do I import my season stats?"
              a="Roster → 'Import stats' button. Drop in the GameChanger team stats CSV (with batting + pitching + fielding sections). Players who aren't on your roster yet get created automatically. Re-importing the same CSV is safe — it overwrites the previous import."
            />
            <FaqItem
              icon={<ClipboardList className="w-4 h-4" />}
              q="How do I set up game-day prep for my players?"
              a="Open any game from /app/games. The Prep tab is the default for scheduled games. Fill in report time, school release time, uniform, equipment reminders, and lineup preview. Players see all of it on their /me page."
            />
            <FaqItem
              icon={<Radio className="w-4 h-4" />}
              q="How do I score a game live?"
              a="Open the game → click 'Score live' (top-right). Tap 'Start game' to kick off. Tap each at-bat outcome as it happens. Stats flow into player profiles + the scout search instantly. Works on phone (it's mobile-first)."
            />
            <FaqItem
              icon={<Megaphone className="w-4 h-4" />}
              q="How do players see their commitment / highlight video?"
              a="From Roster, click a player → 'Edit photos / commitment / post' on the Overview tab. Three tabs: photos (avatar + header + video URL), commitment (school + year), and announcements (post a feed update like 'Committed to Stanford!'). Pin commitment posts to keep them at the top."
            />
            <FaqItem
              icon={<GraduationCap className="w-4 h-4" />}
              q="My player got recruited — how do I show that on their profile?"
              a="Roster → click player → Edit modal → Commitment tab. Set status to Committed, add school + year. The badge shows up next to their name on /p/[handle] automatically. Then post a Commitment announcement to the feed for the celebration."
            />
          </div>

          <h2 className="font-display text-[18px] font-semibold tracking-tight mb-3">
            Day-to-day
          </h2>
          <div className="space-y-3 mb-8">
            <FaqItem
              q="How do I auto-fill a lineup?"
              a="Open a game → Lineup tab. If the lineup is empty, you'll see an 'Auto-fill lineup' button at the top. It uses each player's preferred position. You can rearrange after."
            />
            <FaqItem
              q="What about the DH? Who's pitching when DH is in the order?"
              a="Set any batting slot to position DH. A 'Defensive pitcher' row appears below slot 9 — pick the pitcher who's not batting. Saves automatically with the lineup."
            />
            <FaqItem
              q="Can I customize my team levels (no Varsity / JV / Freshman)?"
              a="Yes — at signup you set whatever team names you want (single team, multiple teams, any names). Edit later in Settings."
            />
            <FaqItem
              q="Why does my profile have fake data on it?"
              a="If the profile shows mock content (like 'Lincoln HS · Austin TX'), it means the player record isn't being loaded from the DB. Make sure the player has a profile_slug set. Real profiles only show data you've entered."
            />
          </div>

          <h2 className="font-display text-[18px] font-semibold tracking-tight mb-3">
            Recruiting
          </h2>
          <div className="space-y-3 mb-8">
            <FaqItem
              q="How do recruiters see my players?"
              a="Players' public profiles are at rostr.app/p/[handle]. Set profile_public to true on the player to make it visible. Recruiters using the /scout surface can filter by measurables, stats, position, and class year."
            />
            <FaqItem
              q="How do I share a player profile with a college coach?"
              a="Open the player's public profile (Roster → click player → 'View public profile'). Use the Share card on the right side to copy the URL or generate a QR code."
            />
          </div>
        </div>
      </div>
    </>
  );
}

function ContactCard() {
  return (
    <a
      href="mailto:hello@rostr.app"
      className="bg-ink text-white rounded-lg p-5 hover:bg-ink/90 transition-colors block"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red">
        <Mail className="w-3 h-3" /> Direct line
      </div>
      <div className="font-display text-[15px] font-semibold mt-1.5 leading-snug">
        Email us — we read every one.
      </div>
      <div className="text-[12px] text-white/70 mt-2">
        hello@rostr.app · we usually reply same-day.
      </div>
    </a>
  );
}

function PilotCard() {
  return (
    <div className="bg-card border border-hair rounded-lg p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-red">
        Pilot phase
      </div>
      <div className="font-display text-[15px] font-semibold mt-1.5 leading-snug">
        You&apos;re in the early access cohort.
      </div>
      <div className="text-[12px] text-ink-3 mt-2 leading-relaxed">
        Bugs, missing features, weird flows — tell us. Pilot feedback drives
        what ships next.
      </div>
    </div>
  );
}

function FaqItem({
  icon,
  q,
  a,
}: {
  icon?: React.ReactNode;
  q: string;
  a: string;
}) {
  return (
    <details className="bg-card border border-hair rounded-lg overflow-hidden group">
      <summary className="px-5 py-4 cursor-pointer flex items-center gap-3 list-none hover:bg-paper">
        {icon && (
          <span className="w-8 h-8 rounded-md bg-paper text-ink-3 flex items-center justify-center group-open:bg-red-soft group-open:text-red shrink-0">
            {icon}
          </span>
        )}
        <span className="flex-1 font-display text-[14.5px] font-semibold tracking-tight">
          {q}
        </span>
        <span className="text-ink-3 text-[20px] font-light leading-none group-open:rotate-45 transition-transform">
          +
        </span>
      </summary>
      <div className="px-5 pb-4 pt-0 text-[13px] text-ink-2 leading-relaxed">
        {a}
      </div>
    </details>
  );
}
