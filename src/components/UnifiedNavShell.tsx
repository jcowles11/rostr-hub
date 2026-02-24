import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Globe, Search, User, LogOut, Home, Bell } from "lucide-react";
import rostrLogo from "@/assets/rostr-logo.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface NavItem {
  key: string;
  icon: typeof Globe;
  label: string;
  path: string;
}

function getNavItems(role: string | null): NavItem[] {
  const items: NavItem[] = [];

  if (role === "scout") {
    items.push({ key: "search", icon: Search, label: "Search", path: "/scout" });
    items.push({ key: "social", icon: Globe, label: "Social", path: "/social" });
    items.push({ key: "notifications", icon: Bell, label: "Alerts", path: "/notifications" });
    items.push({ key: "profile", icon: User, label: "Profile", path: "/scout-profile" });
  } else if (role === "player") {
    items.push({ key: "feed", icon: Home, label: "Feed", path: "/social" });
    items.push({ key: "search", icon: Search, label: "Search", path: "/search" });
    items.push({ key: "notifications", icon: Bell, label: "Alerts", path: "/notifications" });
    items.push({ key: "profile", icon: User, label: "Profile", path: "/player-dashboard" });
  } else if (role === "evaluator") {
    items.push({ key: "social", icon: Globe, label: "Social", path: "/social" });
    items.push({ key: "notifications", icon: Bell, label: "Alerts", path: "/notifications" });
    items.push({ key: "profile", icon: User, label: "Profile", path: "/evaluator" });
  } else {
    items.push({ key: "social", icon: Globe, label: "Social", path: "/social" });
    items.push({ key: "notifications", icon: Bell, label: "Alerts", path: "/notifications" });
    items.push({ key: "profile", icon: User, label: "Profile", path: "/settings" });
  }

  return items;
}

function getActiveKey(pathname: string, role: string | null): string {
  if (role === "player") {
    if (pathname === "/social" || pathname.startsWith("/social")) return "feed";
    if (pathname === "/search") return "search";
    if (pathname === "/player-dashboard") return "profile";
    return "feed";
  }
  if (pathname === "/notifications") return "notifications";
  if (pathname === "/social" || pathname.startsWith("/social")) return "social";
  if (role === "scout" && pathname === "/scout") return "search";
  if (pathname === "/player-dashboard") return "profile";
  if (pathname === "/evaluator") return "profile";
  if (pathname === "/scout-profile") return "profile";
  if (pathname === "/settings") return "profile";
  return "social";
}

interface Props {
  children: ReactNode;
  showBottomNav?: boolean;
}

export default function UnifiedNavShell({ children, showBottomNav = true }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, signOut, scoutInfo, playerInfo, evaluatorInfo, coach, devRoleOverride } = useAuth();

  const effectiveRole = devRoleOverride || userRole;
  const navItems = getNavItems(effectiveRole);
  const activeKey = getActiveKey(location.pathname, effectiveRole);

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
            <span className="text-sm font-extrabold tracking-tight">Rostr</span>
          </div>

          <div className="flex items-center gap-2">
            {displayName && (
              <span className="text-xs text-muted-foreground font-medium truncate max-w-[120px]">
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
            {navItems.map(({ key, icon: Icon, label, path }) => {
              const active = activeKey === key;
              return (
                <button
                  key={key}
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
