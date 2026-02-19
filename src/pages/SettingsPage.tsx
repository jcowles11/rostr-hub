import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Share2, Users, Ruler } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { coach, user, signOut } = useAuth();
  const [regCode, setRegCode] = useState("");
  const [coachCount, setCoachCount] = useState(0);
  const [metricCount, setMetricCount] = useState(0);

  useEffect(() => {
    if (!coach) return;
    supabase.from("programs").select("registration_code").eq("id", coach.program_id).single().then(({ data }) => {
      if (data) setRegCode(data.registration_code);
    });
    supabase.from("coaches").select("id", { count: "exact" }).eq("program_id", coach.program_id).then(({ count }) => setCoachCount(count || 0));
    supabase.from("metrics").select("id", { count: "exact" }).eq("program_id", coach.program_id).then(({ count }) => setMetricCount(count || 0));
  }, [coach]);

  const copyRegLink = () => {
    const link = `${window.location.origin}/register/${regCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Registration link copied!");
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{coach?.program_name}</CardTitle>
          <CardDescription>{coach?.full_name} • {coach?.role === "head_coach" ? "Head Coach" : "Assistant Coach"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" /> {coachCount} coach{coachCount !== 1 ? "es" : ""}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Ruler className="h-4 w-4 text-muted-foreground" /> {metricCount} metrics configured
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Player Registration</CardTitle>
          <CardDescription>Share this link with players to self-register</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full tap-target" onClick={copyRegLink}>
            <Share2 className="mr-2 h-4 w-4" /> Copy Registration Link
          </Button>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full tap-target" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
