import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Share2, User, Shield } from "lucide-react";
import ProgramLogoUpload from "@/components/ProgramLogoUpload";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricsManager from "@/components/MetricsManager";
import LevelsManager from "@/components/LevelsManager";
import VisibilityManager from "@/components/VisibilityManager";
import CoachManager from "@/components/CoachManager";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

export default function SettingsPage() {
  const { coach, signOut, refreshCoach } = useAuth();
  const navigate = useNavigate();
  const [regCode, setRegCode] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [programName, setProgramName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!coach) return;
    setProgramName(coach.program_name || "");
    supabase.from("programs").select("registration_code").eq("id", coach.program_id).single().then(({ data }) => {
      if (data) setRegCode(data.registration_code);
    });
  }, [coach]);

  const copyRegLink = () => {
    const link = `${window.location.origin}/register/${regCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Registration link copied!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleSaveName = async () => {
    if (!coach || !programName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from("programs")
      .update({ name: programName.trim() })
      .eq("id", coach.program_id);
    if (error) {
      toast.error("Failed to update program name");
    } else {
      toast.success("Program name updated!");
      await refreshCoach();
    }
    setSavingName(false);
    setEditingName(false);
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24 space-y-5 animate-fade-in">
      {/* Hero */}
      <div className="page-hero">
        <div className="flex items-center gap-3">
          {coach?.logo_url ? (
            <img src={coach.logo_url} alt="Program logo" className="h-12 w-12 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
              <User className="h-6 w-6" />
            </div>
          )}
          <div>
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="h-8 w-40 bg-white/20 border-white/30 text-white placeholder:text-white/50 text-sm font-bold rounded-lg"
                  autoFocus
                  disabled={savingName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") { setEditingName(false); setProgramName(coach?.program_name || ""); }
                  }}
                />
                <button onClick={handleSaveName} disabled={savingName} className="p-1 rounded-md hover:bg-white/20 text-white">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => { setEditingName(false); setProgramName(coach?.program_name || ""); }} className="p-1 rounded-md hover:bg-white/20 text-white/70">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-extrabold text-white">{coach?.program_name || coach?.full_name}</h1>
                <button onClick={() => setEditingName(true)} className="p-1 rounded-md hover:bg-white/20 text-white/60 hover:text-white transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-white/70" />
              <span className="text-white/70 text-sm">{coach?.role === "head_coach" ? "Head Coach" : "Assistant Coach"} · {coach?.full_name}</span>
            </div>
          </div>
        </div>
      </div>

      <Card className="section-card">
        <CardHeader>
          <CardTitle className="text-base">Program Logo</CardTitle>
          <CardDescription>Upload a logo for your program</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <ProgramLogoUpload />
        </CardContent>
      </Card>

      <Card className="section-card">
        <CardContent className="pt-5">
          <Button variant="outline" className="w-full tap-target h-12 rounded-xl font-semibold" onClick={copyRegLink}>
            <Share2 className="mr-2 h-4 w-4" /> Copy Player Registration Link
          </Button>
        </CardContent>
      </Card>

      <CoachManager />
      <LevelsManager />
      <VisibilityManager />
      <MetricsManager />

      <Button variant="destructive" className="w-full tap-target h-12 rounded-xl font-bold" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
