import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Users, Globe, Search, User, LogOut } from "lucide-react";
import rostrLogo from "@/assets/rostr-logo.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type Section = "coach" | "social" | "scout" | "profile";

interface NavItem {
  section: Section;
  icon: typeof Users;
  label: string;
  path: string;
}

function getNavItems(role: string | null): NavItem[] {
  const items: NavItem[] = [];

  if (role === "coach") {
    items.push({ section: "coach", icon: Users, label: "Coach", path: "/" });
  }

  // Social is available to all authenticated roles
  items.push({ section: "social", icon: Globe, label: "Social", path: "/social" });

  if (role === "scout") {
    items.push({ section: "scout", icon: Search, label: "Scout", path: "/scout" });
  }

  items.push({ section: "profile", icon: User, label: "Profile", path: getProfilePath(role) });

  return items;
}

function getProfilePath(role: string | null): string {
  switch (role) {
    case "player": return "/player-dashboard";
    case "evaluator": return "/evaluator";
    case "scout": return "/scout";
    default: return "/settings";
  }
}

function getActiveSection(pathname: string, role: string | null): Section {
  if (pathname === "/social" || pathname.startsWith("/social")) return "social";
  if (pathname === "/scout") return "scout";
  if (pathname === "/player-dashboard" || pathname === "/evaluator" || pathname === "/settings") return "profile";
  if (role === "coach" && ["/", "/score", "/dashboard", "/roster-board", "/export", "/plan", "/settings"].some(p => pathname === p || pathname.startsWith("/player/"))) return "coach";
  return "social";
}

interface Props {
  children: ReactNode;
  showBottomNav?: boolean;
}

export default function UnifiedNavShell({ children, showBottomNav = true }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, signOut, scoutInfo, playerInfo, evaluatorInfo, coach } = useAuth();

  const navItems = getNavItems(userRole);
  const activeSection = getActiveSection(location.pathname, userRole);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayName = coach?.full_name || playerInfo?.first_name || evaluatorInfo?.full_name || scoutInfo?.full_name || "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <img src={rostrLogo} alt="Rostr" className="h-7 w-7 rounded-lg object-cover" />
            <span className="text-sm font-extrabold tracking-tight hidden sm:block">Rostr</span>
          </div>

          {/* Desktop nav tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(({ section, icon: Icon, label, path }) => (
              <button
                key={section}
                onClick={() => navigate(path)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all",
                  activeSection === section
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {displayName && (
              <span className="text-xs text-muted-foreground font-medium hidden sm:block truncate max-w-[120px]">
                {displayName}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground h-8 w-8 p-0">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 sm:pb-8">{children}</main>

      {/* Mobile bottom nav */}
      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/90 backdrop-blur-2xl shadow-nav sm:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
            {navItems.map(({ section, icon: Icon, label, path }) => {
              const active = activeSection === section;
              return (
                <button
                  key={section}
                  onClick={() => navigate(path)}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 tap-target transition-all duration-300 ease-out",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && <span className="absolute inset-0 rounded-2xl bg-primary/8 animate-scale-in" />}
                  <Icon className={cn("relative z-10 h-5 w-5 transition-all duration-300", active && "scale-110")} strokeWidth={active ? 2.5 : 1.8} />
                  <span className={cn("relative z-10 text-[10px] transition-all duration-300", active ? "font-bold" : "font-medium")}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
