import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Check, UserPlus } from "lucide-react";
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
  const [justAdded, setJustAdded] = useState<{ name: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const isHead = coach?.role === "head_coach";

  const signupUrl = `${window.location.origin}/auth`;

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
      setLoading(false);
      return;
    }

    setJustAdded({ name: inviteName.trim(), email: inviteEmail.trim() });
    fetchCoaches();
    setInviteEmail("");
    setInviteName("");
    setLoading(false);
  };

  const handleDialogClose = (open: boolean) => {
    setAddOpen(open);
    if (!open) {
      setJustAdded(null);
      setCopied(false);
      setInviteEmail("");
      setInviteName("");
    }
  };

  const handleCopyLink = async () => {
    const text = justAdded
      ? `You've been added as an assistant coach on Rostr. Sign up at ${signupUrl} using your email: ${justAdded.email}`
      : signupUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy — try selecting the text manually");
    }
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
          <Dialog open={addOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button size="sm" className="tap-target"><UserPlus className="mr-1 h-4 w-4" /> Add Coach</Button>
            </DialogTrigger>
            <DialogContent>
              {justAdded ? (
                <>
                  <DialogHeader><DialogTitle>Coach Added</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        {justAdded.name} has been added as an assistant coach.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Next step: share the signup link</p>
                      <p className="text-sm text-muted-foreground">
                        Send them this link and ask them to sign up with <strong>{justAdded.email}</strong> — the email must match exactly for their account to connect.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                      <code className="flex-1 truncate text-xs">{signupUrl}</code>
                      <Button type="button" variant="ghost" size="icon" onClick={handleCopyLink} className="shrink-0 h-8 w-8">
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The "Copy" button copies a ready-to-send message with the link and email instructions.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 tap-target" onClick={() => { setJustAdded(null); setCopied(false); }}>
                        Add Another
                      </Button>
                      <Button className="flex-1 tap-target" onClick={() => handleDialogClose(false)}>
                        Done
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <DialogHeader><DialogTitle>Add Assistant Coach</DialogTitle></DialogHeader>
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Coach Name</Label>
                      <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Coach Johnson" required className="tap-target" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="coach@school.edu" required className="tap-target" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No email will be sent automatically. After adding, you'll get a signup link to share with the coach. They must sign up with this exact email to join your program.
                    </p>
                    <Button type="submit" className="w-full tap-target" disabled={loading}>
                      {loading ? "Adding..." : "Add Coach"}
                    </Button>
                  </form>
                </>
              )}
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
