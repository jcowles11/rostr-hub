import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, User, Eye, Search, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import rostrLogo from "@/assets/rostr-logo.png";

const DEMO_ROLES = [
  {
    key: "coach",
    label: "Coach Demo",
    description: "Run baseball tryouts, manage rosters, score & rank players",
    icon: Shield,
    path: "/",
    color: "from-blue-500 to-blue-600",
  },
  {
    key: "player",
    label: "Player Demo",
    description: "Social feed, player profile, metrics & recruiting visibility",
    icon: User,
    path: "/social",
    color: "from-green-500 to-green-600",
  },
  {
    key: "scout",
    label: "Scout Demo",
    description: "Search, filter & discover baseball players by stats",
    icon: Search,
    path: "/scout",
    color: "from-purple-500 to-purple-600",
  },
  {
    key: "evaluator",
    label: "Evaluator Demo",
    description: "Evaluate players & submit verified baseball metrics",
    icon: Eye,
    path: "/evaluator",
    color: "from-amber-500 to-amber-600",
  },
] as const;

export default function DemoTour() {
  const navigate = useNavigate();
  const { user, setDevRoleOverride } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleRoleSelect = async (role: typeof DEMO_ROLES[number]) => {
    setLoadingRole(role.key);
    try {
      let userId = user?.id;

      // If not signed in, sign in anonymously
      if (!userId) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        userId = data.user?.id;
        if (!userId) throw new Error("Failed to create anonymous session");
      }

      // Provision demo access via edge function
      const { error: provisionError } = await supabase.functions.invoke("provision-demo-access", {
        body: { role: role.key, user_id: userId },
      });
      if (provisionError) throw provisionError;

      // Set demo mode flags
      setDevRoleOverride(role.key as any);
      sessionStorage.setItem("rostr_demo_mode", "1");

      // Full page reload to let AuthContext pick up the new records
      window.location.href = role.path;
    } catch (e: any) {
      toast.error(`Demo setup failed: ${e.message}`);
      setLoadingRole(null);
    }
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
            Choose a role to explore. No sign-in required.
          </p>
        </div>

        <div className="grid gap-3">
          {DEMO_ROLES.map((role) => {
            const Icon = role.icon;
            const isLoading = loadingRole === role.key;
            return (
              <button
                key={role.key}
                onClick={() => handleRoleSelect(role)}
                disabled={!!loadingRole}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${role.color} text-white shadow-md`}>
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{role.label}</p>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
              </button>
            );
          })}
        </div>

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
