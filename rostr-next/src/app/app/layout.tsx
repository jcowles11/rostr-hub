import {
  Home,
  Users,
  ClipboardList,
  Swords,
  CalendarDays,
  Trophy,
  MessageSquare,
  BarChart3,
  Settings,
  Sun,
  TrendingUp,
  HelpCircle,
  Zap,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@/components/organisms/app-sidebar";
import { MobileAppBar } from "@/components/organisms/mobile-app-bar";
import { BottomNav, APP_BOTTOM_TABS } from "@/components/organisms/bottom-nav";
import { MobileFab, APP_FAB_ACTIONS } from "@/components/organisms/mobile-fab";
import { InstallPrompt } from "@/components/organisms/install-prompt";
import { NavigationProgress } from "@/components/atoms/navigation-progress";
import { SetupBanner } from "@/components/molecules/setup-banner";
import { getSessionUser, displayName, initialsFrom } from "@/lib/auth";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchUpcomingGames } from "@/lib/services/schedule";

/**
 * /app layout — authenticated coach workspace.
 * Loads the real coach + program context from Supabase. Falls back to
 * a placeholder team (Lincoln HS mock) when the signed-in user has no
 * coach record yet, so the UI is never empty.
 */
interface BaseSection {
  label: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ReactNode;
    badgeKey?: "player_count" | "unread_msgs";
  }>;
}

const BASE_SECTIONS: BaseSection[] = [
  {
    label: "Daily",
    items: [
      { label: "Today", href: "/app/today", icon: <Sun className="w-4 h-4" /> },
      { label: "Hub", href: "/app", icon: <Home className="w-4 h-4" /> },
      { label: "Roster", href: "/app/roster", icon: <Users className="w-4 h-4" />, badgeKey: "player_count" },
      { label: "Stats", href: "/app/stats", icon: <TrendingUp className="w-4 h-4" /> },
      { label: "Practice", href: "/app/practice", icon: <ClipboardList className="w-4 h-4" /> },
      { label: "Live ABs", href: "/app/practice/live-abs", icon: <Zap className="w-4 h-4" /> },
    ],
  },
  {
    label: "Events",
    items: [
      { label: "Games", href: "/app/games", icon: <Swords className="w-4 h-4" /> },
      { label: "Schedule", href: "/app/schedule", icon: <CalendarDays className="w-4 h-4" /> },
    ],
  },
  {
    label: "Program",
    items: [
      { label: "Messages", href: "/app/messages", icon: <MessageSquare className="w-4 h-4" />, badgeKey: "unread_msgs" },
      { label: "Tryouts", href: "/app/tryouts", icon: <Trophy className="w-4 h-4" /> },
      { label: "Analytics", href: "/app/analytics", icon: <BarChart3 className="w-4 h-4" /> },
      { label: "Settings", href: "/app/settings", icon: <Settings className="w-4 h-4" /> },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "Help & docs", href: "/app/help", icon: <HelpCircle className="w-4 h-4" /> },
    ],
  },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, coach] = await Promise.all([getSessionUser(), getCurrentCoach()]);
  const name = coach?.full_name ?? displayName(user) ?? "Coach";
  const teamName = coach?.program_name ?? "Demo · Lincoln HS";
  const sport = coach?.program_sport ?? "Baseball";
  const level = coach?.program_levels?.[0] ?? "Varsity";
  const playerCount = coach?.player_count ?? 28;

  const sections: NavSection[] = BASE_SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      badge:
        item.badgeKey === "player_count"
          ? playerCount
          : item.badgeKey === "unread_msgs"
            ? 3
            : undefined,
    })),
  }));

  // "Up next" block in the sidebar — soonest scheduled game
  let upNext: { id: string; opponent: string; dateLabel: string; reportLabel: string | null } | null = null;
  if (coach) {
    const games = await fetchUpcomingGames(coach.program_id);
    const next = games[0];
    if (next) {
      const d = new Date(`${next.date}T00:00:00`);
      const dateLabel = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      // Pull report time if set
      const reportLabel: string | null = null; // populated below
      upNext = {
        id: next.id,
        opponent: next.opponent ?? "TBD",
        dateLabel,
        reportLabel,
      };
    }
  }

  const team = { name: teamName, sport, level, playerCount };
  const userCtx = {
    name,
    role: coach
      ? coach.role === "head_coach"
        ? "Head Coach"
        : "Assistant Coach"
      : ((user?.user_metadata?.role as string | undefined) === "player"
          ? "Player"
          : (user?.user_metadata?.role as string | undefined) === "recruiter"
            ? "Recruiter"
            : "Coach"),
    initials: initialsFrom(name),
  };

  return (
    <div className="flex lg:grid lg:grid-cols-[240px_1fr] h-screen bg-paper">
      {/* Global thin progress bar shown on every nav (link click +
          searchParam swap). Sits above all other chrome. */}
      <NavigationProgress />
      {/* Docked desktop sidebar — hidden below lg breakpoint. */}
      <div className="hidden lg:block">
        <AppSidebar team={team} sections={sections} user={userCtx} upNext={upNext} />
      </div>

      <main className="flex-1 lg:flex-initial flex flex-col overflow-hidden min-w-0">
        {/* Mobile-only top chrome with hamburger drawer. */}
        <MobileAppBar team={team} sections={sections} user={userCtx} />
        {!coach && <SetupBanner />}
        {children}
        {/* Mobile-only bottom tab bar — primary nav for thumb reach.
            Sits at the end of main's flex column so pages' internal
            `flex-1 overflow-auto` regions automatically reserve space
            for it. The "More" drawer surfaces every section that
            doesn't fit in the 5-tab bar, so coaches still have one-tap
            access to every workspace. */}
        <BottomNav tabs={APP_BOTTOM_TABS} moreSections={sections} />
      </main>
      {/* Floating Action Button — Twitter / LinkedIn / Apple-Notes
          pattern. Hovers above the bottom nav, opens an iOS-style
          bottom sheet of quick-add actions. Only renders on mobile. */}
      <MobileFab actions={APP_FAB_ACTIONS} />
      {/* Add-to-Home-Screen prompt — only renders on iOS Safari /
          Android Chrome when not already installed. Single biggest
          "feels like a real app" upgrade we can offer in browser. */}
      <InstallPrompt />
    </div>
  );
}
