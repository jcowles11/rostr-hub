import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricsManager from "@/components/MetricsManager";
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
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{coach?.program_name}</CardTitle>
          <CardDescription>{coach?.full_name} • {coach?.role === "head_coach" ? "Head Coach" : "Assistant Coach"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full tap-target" onClick={copyRegLink}>
            <Share2 className="mr-2 h-4 w-4" /> Copy Player Registration Link
          </Button>
        </CardContent>
      </Card>

      <CoachManager />
      <MetricsManager />

      <Button variant="destructive" className="w-full tap-target" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
