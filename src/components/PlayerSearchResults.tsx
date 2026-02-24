import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, User, Trophy, Share2, MapPin, Bookmark, ListPlus, MessageSquare, Link2, RotateCcw, X, CheckSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PlayerProfileSheet from "@/components/PlayerProfileSheet";
import type { PlayerResult } from "@/pages/ScoutDashboard";

interface Props {
  results: PlayerResult[];
  loading: boolean;
  searched: boolean;
  onClearSearch?: () => void;
}

export default function PlayerSearchResults({ results, loading, searched, onClearSearch }: Props) {
  const { scoutInfo, userRole, devRoleOverride } = useAuth();
  const effectiveRole = devRoleOverride || userRole;
  const isScout = effectiveRole === "scout" && !!scoutInfo;

  const [savingId, setSavingId] = useState<string | null>(null);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [listDialogPlayer, setListDialogPlayer] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState("");
  const [messageDialogPlayer, setMessageDialogPlayer] = useState<PlayerResult | null>(null);
  const [initialMessage, setInitialMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Sheet state
  const [sheetPlayer, setSheetPlayer] = useState<PlayerResult | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkListDialogOpen, setBulkListDialogOpen] = useState(false);
  const [bulkMessageDialogOpen, setBulkMessageDialogOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSending, setBulkSending] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const fetchLists = async () => {
    if (!scoutInfo) return;
    const { data } = await supabase.from("scout_lists").select("id, name").eq("scout_id", scoutInfo.id);
    if (data) setLists(data);
  };

  const saveProspect = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    if (!scoutInfo) return;
    setSavingId(playerId);
    const { error } = await supabase.from("scout_saved_prospects").insert({ scout_id: scoutInfo.id, player_id: playerId });
    if (error?.code === "23505") toast.info("Already saved");
    else if (error) toast.error("Failed to save");
    else toast.success("Prospect saved!");
    setSavingId(null);
  };

  const openListDialog = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    await fetchLists();
    setListDialogPlayer(playerId);
  };

  const addToList = async () => {
    if (!selectedList || !listDialogPlayer) return;
    const { error } = await supabase.from("scout_list_members").insert({ list_id: selectedList, player_id: listDialogPlayer });
    if (error?.code === "23505") toast.error("Already in that list");
    else if (error) toast.error("Failed to add");
    else toast.success("Added to list");
    setListDialogPlayer(null);
    setSelectedList("");
  };

  const openMessageDialog = (e: React.MouseEvent, player: PlayerResult) => {
    e.stopPropagation();
    setMessageDialogPlayer(player);
    setInitialMessage("");
  };

  const sendMessageRequest = async () => {
    if (!scoutInfo || !messageDialogPlayer || !initialMessage.trim()) return;
    setSendingMessage(true);
    const { error } = await supabase.from("conversation_requests").insert({
      scout_id: scoutInfo.id,
      player_id: messageDialogPlayer.id,
      initial_message: initialMessage.trim(),
    });
    if (error?.code === "23505") toast.error("Request already sent to this player");
    else if (error) toast.error("Failed to send request");
    else toast.success("Message request sent!");
    setMessageDialogPlayer(null);
    setSendingMessage(false);
  };

  const shareProfile = (e: React.MouseEvent, player: PlayerResult) => {
    e.stopPropagation();
    if (!player.profile_slug) return;
    const url = `${window.location.origin}/p/${player.profile_slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Profile link copied!");
  };

  const handleCardClick = (player: PlayerResult) => {
    // Open sheet for any player with a profile_slug (scouts or otherwise)
    if (player.profile_slug) {
      setSheetPlayer(player);
    }
  };

  // Bulk actions
  const openBulkListDialog = async () => {
    await fetchLists();
    setBulkListDialogOpen(true);
  };

  const bulkAddToList = async () => {
    if (!selectedList || selectedIds.size === 0) return;
    const inserts = Array.from(selectedIds).map(player_id => ({ list_id: selectedList, player_id }));
    const { error } = await supabase.from("scout_list_members").insert(inserts);
    if (error) toast.error("Some players may already be in that list");
    else toast.success(`Added ${selectedIds.size} player(s) to list`);
    setBulkListDialogOpen(false);
    setSelectedList("");
    clearSelection();
  };

  const bulkSendMessages = async () => {
    if (!scoutInfo || !bulkMessage.trim() || selectedIds.size === 0) return;
    setBulkSending(true);
    const inserts = Array.from(selectedIds).map(player_id => ({
      scout_id: scoutInfo.id,
      player_id,
      initial_message: bulkMessage.trim(),
    }));
    const { error } = await supabase.from("conversation_requests").insert(inserts);
    if (error) toast.error("Some requests may have already been sent");
    else toast.success(`Sent ${selectedIds.size} message request(s)`);
    setBulkMessageDialogOpen(false);
    setBulkMessage("");
    setBulkSending(false);
    clearSelection();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground/40 animate-pulse mb-3" />
          <p className="text-sm text-muted-foreground">Searching players...</p>
        </div>
      </div>
    );
  }

  if (!searched) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-bold mb-1">Search for Players</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Use the filters to find public player profiles by position, metrics, graduation year, and more.
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-bold mb-1">No Players Found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your filters to broaden the search.</p>
          {onClearSearch && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onClearSearch}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> New Search
            </Button>
          )}
        </div>
      </div>
    );
  }

  const selectedPlayers = results.filter(r => selectedIds.has(r.id));

  return (
    <>
      <div className="space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground font-medium">{results.length} player{results.length !== 1 ? "s" : ""} found</p>
          <div className="flex gap-1.5 items-center">
            {isScout && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                <CheckSquare className="h-3 w-3 mr-1" />
                {selectedIds.size === results.length ? "Deselect All" : "Select All"}
              </Button>
            )}
            {onClearSearch && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearSearch}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {isScout && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-xs font-medium">{selectedIds.size} selected</span>
            <div className="flex gap-1.5 ml-auto">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openBulkListDialog}>
                <ListPlus className="h-3 w-3 mr-1" /> Add to List
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setBulkMessageDialogOpen(true); setBulkMessage(""); }}>
                <MessageSquare className="h-3 w-3 mr-1" /> Message All
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Player grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((player) => (
            <Card
              key={player.id}
              className={`section-card cursor-pointer transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-[1px] ${selectedIds.has(player.id) ? "ring-2 ring-primary/30 border-primary/30" : ""}`}
              onClick={() => handleCardClick(player)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Checkbox for scouts */}
                  {isScout && (
                    <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(player.id)}
                        onCheckedChange={() => toggleSelect(player.id)}
                      />
                    </div>
                  )}
                  <Avatar className="h-12 w-12 rounded-xl border shrink-0">
                    <AvatarImage src={player.photo_url || undefined} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-muted text-xs font-bold">
                      {player.first_name[0]}{player.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm truncate">{player.first_name} {player.last_name}</h3>
                      {player.recruiting_status === "committed" && (
                        <Badge className="bg-accent/15 text-accent border-0 text-[9px] px-1.5 py-0 shrink-0">
                          <Trophy className="h-2.5 w-2.5 mr-0.5" /> Committed
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {player.school_name} • {player.program_name}
                    </p>
                    {player.high_school && (
                      <p className="text-[10px] text-muted-foreground truncate">HS: {player.high_school}</p>
                    )}
                    {player.recruiting_status === "committed" && player.committed_school_name && (
                      <p className="text-[10px] text-accent font-medium mt-0.5 truncate">
                        → {player.committed_school_name}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {player.graduation_year && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{player.graduation_year}</Badge>
                      )}
                      {player.positions?.slice(0, 3).map((pos) => (
                        <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0">{pos}</Badge>
                      ))}
                      {player.height && <span className="text-[10px] text-muted-foreground">{player.height}</span>}
                      {player.weight && <span className="text-[10px] text-muted-foreground">{player.weight} lbs</span>}
                      {player.bats && <span className="text-[10px] text-muted-foreground">B: {player.bats}</span>}
                      {player.throws && <span className="text-[10px] text-muted-foreground">T: {player.throws}</span>}
                    </div>
                    {(player.city || player.state) && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {[player.city, player.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {(player.gamechanger_profile_url || player.maxpreps_profile_url) && (
                      <div className="flex gap-1.5 mt-1">
                        {player.gamechanger_profile_url && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                            <Link2 className="h-2 w-2" /> GC
                          </Badge>
                        )}
                        {player.maxpreps_profile_url && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                            <Link2 className="h-2 w-2" /> MP
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top metrics */}
                {player.metrics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                    {player.metrics.slice(0, 4).map((m, i) => (
                      <div key={i} className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{m.name}</p>
                        <p className="text-sm font-bold leading-none">
                          {Number(m.value).toFixed(1)}
                          {m.unit && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{m.unit}</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons on every card for scouts */}
                {isScout && (
                  <div className="flex items-center gap-1.5 mt-3 pt-2 border-t">
                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg flex-1" disabled={savingId === player.id} onClick={(e) => saveProspect(e, player.id)}>
                      <Bookmark className="h-3 w-3 mr-1" /> Save
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg flex-1" onClick={(e) => openListDialog(e, player.id)}>
                      <ListPlus className="h-3 w-3 mr-1" /> List
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg flex-1" onClick={(e) => openMessageDialog(e, player)}>
                      <MessageSquare className="h-3 w-3 mr-1" /> Msg
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg px-2" onClick={(e) => shareProfile(e, player)}>
                      <Share2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Player Profile Sheet */}
      <PlayerProfileSheet
        player={sheetPlayer}
        open={!!sheetPlayer}
        onOpenChange={(open) => { if (!open) setSheetPlayer(null); }}
      />

      {/* Single Add to List Dialog */}
      <Dialog open={!!listDialogPlayer} onOpenChange={open => { if (!open) setListDialogPlayer(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Add to List</DialogTitle></DialogHeader>
          {lists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lists yet. Create one from the Lists page.</p>
          ) : (
            <div className="space-y-3">
              <Select value={selectedList} onValueChange={setSelectedList}>
                <SelectTrigger><SelectValue placeholder="Select a list" /></SelectTrigger>
                <SelectContent>
                  {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="w-full" disabled={!selectedList} onClick={addToList}>Add to List</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Message Request Dialog */}
      <Dialog open={!!messageDialogPlayer} onOpenChange={open => { if (!open) setMessageDialogPlayer(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Message {messageDialogPlayer?.first_name} {messageDialogPlayer?.last_name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">This will send a message request. The player must accept before you can continue messaging.</p>
          <Textarea
            value={initialMessage}
            onChange={e => setInitialMessage(e.target.value)}
            placeholder="Introduce yourself and why you're reaching out..."
            className="min-h-[80px]"
          />
          <Button className="w-full" disabled={!initialMessage.trim() || sendingMessage} onClick={sendMessageRequest}>
            {sendingMessage ? "Sending..." : "Send Request"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Bulk Add to List Dialog */}
      <Dialog open={bulkListDialogOpen} onOpenChange={setBulkListDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Add {selectedIds.size} Player(s) to List</DialogTitle></DialogHeader>
          {lists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lists yet. Create one from the Lists page.</p>
          ) : (
            <div className="space-y-3">
              <Select value={selectedList} onValueChange={setSelectedList}>
                <SelectTrigger><SelectValue placeholder="Select a list" /></SelectTrigger>
                <SelectContent>
                  {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="w-full" disabled={!selectedList} onClick={bulkAddToList}>
                Add {selectedIds.size} to List
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Message Dialog */}
      <Dialog open={bulkMessageDialogOpen} onOpenChange={setBulkMessageDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Message {selectedIds.size} Player(s)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            This will send a message request to {selectedIds.size} player(s). Each must accept before messaging continues.
          </p>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {selectedPlayers.map(p => (
              <Badge key={p.id} variant="secondary" className="text-[10px]">{p.first_name} {p.last_name}</Badge>
            ))}
          </div>
          <Textarea
            value={bulkMessage}
            onChange={e => setBulkMessage(e.target.value)}
            placeholder="Introduce yourself and why you're reaching out..."
            className="min-h-[80px]"
          />
          <Button className="w-full" disabled={!bulkMessage.trim() || bulkSending} onClick={bulkSendMessages}>
            {bulkSending ? "Sending..." : `Send ${selectedIds.size} Request(s)`}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
