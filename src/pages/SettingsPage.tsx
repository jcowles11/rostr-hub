import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Share2, User, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricsManager from "@/components/MetricsManager";
import LevelsManager from "@/components/LevelsManager";
import VisibilityManager from "@/components/VisibilityManager";
import CoachManager from "@/components/CoachManager";

export default function SettingsPage() {
  const { coach, signOut } = useAuth();
  const navigate = useNavigate();
  const [regCode, setRegCode] = useState("");

  useEffect(() => {
    if (!coach) return;
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

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24 space-y-5 animate-fade-in">
      {/* Hero */}
      <div className="page-hero">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">{coach?.full_name}</h1>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-white/70" />
              <span className="text-white/70 text-sm">{coach?.role === "head_coach" ? "Head Coach" : "Assistant Coach"}</span>
            </div>
          </div>
        </div>
      </div>

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
