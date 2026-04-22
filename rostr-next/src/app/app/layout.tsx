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
import { getSessionUser, displayName, initialsFrom } from "@/lib/auth";

/**
 * /app layout — authenticated coach workspace.
 * Sidebar nav structure lives here so every /app/* route inherits it.
 */
const SECTIONS: NavSection[] = [
  {
    label: "Daily",
    items: [
      { label: "Hub", href: "/app", icon: <Home className="w-4 h-4" /> },
      { label: "Roster", href: "/app/roster", icon: <Users className="w-4 h-4" />, badge: 28 },
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
      { label: "Messages", href: "/app/messages", icon: <MessageSquare className="w-4 h-4" />, badge: 3 },
      { label: "Analytics", href: "/app/analytics", icon: <BarChart3 className="w-4 h-4" /> },
      { label: "Settings", href: "/app/settings", icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const name = displayName(user) || "Coach";
  const programName =
    (user?.user_metadata?.program_name as string | undefined) ?? "Lincoln HS";

  return (
    <div className="grid grid-cols-[220px_1fr] h-screen bg-paper">
      <AppSidebar
        team={{
          name: programName,
          sport: "Baseball",
          level: "Varsity",
          playerCount: 28,
        }}
        sections={SECTIONS}
        user={{
          name,
          role:
            ((user?.user_metadata?.role as string | undefined) === "player"
              ? "Player"
              : (user?.user_metadata?.role as string | undefined) === "recruiter"
                ? "Recruiter"
                : "Head Coach"),
          initials: initialsFrom(name),
        }}
      />
      <main className="flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
