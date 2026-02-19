import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

export default function LevelsManager() {
  const { coach, refreshCoach } = useAuth();
  const isHead = coach?.role === "head_coach";
  const levels = coach?.program_levels || ["Varsity", "JV", "C", "Freshman", "Cut"];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(levels);
  const [newLevel, setNewLevel] = useState("");
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft([...levels]);
    setEditing(true);
  };

  const handleRemove = (idx: number) => {
    if (draft.length <= 2) {
      toast.error("You need at least 2 levels");
      return;
    }
    setDraft(draft.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    const name = newLevel.trim();
    if (!name) return;
    if (draft.includes(name)) {
      toast.error("Level already exists");
      return;
    }
    setDraft([...draft, name]);
    setNewLevel("");
  };

  const handleRename = (idx: number, name: string) => {
    const updated = [...draft];
    updated[idx] = name;
    setDraft(updated);
  };

  const handleSave = async () => {
    if (!coach) return;
    // Validate no empty or duplicate names
    const trimmed = draft.map((l) => l.trim()).filter(Boolean);
    if (new Set(trimmed).size !== trimmed.length) {
      toast.error("Duplicate level names are not allowed");
      return;
    }
    if (trimmed.length < 2) {
      toast.error("You need at least 2 levels");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("programs")
      .update({ levels: trimmed })
      .eq("id", coach.program_id);

    if (error) {
      toast.error("Failed to save levels");
    } else {
      toast.success("Team levels updated!");
      await refreshCoach();
      setEditing(false);
    }
    setSaving(false);
  };

  if (!isHead) {
    return (
      <Card className="section-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Team Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <span key={l} className="rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">{l}</span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="section-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Team Levels</CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" onClick={startEditing} className="tap-target rounded-xl">
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            {draft.map((level, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={level}
                  onChange={(e) => handleRename(idx, e.target.value)}
                  className="tap-target h-10 rounded-xl font-medium"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(idx)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Add new level..."
                className="tap-target h-10 rounded-xl"
              />
              <Button size="sm" onClick={handleAdd} className="tap-target rounded-xl shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 tap-target rounded-xl font-bold">
                {saving ? "Saving..." : "Save Levels"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving} className="tap-target rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <span key={l} className="rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">{l}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
