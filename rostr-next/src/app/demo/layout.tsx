import {
  Home,
  Users,
  ClipboardList,
  Swords,
  CalendarDays,
  Eye,
  Sun,
  TrendingUp,
  Trophy,
  BarChart3,
  Mail,
  Settings,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { AppSidebar, type NavSection } from "@/components/organisms/app-sidebar";
import { MobileAppBar } from "@/components/organisms/mobile-app-bar";
import { BottomNav, DEMO_BOTTOM_TABS } from "@/components/organisms/bottom-nav";
import { initialsFrom } from "@/lib/auth";
import { MOCK_TEAM, MOCK_COACH, MOCK_PLAYERS } from "@/lib/mock-data";

/**
 * /demo — interactive product walkthrough.
 *
 * Mirrors the real /app layout (sidebar + main column) but with no
 * auth, no Supabase reads, and a sticky DEMO banner. All sidebar
 * links route to /demo/* mirror pages that render the same client
 * components as /app/* but with mock data passed as props.
 *
 * Mutations from inside the demo (create player, log at-bat, etc.)
 * call real server actions which fail with "No program" toasts —
 * that's intentional friction that pushes the prospect toward signup.
 * For a polished demo experience, see seeded-account flow at /signup.
 */

/**
 * Sidebar items shown in the demo. Mirrors the full /app sidebar so
 * prospects can click into every product surface — Hub, Today, Roster,
 * Practice, Games, Schedule, Stats, Tryouts, Analytics, Messages,
 * Settings, Help. Each item points to a corresponding /demo/* page
 * that renders the real view component (or a parallel demo-only page
 * where the original is too coupled to live data) with mock data.
 */
const DEMO_SECTIONS: NavSection[] = [
  {
    label: "Daily",
    items: [
      { label: "Hub", href: "/demo", icon: <Home className="w-4 h-4" /> },
      { label: "Today", href: "/demo/today", icon: <Sun className="w-4 h-4" /> },
      { label: "Roster", href: "/demo/roster", icon: <Users className="w-4 h-4" />, badge: MOCK_PLAYERS.length },
      { label: "Practice", href: "/demo/practice", icon: <ClipboardList className="w-4 h-4" /> },
    ],
  },
  {
    label: "Events",
    items: [
      { label: "Games", href: "/demo/games", icon: <Swords className="w-4 h-4" /> },
      { label: "Schedule", href: "/demo/schedule", icon: <CalendarDays className="w-4 h-4" /> },
      { label: "Tryouts", href: "/demo/tryouts", icon: <Trophy className="w-4 h-4" /> },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Stats", href: "/demo/stats", icon: <TrendingUp className="w-4 h-4" /> },
      { label: "Analytics", href: "/demo/analytics", icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Messages", href: "/demo/messages", icon: <Mail className="w-4 h-4" />, badge: 2 },
      { label: "Settings", href: "/demo/settings", icon: <Settings className="w-4 h-4" /> },
      { label: "Help", href: "/demo/help", icon: <HelpCircle className="w-4 h-4" /> },
    ],
  },
];

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const team = {
    name: MOCK_TEAM.name,
    sport: MOCK_TEAM.sport,
    level: MOCK_TEAM.level,
    playerCount: MOCK_PLAYERS.length,
  };
  const userCtx = {
    name: MOCK_COACH.name,
    role: MOCK_COACH.role,
    initials: initialsFrom(MOCK_COACH.name),
  };

  return (
    <div className="flex lg:grid lg:grid-cols-[240px_1fr] h-screen bg-paper">
      <div className="hidden lg:block">
        <AppSidebar team={team} sections={DEMO_SECTIONS} user={userCtx} upNext={null} />
      </div>
      <main className="flex-1 lg:flex-initial flex flex-col overflow-hidden min-w-0">
        <MobileAppBar team={team} sections={DEMO_SECTIONS} user={userCtx} />
        <DemoBanner />
        {children}
        {/* Mobile-only bottom tab bar — mirrors the /app version but
            points at /demo destinations. */}
        <BottomNav tabs={DEMO_BOTTOM_TABS} moreSections={DEMO_SECTIONS} />
      </main>
    </div>
  );
}

/**
 * Sticky DEMO banner — sits below the mobile app bar, above all
 * page content. Tells visitors this is fake data + how to get the
 * real thing. Single tap on the CTA goes to signup.
 */
function DemoBanner() {
  return (
    <div className="sticky top-0 z-[40] bg-amber-soft border-b-2 border-amber">
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap max-w-layout-app mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-3 hover:text-ink whitespace-nowrap"
          title="Back to Rostr home"
        >
          <ArrowLeft className="w-3 h-3" />
          Home
        </Link>
        <span className="text-ink-4">·</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-amber text-white text-[10px] font-bold uppercase tracking-[0.08em]">
          <Eye className="w-3 h-3" />
          Demo
        </span>
        <span className="text-[12.5px] text-ink-2 leading-snug flex-1 min-w-[180px]">
          Fictional Lincoln HS data — click anywhere, nothing saves.
        </span>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1 text-[12.5px] font-bold text-red hover:underline whitespace-nowrap"
        >
          Sign up to use it for real →
        </Link>
      </div>
    </div>
  );
}
