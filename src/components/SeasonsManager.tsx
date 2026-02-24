import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Check, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Season {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export default function SeasonsManager() {
  const { coach } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchSeasons = async () => {
    if (!coach) return;
    const { data } = await supabase
      .from("seasons")
      .select("id, name, start_date, end_date, is_active")
      .eq("program_id", coach.program_id)
      .order("created_at", { ascending: false });
    setSeasons(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSeasons();
  }, [coach]);

  const handleAdd = async () => {
    if (!coach || !newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("seasons").insert({
      program_id: coach.program_id,
      name: newName.trim(),
      is_active: seasons.length === 0, // First season is active by default
    });
    if (error) {
      toast.error("Failed to create season");
    } else {
      toast.success("Season created!");
      setNewName("");
      fetchSeasons();
    }
    setAdding(false);
  };

  const handleSetActive = async (id: string) => {
    if (!coach) return;
    // Deactivate all, then activate the selected one
    await supabase.from("seasons").update({ is_active: false }).eq("program_id", coach.program_id);
    await supabase.from("seasons").update({ is_active: true }).eq("id", id);
    toast.success("Active season updated");
    fetchSeasons();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("seasons").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete season");
    } else {
      toast.success("Season deleted");
      fetchSeasons();
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading seasons...</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. 2025-2026"
          className="h-10 rounded-xl flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={adding || !newName.trim()} size="sm" className="rounded-xl h-10 px-4">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No seasons yet. Create one to start tracking data by year.</p>
      ) : (
        <div className="space-y-1.5">
          {seasons.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                s.is_active ? "border-primary/30 bg-primary/5" : "border-border"
              )}
            >
              <button
                onClick={() => handleSetActive(s.id)}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                  s.is_active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
                title={s.is_active ? "Active season" : "Set as active"}
              >
                <Star className="h-3.5 w-3.5" fill={s.is_active ? "currentColor" : "none"} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{s.name}</p>
                {s.is_active && <p className="text-[10px] text-primary font-bold uppercase">Active</p>}
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
