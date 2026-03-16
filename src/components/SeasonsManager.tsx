import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Check, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchSeasons as loadSeasonsService,
  createSeason,
  setActiveSeason,
  deleteSeason,
  type Season,
} from "@/services/seasonService";

export default function SeasonsManager() {
  const { coach } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const loadSeasons = async () => {
    if (!coach) return;
    const { data } = await loadSeasonsService(coach.program_id);
    setSeasons(data);
    setLoading(false);
  };

  useEffect(() => {
    loadSeasons();
  }, [coach]);

  const handleAdd = async () => {
    if (!coach || !newName.trim()) return;
    setAdding(true);
    const { error } = await createSeason(coach.program_id, newName.trim(), seasons.length === 0);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Season created!");
      setNewName("");
      loadSeasons();
    }
    setAdding(false);
  };

  const handleSetActive = async (id: string) => {
    if (!coach) return;
    const { error } = await setActiveSeason(coach.program_id, id);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Active season updated");
    }
    loadSeasons();
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteSeason(id);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Season deleted");
      loadSeasons();
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
