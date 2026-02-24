import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, User, Eye, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import rostrLogo from "@/assets/rostr-logo.png";

const DEMO_ROLES = [
  {
    key: "coach",
    label: "Coach Demo",
    description: "Tryouts, roster management, scoring, stats & sorting",
    icon: Shield,
    path: "/",
    color: "from-blue-500 to-blue-600",
  },
  {
    key: "player",
    label: "Player Demo",
    description: "Social feed, profile, metrics & recruiting visibility",
    icon: User,
    path: "/social",
    color: "from-green-500 to-green-600",
  },
  {
    key: "scout",
    label: "Scout Demo",
    description: "Search, filter, sort & discover players",
    icon: Search,
    path: "/scout",
    color: "from-purple-500 to-purple-600",
  },
  {
    key: "evaluator",
    label: "Evaluator Demo",
    description: "Evaluate players, submit verified metrics",
    icon: Eye,
    path: "/evaluator",
    color: "from-amber-500 to-amber-600",
  },
] as const;

export default function DemoTour() {
  const navigate = useNavigate();
  const { user, setDevRoleOverride } = useAuth();
  const [seeding, setSeeding] = useState(false);

  const handleRoleSelect = (role: typeof DEMO_ROLES[number]) => {
    setDevRoleOverride(role.key as any);
    sessionStorage.setItem("rostr_demo_mode", "1");
    navigate(role.path);
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo-data");
      if (error) throw error;
      toast.success(`Demo data seeded! ${data?.message || ""}`);
    } catch (e: any) {
      toast.error(`Seed failed: ${e.message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <img src={rostrLogo} alt="Rostr" className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-lg" />
          <h1 className="text-2xl font-black tracking-tight">Demo Tour</h1>
          <p className="text-muted-foreground text-sm">
            Choose a role to explore. Switch anytime with the floating button.
          </p>
        </div>

        <div className="grid gap-3">
          {DEMO_ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.key}
                onClick={() => handleRoleSelect(role)}
                disabled={!user}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${role.color} text-white shadow-md`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{role.label}</p>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {!user && (
          <p className="text-center text-xs text-muted-foreground">
            Please <button onClick={() => navigate("/auth")} className="text-primary underline">log in</button> first to use demo mode.
          </p>
        )}

        <div className="border-t pt-6 space-y-3">
          <Button
            onClick={handleSeedData}
            disabled={seeding || !user}
            variant="outline"
            className="w-full gap-2"
          >
            <Zap className="h-4 w-4" />
            {seeding ? "Seeding demo data..." : "Seed Demo Data"}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            Populates the database with 150 players, posts, programs, coaches, scouts & evaluators.
          </p>
        </div>
      </div>
    </div>
  );
}
