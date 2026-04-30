import {
  Home,
  Users,
  ClipboardList,
  Swords,
  CalendarDays,
  Sun,
  TrendingUp,
  Trophy,
  BarChart3,
  Mail,
  Settings,
  HelpCircle,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@/components/organisms/app-sidebar";
import { MobileAppBar } from "@/components/organisms/mobile-app-bar";
import { BottomNav, DEMO_BOTTOM_TABS } from "@/components/organisms/bottom-nav";
import { MobileFab, DEMO_FAB_ACTIONS } from "@/components/organisms/mobile-fab";
import { DemoBanner } from "@/components/organisms/demo-banner";
import { InstallPrompt } from "@/components/organisms/install-prompt";
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
    /* h-[100dvh] respects the mobile browser's dynamic viewport — it
       shrinks when iOS Safari's URL bar is showing and grows when it
       hides on scroll. h-screen (100vh) reports the largest possible
       viewport, which pushes the bottom nav below the visible area
       until the URL bar collapses. Big mobile-feel bug fix. */
    <div className="flex lg:grid lg:grid-cols-[240px_1fr] h-[100dvh] bg-paper">
      <div className="hidden lg:block">
        <AppSidebar team={team} sections={DEMO_SECTIONS} user={userCtx} upNext={null} />
      </div>
      <main className="flex-1 lg:flex-initial flex flex-col overflow-hidden min-w-0">
        <MobileAppBar team={team} sections={DEMO_SECTIONS} user={userCtx} />
        <DemoBanner />
        {/* Page-enter wrapper. This div is itself a flex-col flex-1
            child of <main>, mirroring main's own column. Children
            (page components) flow inside it normally. The animation
            applies to this wrapper, so every route swap fades + slides
            in on mount. The wrapper re-renders on route change because
            Next.js's app-router uses pathname as an implicit React key
            for the children slot — re-mounted div = replayed animation. */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 animate-page-enter">
          {children}
        </div>
        {/* Mobile-only bottom tab bar — mirrors the /app version but
            points at /demo destinations. */}
        <BottomNav tabs={DEMO_BOTTOM_TABS} moreSections={DEMO_SECTIONS} />
      </main>
      {/* Mobile FAB — same iOS-style quick-add sheet, /demo links. */}
      <MobileFab actions={DEMO_FAB_ACTIONS} />
      {/* Add-to-Home-Screen prompt — only renders on iOS Safari /
          Android Chrome when not already installed. The single biggest
          "feels like an app" upgrade we can offer in a browser. */}
      <InstallPrompt />
    </div>
  );
}
