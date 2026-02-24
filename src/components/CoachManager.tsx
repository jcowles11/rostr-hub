import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const COACH_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

interface Coach {
  id: string;
  full_name: string;
  email: string;
  role: string;
  color: string;
}

export default function CoachManager() {
  const { coach } = useAuth();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [loading, setLoading] = useState(false);
  const isHead = coach?.role === "head_coach";

  const fetchCoaches = async () => {
    if (!coach) return;
    const { data } = await supabase.from("coaches").select("id, full_name, email, role, color").eq("program_id", coach.program_id);
    setCoaches(data || []);
  };

  useEffect(() => { fetchCoaches(); }, [coach]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach || !inviteName.trim() || !inviteEmail.trim()) return;
    setLoading(true);

    // Look up if a user with this email already has an account
    // If so, create the coach record directly linking them
    // Otherwise, create a placeholder that will be linked when they sign up
    const { data: existingUser } = await supabase
      .from("coaches")
      .select("id")
      .eq("program_id", coach.program_id)
      .eq("email", inviteEmail.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      toast.error("A coach with this email already exists in this program.");
      setLoading(false);
      return;
    }

    // Create coach record — user_id will need to be linked when they sign up.
    // For now, use a placeholder UUID. The auth system will match by email on login.
    const color = COACH_COLORS[coaches.length % COACH_COLORS.length];
    const { error } = await supabase.from("coaches").insert({
      user_id: crypto.randomUUID(), // Placeholder — will be updated when coach signs up
      program_id: coach.program_id,
      full_name: inviteName.trim(),
      email: inviteEmail.trim().toLowerCase(),
      role: "assistant_coach",
      color,
    });

    if (error) {
      console.error("Failed to add coach:", error);
      toast.error(`Failed to add coach: ${error.message}`);
    } else {
      toast.success(`${inviteName.trim()} added as assistant coach! Have them sign up with ${inviteEmail.trim()} to access the program.`);
      fetchCoaches();
    }

    setInviteEmail("");
    setInviteName("");
    setAddOpen(false);
    setLoading(false);
  };

  const handleRemove = async (id: string) => {
    if (id === coach?.id) { toast.error("Can't remove yourself"); return; }
    const { error } = await supabase.from("coaches").delete().eq("id", id);
    if (error) toast.error("Failed to remove coach");
    else { toast.success("Coach removed"); fetchCoaches(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Coaching Staff</h2>
        {isHead && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="tap-target"><Plus className="mr-1 h-4 w-4" /> Invite Coach</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite Assistant Coach</DialogTitle></DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label>Coach Name</Label>
                  <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Coach Johnson" required className="tap-target" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="coach@school.edu" required className="tap-target" />
                </div>
                <p className="text-sm text-muted-foreground">The coach will need to create an account with this email address to access the program.</p>
                <Button type="submit" className="w-full tap-target" disabled={loading}>
                  {loading ? "Sending..." : "Send Invitation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-2">
        {coaches.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground" style={{ backgroundColor: c.color }}>
                {c.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="font-medium">{c.full_name}</p>
                <p className="text-xs text-muted-foreground">{c.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={c.role === "head_coach" ? "default" : "secondary"}>
                {c.role === "head_coach" ? "Head" : "Assistant"}
              </Badge>
              {isHead && c.id !== coach?.id && (
                <Button variant="ghost" size="icon" onClick={() => handleRemove(c.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
