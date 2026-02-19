import { useState } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const COACH_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

const DEFAULT_METRICS = [
  { name: "60-Yard Dash", unit: "sec", category: "running" as const, metric_type: "timed" as const, sort_order: 1 },
  { name: "Home to First", unit: "sec", category: "running" as const, metric_type: "timed" as const, sort_order: 2 },
  { name: "Exit Velocity", unit: "mph", category: "hitting" as const, metric_type: "measured" as const, sort_order: 3 },
  { name: "Arm Velocity (IF)", unit: "mph", category: "fielding" as const, metric_type: "measured" as const, sort_order: 4 },
  { name: "Arm Velocity (OF)", unit: "mph", category: "fielding" as const, metric_type: "measured" as const, sort_order: 5 },
  { name: "Arm Velocity (C)", unit: "mph", category: "fielding" as const, metric_type: "measured" as const, sort_order: 6 },
  { name: "Fastball Velo", unit: "mph", category: "pitching" as const, metric_type: "measured" as const, sort_order: 7 },
  { name: "Fielding", unit: "1-10", category: "fielding" as const, metric_type: "rated" as const, min_value: 1, max_value: 10, sort_order: 8 },
  { name: "Hitting", unit: "1-10", category: "hitting" as const, metric_type: "rated" as const, min_value: 1, max_value: 10, sort_order: 9 },
  { name: "Hustle/Attitude", unit: "1-5", category: "other" as const, metric_type: "rated" as const, min_value: 1, max_value: 5, sort_order: 10 },
];

export default function ProgramSetup() {
  const { user, refreshCoach } = useAuth();
  const navigate = useNavigate();
  const [programName, setProgramName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { data: program, error: programError } = await supabase
      .from("programs")
      .insert({ name: programName, school_name: schoolName, created_by: user.id })
      .select()
      .single();

    if (programError || !program) {
      toast.error("Failed to create program");
      setLoading(false);
      return;
    }

    const { error: coachError } = await supabase.from("coaches").insert({
      user_id: user.id,
      program_id: program.id,
      full_name: user.user_metadata?.full_name || user.email || "Head Coach",
      email: user.email || "",
      role: "head_coach",
      color: COACH_COLORS[0],
    });

    if (coachError) {
      toast.error("Failed to set up coach profile");
      setLoading(false);
      return;
    }

    const metricsToInsert = DEFAULT_METRICS.map((m) => ({
      ...m,
      program_id: program.id,
      is_default: true,
    }));
    await supabase.from("metrics").insert(metricsToInsert);

    await refreshCoach();
    toast.success("Program created!");
    setLoading(false);
    navigate("/");
  };

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8 animate-slide-up">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow object-cover" />
          <h1 className="text-3xl font-extrabold tracking-tight">Set Up Your Program</h1>
          <p className="mt-1 text-muted-foreground">Create your baseball program to start managing tryouts</p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="programName" className="text-sm font-semibold">Program Name</Label>
                <Input
                  id="programName"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="Eagles Baseball"
                  required
                  className="tap-target h-12 text-base rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolName" className="text-sm font-semibold">School Name</Label>
                <Input
                  id="schoolName"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Lincoln High School"
                  required
                  className="tap-target h-12 text-base rounded-xl"
                />
              </div>
              <Button type="submit" className="w-full tap-target h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-glow hover:shadow-lg transition-all duration-200" disabled={loading}>
                {loading ? "Creating..." : "Create Program"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
