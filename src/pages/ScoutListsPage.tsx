import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { List, Plus, Trash2, ChevronLeft, X, Users } from "lucide-react";
import { toast } from "sonner";

interface ScoutList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
}

interface ListMember {
  id: string;
  player_id: string;
  player: {
    first_name: string;
    last_name: string;
    positions: string[] | null;
    photo_url: string | null;
    profile_slug: string | null;
    graduation_year: number | null;
    state: string | null;
    recruiting_status: string;
  };
}

export default function ScoutListsPage() {
  const { scoutInfo } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState<ScoutList[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<ScoutList | null>(null);
  const [members, setMembers] = useState<ListMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (scoutInfo) fetchLists();
  }, [scoutInfo]);

  const fetchLists = async () => {
    if (!scoutInfo) return;
    const { data } = await supabase
      .from("scout_lists")
      .select("id, name, description, created_at")
      .eq("scout_id", scoutInfo.id)
      .order("created_at", { ascending: false });

    if (data) {
      // Get member counts
      const withCounts = await Promise.all(data.map(async (l) => {
        const { count } = await supabase.from("scout_list_members").select("id", { count: "exact", head: true }).eq("list_id", l.id);
        return { ...l, member_count: count || 0 };
      }));
      setLists(withCounts);
    }
    setLoading(false);
  };

  const createList = async () => {
    if (!scoutInfo || !newName.trim()) return;
    const { error } = await supabase.from("scout_lists").insert({
      scout_id: scoutInfo.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
    });
    if (error) toast.error("Failed to create list");
    else {
      toast.success("List created");
      setNewName(""); setNewDesc(""); setShowCreate(false);
      fetchLists();
    }
  };

  const deleteList = async (id: string) => {
    await supabase.from("scout_lists").delete().eq("id", id);
    setLists(prev => prev.filter(l => l.id !== id));
    if (activeList?.id === id) setActiveList(null);
    toast.success("List deleted");
  };

  const openList = async (list: ScoutList) => {
    setActiveList(list);
    setMembersLoading(true);
    const { data } = await supabase
      .from("scout_list_members")
      .select("id, player_id, players(first_name, last_name, positions, photo_url, profile_slug, graduation_year, state, recruiting_status)")
      .eq("list_id", list.id);
    if (data) setMembers(data.map((d: any) => ({ ...d, player: d.players })));
    setMembersLoading(false);
  };

  const removeMember = async (memberId: string) => {
    await supabase.from("scout_list_members").delete().eq("id", memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    toast.success("Removed from list");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading lists...</p></div>;
  }

  // List detail view
  if (activeList) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-8 space-y-4 animate-fade-in">
        <button onClick={() => setActiveList(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to Lists
        </button>
        <div>
          <h1 className="text-lg font-extrabold">{activeList.name}</h1>
          {activeList.description && <p className="text-xs text-muted-foreground">{activeList.description}</p>}
          <p className="text-xs text-muted-foreground mt-1">{members.length} player{members.length !== 1 ? "s" : ""}</p>
        </div>

        {membersLoading ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Loading...</p>
        ) : members.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">No players in this list yet</p>
            <p className="text-xs text-muted-foreground">Add players from search or saved prospects</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <Card key={m.id} className="section-card">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-xl border shrink-0 cursor-pointer" onClick={() => m.player.profile_slug && navigate(`/p/${m.player.profile_slug}`)}>
                    <AvatarImage src={m.player.photo_url || undefined} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-muted text-xs font-bold">
                      {m.player.first_name[0]}{m.player.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => m.player.profile_slug && navigate(`/p/${m.player.profile_slug}`)} className="font-bold text-sm hover:text-primary truncate block">
                      {m.player.first_name} {m.player.last_name}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {m.player.state || ""}{m.player.graduation_year ? ` • ${m.player.graduation_year}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {m.player.positions?.slice(0, 3).map(pos => (
                        <Badge key={pos} variant="secondary" className="text-[9px] px-1.5 py-0">{pos}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive shrink-0" onClick={() => removeMember(m.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-8 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <List className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold">Prospect Lists</h1>
            <p className="text-xs text-muted-foreground">{lists.length} list{lists.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New List</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Create List</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="List name" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              <Button className="w-full" disabled={!newName.trim()} onClick={createList}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lists.length === 0 ? (
        <div className="py-16 text-center">
          <List className="mx-auto h-10 w-10 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">No lists yet</p>
          <p className="text-xs text-muted-foreground">Create a list to organize your prospects</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map(l => (
            <Card key={l.id} className="section-card cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openList(l)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{l.name}</p>
                  {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{l.member_count} player{l.member_count !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={e => { e.stopPropagation(); deleteList(l.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
