import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Users, ClipboardList, BarChart3, Layers, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Users, label: "Roster" },
  { path: "/score", icon: ClipboardList, label: "Score" },
  { path: "/dashboard", icon: BarChart3, label: "Stats" },
  { path: "/roster-board", icon: Layers, label: "Board" },
  { path: "/settings", icon: Settings, label: "More" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/90 backdrop-blur-2xl shadow-nav">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 tap-target transition-all duration-300 ease-out",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-2xl bg-primary/8 animate-scale-in" />
                )}
                <Icon
                  className={cn(
                    "relative z-10 h-5 w-5 transition-all duration-300",
                    active && "scale-110"
                  )}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={cn(
                  "relative z-10 text-[10px] transition-all duration-300",
                  active ? "font-bold" : "font-medium"
                )}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
