import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Bookmark, Search, ChevronRight, StickyNote, Trash2, MessageSquare, ListPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const STATUSES = ["new", "contacted", "engaged", "not_interested", "committed", "archived"];
const STATUS_COLORS: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  contacted: "bg-secondary/10 text-secondary",
  engaged: "bg-accent/10 text-accent",
  not_interested: "bg-muted text-muted-foreground",
  committed: "bg-accent/15 text-accent",
  archived: "bg-muted text-muted-foreground",
};

interface SavedProspect {
  id: string;
  scout_id: string;
  player_id: string;
  notes: string | null;
  status: string;
  created_at: string;
  player: {
    first_name: string;
    last_name: string;
    positions: string[] | null;
    photo_url: string | null;
    profile_slug: string | null;
    graduation_year: number | null;
    city: string | null;
    state: string | null;
    recruiting_status: string;
    committed_school_name: string | null;
    high_school: string | null;
  };
}

export default function ScoutSavedProspects() {
  const { scoutInfo } = useAuth();
  const navigate = useNavigate();
  const [prospects, setProspects] = useState<SavedProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [lists, setLists] = useState<{id: string; name: string}[]>([]);
  const [addToListId, setAddToListId] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState("");

  useEffect(() => {
    if (!scoutInfo) return;
    fetchProspects();
    fetchLists();
  }, [scoutInfo]);

  const fetchProspects = async () => {
    if (!scoutInfo) return;
    const { data } = await supabase
      .from("scout_saved_prospects")
      .select("id, scout_id, player_id, notes, status, created_at, players(first_name, last_name, positions, photo_url, profile_slug, graduation_year, city, state, recruiting_status, committed_school_name, high_school)")
      .eq("scout_id", scoutInfo.id)
      .order("created_at", { ascending: false });

    if (data) {
      setProspects(data.map((d: any) => ({ ...d, player: d.players })));
    }
    setLoading(false);
  };

  const fetchLists = async () => {
    if (!scoutInfo) return;
    const { data } = await supabase
      .from("scout_lists")
      .select("id, name")
      .eq("scout_id", scoutInfo.id);
    if (data) setLists(data);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("scout_saved_prospects").update({ status }).eq("id", id);
    setProspects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const saveNotes = async (id: string) => {
    await supabase.from("scout_saved_prospects").update({ notes: noteText }).eq("id", id);
    setProspects(prev => prev.map(p => p.id === id ? { ...p, notes: noteText } : p));
    setEditingNotes(null);
    toast.success("Notes saved");
  };

  const removeProspect = async (id: string) => {
    await supabase.from("scout_saved_prospects").delete().eq("id", id);
    setProspects(prev => prev.filter(p => p.id !== id));
    toast.success("Prospect removed");
  };

  const addToList = async (playerId: string) => {
    if (!selectedList) return;
    const { error } = await supabase.from("scout_list_members").insert({ list_id: selectedList, player_id: playerId });
    if (error?.code === "23505") toast.error("Already in that list");
    else if (error) toast.error("Failed to add");
    else toast.success("Added to list");
    setAddToListId(null);
    setSelectedList("");
  };

  const filtered = prospects.filter(p => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const name = `${p.player.first_name} ${p.player.last_name}`.toLowerCase();
      if (!name.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading prospects...</p></div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-8 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bookmark className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold">Saved Prospects</h1>
          <p className="text-xs text-muted-foreground">{prospects.length} prospect{prospects.length !== 1 ? "s" : ""} saved</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search prospects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Prospect list */}
      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <Bookmark className="mx-auto h-10 w-10 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">{prospects.length === 0 ? "No saved prospects yet" : "No matches for your filters"}</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(p => (
          <Card key={p.id} className="section-card">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11 rounded-xl border shrink-0 cursor-pointer" onClick={() => p.player.profile_slug && navigate(`/p/${p.player.profile_slug}`)}>
                  <AvatarImage src={p.player.photo_url || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-xl bg-muted text-sm font-bold">
                    {p.player.first_name[0]}{p.player.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button onClick={() => p.player.profile_slug && navigate(`/p/${p.player.profile_slug}`)} className="font-bold text-sm hover:text-primary truncate">
                      {p.player.first_name} {p.player.last_name}
                    </button>
                    <Select value={p.status} onValueChange={v => updateStatus(p.id, v)}>
                      <SelectTrigger className={`h-5 text-[10px] px-2 py-0 w-auto border-0 ${STATUS_COLORS[p.status] || ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.player.high_school || ""}{p.player.state ? `, ${p.player.state}` : ""}
                    {p.player.graduation_year && ` • ${p.player.graduation_year}`}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.player.positions?.slice(0, 3).map(pos => (
                      <Badge key={pos} variant="secondary" className="text-[9px] px-1.5 py-0">{pos}</Badge>
                    ))}
                    {p.player.recruiting_status === "committed" && (
                      <Badge className="bg-accent/15 text-accent border-0 text-[9px] px-1.5 py-0">
                        {p.player.committed_school_name || "Committed"}
                      </Badge>
                    )}
                  </div>
                  {p.notes && !editingNotes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{p.notes}"</p>
                  )}
                  {editingNotes === p.id && (
                    <div className="mt-2 space-y-1">
                      <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} className="text-xs min-h-[60px]" placeholder="Add notes..." />
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" onClick={() => saveNotes(p.id)} className="text-xs h-7">Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)} className="text-xs h-7">Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingNotes(p.id); setNoteText(p.notes || ""); }}>
                    <StickyNote className="h-3.5 w-3.5" />
                  </Button>
                  <Dialog open={addToListId === p.id} onOpenChange={open => { if (!open) setAddToListId(null); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAddToListId(p.id)}>
                        <ListPlus className="h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xs">
                      <DialogHeader><DialogTitle className="text-sm">Add to List</DialogTitle></DialogHeader>
                      {lists.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No lists created yet. Create one from the Lists tab.</p>
                      ) : (
                        <div className="space-y-3">
                          <Select value={selectedList} onValueChange={setSelectedList}>
                            <SelectTrigger><SelectValue placeholder="Select a list" /></SelectTrigger>
                            <SelectContent>
                              {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button className="w-full" disabled={!selectedList} onClick={() => addToList(p.player_id)}>Add</Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeProspect(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
