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
import { cn } from "@/lib/utils";
import { SPORTS, SportConfig } from "@/lib/sports";

const COACH_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

export default function ProgramSetup() {
  const { user, refreshCoach } = useAuth();
  const navigate = useNavigate();
  const [selectedSport, setSelectedSport] = useState<SportConfig | null>(null);
  const [programName, setProgramName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSport) return;
    setLoading(true);

    const { data: program, error: programError } = await supabase
      .from("programs")
      .insert({
        name: programName,
        school_name: schoolName,
        created_by: user.id,
        sport: selectedSport.id,
      })
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

    const metricsToInsert = selectedSport.defaultMetrics.map((m) => ({
      ...m,
      program_id: program.id,
      is_default: true,
    }));
    await supabase.from("metrics").insert(metricsToInsert as any);

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
          <p className="mt-1 text-muted-foreground">
            {selectedSport ? `Create your ${selectedSport.label.toLowerCase()} program` : "Choose your sport to get started"}
          </p>
        </div>

        {/* Sport selection */}
        {!selectedSport && (
          <Card className="shadow-elevated border-0 animate-fade-in">
            <CardContent className="pt-6">
              <Label className="text-sm font-semibold mb-3 block">Select Your Sport</Label>
              <div className="grid grid-cols-2 gap-3">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    onClick={() => setSelectedSport(sport)}
                    className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-md active:scale-95"
                  >
                    <span className="text-3xl">{sport.emoji}</span>
                    <span className="text-sm font-semibold">{sport.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Program details form */}
        {selectedSport && (
          <Card className="shadow-elevated border-0 animate-fade-in">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setSelectedSport(null)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Change sport
                </button>
                <span className="ml-auto text-lg">{selectedSport.emoji}</span>
                <span className="text-sm font-semibold">{selectedSport.label}</span>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="programName" className="text-sm font-semibold">Program Name</Label>
                  <Input
                    id="programName"
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    placeholder={selectedSport.placeholderProgramName}
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
        )}
      </div>
    </div>
  );
}
