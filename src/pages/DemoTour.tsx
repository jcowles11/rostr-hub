import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, User, Eye, Search, Zap, Loader2, ArrowLeft, ChevronRight } from "lucide-react";
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
    highlights: ["25-player roster across Varsity & JV", "Game schedule with lineups", "Tryout scoring & player rankings"],
    icon: Shield,
    path: "/",
    color: "from-blue-500 to-blue-600",
  },
  {
    key: "player",
    label: "Player Demo",
    description: "Social feed, player profile, metrics & recruiting visibility",
    highlights: ["Player profile with stats & positions", "Social feed with team activity", "Recruiting profile visibility"],
    icon: User,
    path: "/social",
    color: "from-green-500 to-green-600",
  },
  {
    key: "scout",
    label: "Scout Demo",
    description: "Search, filter & discover baseball players by stats",
    highlights: ["Filter players by position, grade & stats", "Compare player metrics side-by-side", "Export scouting reports"],
    icon: Search,
    path: "/scout",
    color: "from-purple-500 to-purple-600",
  },
  {
    key: "evaluator",
    label: "Evaluator Demo",
    description: "Evaluate players & submit verified baseball metrics",
    highlights: ["Score players on 8 baseball metrics", "Multiple tryout sessions with history", "Verified evaluation reports"],
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
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="h-3 w-3" />
            Back to home
          </Link>
          <img src={rostrLogo} alt="Rostr" className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-lg" />
          <h1 className="text-2xl font-black tracking-tight">Demo Tour</h1>
          <p className="text-muted-foreground text-sm">
            Choose a role to explore. No sign-in required — we'll create a temporary account for you.
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
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${role.color} text-white shadow-md`}>
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{role.label}</p>
                  <p className="text-xs text-muted-foreground mb-1.5">{role.description}</p>
                  <ul className="space-y-0.5">
                    {role.highlights.map((h) => (
                      <li key={h} className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                        <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
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
            {seeding ? "Seeding demo data..." : "Re-seed Demo Data"}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            Already in demo mode? Re-seed to refresh with 25 players, 11 games, 9 practices, 8 metrics & 3 tryout sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
