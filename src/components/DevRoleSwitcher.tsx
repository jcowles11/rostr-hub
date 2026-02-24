import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Bug, ChevronUp, Shield, User, Eye, Search } from "lucide-react";

const ROLES = [
  { key: "coach", label: "Coach", icon: Shield, path: "/", color: "text-blue-400" },
  { key: "player", label: "Player", icon: User, path: "/player-dashboard", color: "text-green-400" },
  { key: "evaluator", label: "Evaluator", icon: Eye, path: "/evaluator", color: "text-amber-400" },
  { key: "scout", label: "Scout", icon: Search, path: "/scout", color: "text-purple-400" },
] as const;

export default function DevRoleSwitcher() {
  const { user, userRole, setDevRoleOverride, devRoleOverride } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const activeRole = devRoleOverride || userRole;

  const handleSwitch = (role: typeof ROLES[number]) => {
    if (role.key === devRoleOverride) {
      // Clear override — go back to real role
      setDevRoleOverride(null);
    } else {
      setDevRoleOverride(role.key as any);
    }
    navigate(role.path);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-24 right-4 z-[100] sm:bottom-6">
      {open && (
        <div className="mb-2 rounded-2xl border bg-card/95 backdrop-blur-xl shadow-xl p-3 space-y-1 animate-scale-in">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1">
            Switch Role {devRoleOverride && <span className="text-amber-400">(overriding)</span>}
          </p>
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isActive = activeRole === role.key;
            return (
              <button
                key={role.key}
                onClick={() => handleSwitch(role)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && role.color)} />
                {role.label}
                {isActive && devRoleOverride && (
                  <span className="ml-auto text-[10px] text-amber-400 font-bold">DEMO</span>
                )}
                {isActive && !devRoleOverride && (
                  <span className="ml-auto text-[10px] text-muted-foreground">real</span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => { setDevRoleOverride(null); setOpen(false); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-all"
          >
            Clear override
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold shadow-lg transition-all",
          devRoleOverride
            ? "bg-amber-500/90 text-white"
            : "bg-card/90 border text-muted-foreground hover:text-foreground"
        )}
      >
        <Bug className="h-3.5 w-3.5" />
        {devRoleOverride ? `Demo: ${devRoleOverride}` : "Dev"}
        <ChevronUp className={cn("h-3 w-3 transition-transform", !open && "rotate-180")} />
      </button>
    </div>
  );
}
