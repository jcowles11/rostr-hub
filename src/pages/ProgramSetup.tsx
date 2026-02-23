import { useState, useEffect } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SPORTS, SportConfig } from "@/lib/sports";

const COACH_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

export default function ProgramSetup() {
  const { user, organizations, refreshCoach } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"org" | "sport" | "details">("org");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [newOrgName, setNewOrgName] = useState("");
  const [selectedSport, setSelectedSport] = useState<SportConfig | null>(null);
  const [programName, setProgramName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);

  // If user has existing orgs, default to selecting one
  useEffect(() => {
    if (organizations.length === 1) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSport) return;
    setLoading(true);

    try {
      // 1. Resolve organization
      let orgId = selectedOrgId;
      if (!orgId) {
        // Create new organization
        const orgName = newOrgName.trim() || schoolName.trim();
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert({ name: orgName, created_by: user.id })
          .select()
          .single();
        if (orgError || !org) {
          toast.error("Failed to create organization");
          setLoading(false);
          return;
        }
        orgId = org.id;

        // Add user as org admin
        await supabase.from("organization_members").insert({
          user_id: user.id,
          organization_id: orgId,
          role: "admin",
          full_name: user.user_metadata?.full_name || user.email || "Admin",
          email: user.email || "",
          color: COACH_COLORS[0],
        });
      }

      // 2. Create program
      const { data: program, error: programError } = await supabase
        .from("programs")
        .insert({
          name: programName,
          school_name: schoolName || newOrgName,
          created_by: user.id,
          sport: selectedSport.id,
          organization_id: orgId,
        })
        .select()
        .single();

      if (programError || !program) {
        toast.error("Failed to create program");
        setLoading(false);
        return;
      }

      // 3. Create coach record (for evaluation attribution)
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

      // 4. Create organization_member at program level
      await supabase.from("organization_members").insert({
        user_id: user.id,
        program_id: program.id,
        role: "admin",
        full_name: user.user_metadata?.full_name || user.email || "Head Coach",
        email: user.email || "",
        color: COACH_COLORS[0],
      });

      // 5. Create default team
      await supabase.from("teams").insert({
        program_id: program.id,
        name: "Main Team",
      });

      // 6. Seed default metrics
      const metricsToInsert = selectedSport.defaultMetrics.map((m) => ({
        ...m,
        program_id: program.id,
        is_default: true,
      }));
      await supabase.from("metrics").insert(metricsToInsert as any);

      await refreshCoach();
      toast.success("Program created!");
      navigate("/");
    } catch (err) {
      toast.error("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8 animate-slide-up">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow object-cover" />
          <h1 className="text-3xl font-extrabold tracking-tight">
            {step === "org" ? "Choose Organization" : step === "sport" ? "Choose Your Sport" : "Program Details"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {step === "org"
              ? "Add to an existing organization or create a new one"
              : step === "sport"
                ? "Select the sport for this program"
                : `Create your ${selectedSport?.label.toLowerCase()} program`}
          </p>
        </div>

        {/* Step 1: Organization */}
        {step === "org" && (
          <Card className="shadow-elevated border-0 animate-fade-in">
            <CardContent className="pt-6 space-y-4">
              {organizations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Existing Organizations</Label>
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => { setSelectedOrgId(org.id); setSchoolName(org.name); setStep("sport"); }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl border p-4 transition-all hover:border-primary hover:shadow-md active:scale-[0.98]",
                        selectedOrgId === org.id && "border-primary bg-primary/5"
                      )}
                    >
                      {org.logo_url ? (
                        <img src={org.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                          {org.name.charAt(0)}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="font-bold">{org.name}</p>
                        <p className="text-xs text-muted-foreground">Add a program to this organization</p>
                      </div>
                    </button>
                  ))}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">New Organization Name</Label>
                <Input
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Lincoln High School Athletics"
                  className="tap-target h-12 text-base rounded-xl"
                />
              </div>
              <Button
                onClick={() => { setSelectedOrgId(""); setSchoolName(newOrgName); setStep("sport"); }}
                disabled={!newOrgName.trim() && !selectedOrgId}
                className="w-full tap-target h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-glow"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Sport selection */}
        {step === "sport" && (
          <Card className="shadow-elevated border-0 animate-fade-in">
            <CardContent className="pt-6">
              <button onClick={() => setStep("org")} className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 block">
                ← Back to organization
              </button>
              <div className="grid grid-cols-2 gap-3">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    onClick={() => { setSelectedSport(sport); setStep("details"); }}
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

        {/* Step 3: Program details */}
        {step === "details" && selectedSport && (
          <Card className="shadow-elevated border-0 animate-fade-in">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <button type="button" onClick={() => setStep("sport")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
                {!selectedOrgId && (
                  <div className="space-y-2">
                    <Label htmlFor="schoolName" className="text-sm font-semibold">School / Organization Name</Label>
                    <Input
                      id="schoolName"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Lincoln High School"
                      required
                      className="tap-target h-12 text-base rounded-xl"
                    />
                  </div>
                )}
                {selectedOrgId && (
                  <p className="text-sm text-muted-foreground">
                    Organization: <span className="font-semibold text-foreground">{organizations.find((o) => o.id === selectedOrgId)?.name}</span>
                  </p>
                )}
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
