import { useEffect, useState } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, UserPlus, Share2, Users, X, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getSportPositions, sportHasBatsThrows } from "@/lib/sports";
import RosterUpload from "@/components/RosterUpload";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  jersey_number_preference: number | null;
  player_number: number | null;
  photo_url: string | null;
}

export default function Roster() {
  const { coach } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"alpha" | "number">("alpha");
  const [newPlayer, setNewPlayer] = useState({ first_name: "", last_name: "", grade: "", bats: "", throws: "" });
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  const sport = coach?.sport || "baseball";
  const positions = getSportPositions(sport);
  const showBatsThrows = sportHasBatsThrows(sport);

  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const fetchPlayers = async () => {
    if (!coach) return;
    const { data } = await supabase
      .from("players")
      .select("id, first_name, last_name, grade, positions, jersey_number_preference, player_number, photo_url")
      .eq("program_id", coach.program_id)
      .order("last_name")
      .order("first_name");
    setPlayers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, [coach]);

  const filtered = players
    .filter((p) => {
      const q = search.toLowerCase();
      return p.last_name.toLowerCase().includes(q) || p.first_name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "number") {
        const aNum = a.player_number ?? Infinity;
        const bNum = b.player_number ?? Infinity;
        return aNum - bNum;
      }
      return a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
    });

  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach || adding) return;
    if (!newPlayer.first_name.trim() || !newPlayer.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from("players").insert({
        program_id: coach.program_id,
        first_name: newPlayer.first_name.trim(),
        last_name: newPlayer.last_name.trim(),
        grade: newPlayer.grade ? parseInt(newPlayer.grade) : null,
        positions: selectedPositions.length > 0 ? selectedPositions : [],
        bats: newPlayer.bats || null,
        throws: newPlayer.throws || null,
      });
      if (error) {
        console.error("Add player error:", error);
        toast.error(`Failed to add player: ${error.message}`);
      } else {
        toast.success("Player added!");
        setNewPlayer({ first_name: "", last_name: "", grade: "", bats: "", throws: "" });
        setSelectedPositions([]);
        setAddOpen(false);
        fetchPlayers();
      }
    } catch (err: any) {
      console.error("Add player exception:", err);
      toast.error("Something went wrong adding the player");
    } finally {
      setAdding(false);
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
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      {/* Gradient hero header */}
      <div className="page-hero mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Roster</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {players.length} player{players.length !== 1 ? "s" : ""} registered
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="tap-target text-white/80 hover:text-white hover:bg-white/10"
              title="Auto-assign player numbers"
              onClick={async () => {
                const unnumbered = players.filter((p) => !p.player_number);
                if (unnumbered.length === 0) { toast.info("All players already have numbers"); return; }
                const maxNum = Math.max(0, ...players.filter((p) => p.player_number).map((p) => p.player_number!));
                let nextNum = maxNum + 1;
                const updates = unnumbered.map((p) => ({ id: p.id, player_number: nextNum++ }));
                for (const u of updates) {
                  await supabase.from("players").update({ player_number: u.player_number }).eq("id", u.id);
                }
                toast.success(`Assigned numbers to ${updates.length} player${updates.length !== 1 ? "s" : ""}`);
                fetchPlayers();
              }}
            >
              <Users className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="tap-target text-white/80 hover:text-white hover:bg-white/10" onClick={() => setUploadOpen(true)} title="Import roster from spreadsheet">
              <Upload className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="tap-target text-white/80 hover:text-white hover:bg-white/10" onClick={copyRegLink} title="Share registration link">
              <Share2 className="h-5 w-5" />
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="icon" className="tap-target bg-white/20 hover:bg-white/30 text-white border-0">
                  <Plus className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Add Player</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">First Name</Label>
                    <Input value={newPlayer.first_name} onChange={(e) => setNewPlayer({ ...newPlayer, first_name: e.target.value })} required className="tap-target h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Last Name</Label>
                    <Input value={newPlayer.last_name} onChange={(e) => setNewPlayer({ ...newPlayer, last_name: e.target.value })} required className="tap-target h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Grade</Label>
                    <Input type="number" value={newPlayer.grade} onChange={(e) => setNewPlayer({ ...newPlayer, grade: e.target.value })} placeholder="9-12" className="tap-target h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Position(s)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {positions.map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => togglePosition(pos)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border ${
                            selectedPositions.includes(pos)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                    {selectedPositions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPositions.map((pos) => (
                          <Badge key={pos} variant="secondary" className="text-xs gap-1">
                            {pos}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => togglePosition(pos)} />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {showBatsThrows && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Bats</Label>
                        <Select value={newPlayer.bats} onValueChange={(v) => setNewPlayer({ ...newPlayer, bats: v })}>
                          <SelectTrigger className="tap-target h-12 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="R">Right (R)</SelectItem>
                            <SelectItem value="L">Left (L)</SelectItem>
                            <SelectItem value="S">Switch (S)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Throws</Label>
                        <Select value={newPlayer.throws} onValueChange={(v) => setNewPlayer({ ...newPlayer, throws: v })}>
                          <SelectTrigger className="tap-target h-12 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="R">Right (R)</SelectItem>
                            <SelectItem value="L">Left (L)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <Button type="submit" disabled={adding} className="w-full tap-target h-12 font-bold rounded-xl gradient-primary border-0">{adding ? "Adding..." : "Add Player"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="pl-10 tap-target text-base h-12 rounded-xl"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="tap-target h-12 w-12 rounded-xl shrink-0"
          title={sortBy === "alpha" ? "Sort by number" : "Sort alphabetically"}
          onClick={() => setSortBy(sortBy === "alpha" ? "number" : "alpha")}
        >
          {sortBy === "alpha" ? <span className="font-bold text-sm">A-Z</span> : <span className="font-bold text-sm">#</span>}
        </Button>
      </div>

      <div className="space-y-2 stagger-list">
        {loading ? (
          <div className="py-12 text-center">
            <img src={rostrLogo} alt="Loading" className="mx-auto mb-3 h-12 w-12 rounded-2xl animate-pulse-soft object-cover" />
            <p className="text-muted-foreground">Loading players...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center animate-fade-in">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <UserPlus className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">
              {players.length === 0 ? "No players yet" : "No players match your search"}
            </p>
            {players.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">Add a player or share the registration link</p>
            )}
          </div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/player/${p.id}`)}
              className="player-card"
            >
              <div className="flex items-center gap-3">
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                ) : p.player_number ? (
                  <span className="number-badge">{p.player_number}</span>
                ) : (
                  <span className="number-badge bg-muted text-muted-foreground">—</span>
                )}
                <div>
                  <p className="font-bold text-[15px]">
                    {p.last_name}, {p.first_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {p.grade && <span className="text-xs text-muted-foreground">Grade {p.grade}</span>}
                    {p.positions?.map((pos) => (
                      <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                        {pos}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              {p.jersey_number_preference && (
                <span className="text-sm font-semibold text-muted-foreground">#{p.jersey_number_preference}</span>
              )}
            </button>
          ))
        )}
      </div>

      <RosterUpload open={uploadOpen} onOpenChange={setUploadOpen} onSuccess={fetchPlayers} />
    </div>
  );
}
