import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, UserPlus, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  jersey_number_preference: number | null;
  player_number: number | null;
}

export default function Roster() {
  const { coach } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ first_name: "", last_name: "", grade: "", positions: "" });

  const fetchPlayers = async () => {
    if (!coach) return;
    const { data } = await supabase
      .from("players")
      .select("id, first_name, last_name, grade, positions, jersey_number_preference, player_number")
      .eq("program_id", coach.program_id)
      .order("last_name")
      .order("first_name");
    setPlayers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, [coach]);

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    return p.last_name.toLowerCase().includes(q) || p.first_name.toLowerCase().includes(q);
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach) return;
    const { error } = await supabase.from("players").insert({
      program_id: coach.program_id,
      first_name: newPlayer.first_name,
      last_name: newPlayer.last_name,
      grade: newPlayer.grade ? parseInt(newPlayer.grade) : null,
      positions: newPlayer.positions ? newPlayer.positions.split(",").map((s) => s.trim()) : [],
    });
    if (error) {
      toast.error("Failed to add player");
    } else {
      toast.success("Player added!");
      setNewPlayer({ first_name: "", last_name: "", grade: "", positions: "" });
      setAddOpen(false);
      fetchPlayers();
    }
  };

  const copyRegLink = async () => {
    if (!coach) return;
    const { data } = await supabase
      .from("programs")
      .select("registration_code")
      .eq("id", coach.program_id)
      .single();
    if (data) {
      const link = `${window.location.origin}/register/${data.registration_code}`;
      navigator.clipboard.writeText(link);
      toast.success("Registration link copied!");
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roster</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="tap-target" onClick={copyRegLink} title="Share registration link">
            <Share2 className="h-5 w-5" />
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="tap-target">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Player</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={newPlayer.first_name} onChange={(e) => setNewPlayer({ ...newPlayer, first_name: e.target.value })} required className="tap-target" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={newPlayer.last_name} onChange={(e) => setNewPlayer({ ...newPlayer, last_name: e.target.value })} required className="tap-target" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Grade</Label>
                    <Input type="number" value={newPlayer.grade} onChange={(e) => setNewPlayer({ ...newPlayer, grade: e.target.value })} placeholder="9-12" className="tap-target" />
                  </div>
                  <div className="space-y-2">
                    <Label>Positions</Label>
                    <Input value={newPlayer.positions} onChange={(e) => setNewPlayer({ ...newPlayer, positions: e.target.value })} placeholder="SS, OF" className="tap-target" />
                  </div>
                </div>
                <Button type="submit" className="w-full tap-target">Add Player</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players..."
          className="pl-10 tap-target text-base"
        />
      </div>

      <div className="space-y-1">
        {loading ? (
          <p className="py-8 text-center text-muted-foreground">Loading players...</p>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <UserPlus className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {players.length === 0 ? "No players yet. Add one or share the registration link!" : "No players match your search."}
            </p>
          </div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/player/${p.id}`)}
              className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                {p.player_number && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {p.player_number}
                  </span>
                )}
                <div>
                  <p className="font-semibold">
                    {p.last_name}, {p.first_name}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {p.grade && <span>Grade {p.grade}</span>}
                    {p.positions?.map((pos) => (
                      <Badge key={pos} variant="secondary" className="text-xs">
                        {pos}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              {p.jersey_number_preference && (
                <span className="text-lg font-bold text-muted-foreground">#{p.jersey_number_preference}</span>
              )}
            </button>
          ))
        )}
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">{filtered.length} player{filtered.length !== 1 ? "s" : ""}</p>
    </div>
  );
}
