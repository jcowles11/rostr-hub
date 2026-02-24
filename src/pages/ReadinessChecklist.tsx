import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckItem {
  label: string;
  description: string;
  passed: boolean | null; // null = loading
}

export default function ReadinessChecklist() {
  const { coach } = useAuth();
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coach) return;
    runChecks();
  }, [coach]);

  const runChecks = async () => {
    if (!coach) return;
    setLoading(true);

    const programId = coach.program_id;

    // Run all checks in parallel
    const [
      coachesRes,
      playersRes,
      sessionsRes,
      evalsRes,
      metricsRes,
      linkedPlayersRes,
    ] = await Promise.all([
      supabase.from("coaches").select("id, role").eq("program_id", programId),
      supabase.from("players").select("id").eq("program_id", programId),
      supabase.from("tryout_sessions").select("id").eq("program_id", programId),
      supabase.from("evaluations").select("id").eq("program_id", programId).limit(1),
      supabase.from("metrics").select("id").eq("program_id", programId),
      supabase.from("players").select("id").eq("program_id", programId).not("user_id", "is", null).limit(1),
    ]);

    const coaches = coachesRes.data || [];
    const players = playersRes.data || [];
    const sessions = sessionsRes.data || [];
    const hasEvals = (evalsRes.data || []).length > 0;
    const hasMetrics = (metricsRes.data || []).length > 0;
    const hasLinkedPlayer = (linkedPlayersRes.data || []).length > 0;
    const hasAssistant = coaches.some((c) => c.role === "assistant_coach");

    setChecks([
      {
        label: "Program created",
        description: `Program "${coach.program_name}" is active.`,
        passed: true,
      },
      {
        label: "Metrics configured",
        description: hasMetrics
          ? `${(metricsRes.data || []).length} metric(s) set up.`
          : "No metrics configured. Go to Settings → Metrics & Drills.",
        passed: hasMetrics,
      },
      {
        label: "Assistant coach invited",
        description: hasAssistant
          ? "At least one assistant coach is on staff."
          : "No assistant coaches yet. Add one in Settings → Coaching Staff.",
        passed: hasAssistant,
      },
      {
        label: "Roster created / imported",
        description: players.length > 0
          ? `${players.length} player(s) on roster.`
          : "No players yet. Add manually or import via CSV.",
        passed: players.length > 0,
      },
      {
        label: "Tryout session created",
        description: sessions.length > 0
          ? `${sessions.length} session(s) created.`
          : "No tryout sessions yet. Create one from the header Event dropdown.",
        passed: sessions.length > 0,
      },
      {
        label: "At least 1 session scored",
        description: hasEvals
          ? "Evaluation data exists."
          : "No scores entered yet. Go to Score Entry to begin.",
        passed: hasEvals,
      },
      {
        label: "Analysis page loads",
        description: hasEvals
          ? "Dashboard should show data. Verify manually."
          : "No data to analyze yet — score some players first.",
        passed: hasEvals,
      },
      {
        label: "Player account linked",
        description: hasLinkedPlayer
          ? "At least one player account is linked."
          : "No player accounts linked yet. Share the registration link with players.",
        passed: hasLinkedPlayer,
      },
    ]);

    setLoading(false);
  };

  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  const allPassed = passedCount === totalCount && totalCount > 0;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24 animate-fade-in">
      <div className="page-hero mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Deployment Readiness
        </h1>
        <p className="text-white/70 text-sm mt-0.5">
          {loading
            ? "Checking..."
            : allPassed
              ? "✅ All checks passed — you're ready for tryouts!"
              : `${passedCount} of ${totalCount} checks passed`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {checks.map((check, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-all",
                check.passed
                  ? "border-green-500/20"
                  : "border-amber-500/20"
              )}
            >
              {check.passed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-semibold">{check.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {check.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
