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
} from "lucide-react";
import { AppSidebar, type NavSection } from "@/components/organisms/app-sidebar";
import { SetupBanner } from "@/components/molecules/setup-banner";
import { getSessionUser, displayName, initialsFrom } from "@/lib/auth";
import { getCurrentCoach } from "@/lib/services/coach";

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
      { label: "Hub", href: "/app", icon: <Home className="w-4 h-4" /> },
      { label: "Roster", href: "/app/roster", icon: <Users className="w-4 h-4" />, badgeKey: "player_count" },
      { label: "Practice", href: "/app/practice", icon: <ClipboardList className="w-4 h-4" /> },
    ],
  },
  {
    label: "Events",
    items: [
      { label: "Games", href: "/app/games", icon: <Swords className="w-4 h-4" /> },
      { label: "Schedule", href: "/app/schedule", icon: <CalendarDays className="w-4 h-4" /> },
      { label: "Tryouts", href: "/app/tryouts", icon: <Trophy className="w-4 h-4" /> },
    ],
  },
  {
    label: "Program",
    items: [
      { label: "Messages", href: "/app/messages", icon: <MessageSquare className="w-4 h-4" />, badgeKey: "unread_msgs" },
      { label: "Analytics", href: "/app/analytics", icon: <BarChart3 className="w-4 h-4" /> },
      { label: "Settings", href: "/app/settings", icon: <Settings className="w-4 h-4" /> },
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

  return (
    <div className="grid grid-cols-[220px_1fr] h-screen bg-paper">
      <AppSidebar
        team={{ name: teamName, sport, level, playerCount }}
        sections={sections}
        user={{
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
        }}
      />
      <main className="flex flex-col overflow-hidden">
        {!coach && <SetupBanner />}
        {children}
      </main>
    </div>
  );
}
