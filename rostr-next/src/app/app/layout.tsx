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

/**
 * /app layout — authenticated coach workspace.
 * Sidebar nav structure lives here so every /app/* route inherits it.
 * Real team/user data will come from Supabase; this is placeholder.
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
      { label: "Tryouts", href: "/app/tryouts/spring-2026", icon: <Trophy className="w-4 h-4" /> },
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] h-screen bg-paper">
      <AppSidebar
        team={{
          name: "Lincoln HS",
          sport: "Baseball",
          level: "Varsity",
          playerCount: 28,
        }}
        sections={SECTIONS}
        user={{
          name: "Coach Martinez",
          role: "Head Coach",
          initials: "CM",
        }}
      />
      <main className="flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
