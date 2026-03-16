import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink, Bookmark, ListPlus, MessageSquare, MapPin,
  Trophy, Ruler, Weight, GraduationCap, Link2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { saveProspect as saveProspectService, addToScoutList } from "@/services/scoutService";
import { sendConversationRequest } from "@/services/messagingService";
import type { PlayerResult } from "@/pages/ScoutDashboard";

interface Props {
  player: PlayerResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileData {
  player: Record<string, any>;
  program: Record<string, any> | null;
  club_teams: { name: string; is_current: boolean }[];
  metrics: any[];
  evaluator_metrics: any[];
}

export default function PlayerProfileSheet({ player, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { scoutInfo, userRole, devRoleOverride } = useAuth();
  const effectiveRole = devRoleOverride || userRole;
  const isScout = effectiveRole === "scout";

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingProspect, setSavingProspect] = useState(false);

  // List dialog
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [selectedList, setSelectedList] = useState("");

  // Message dialog
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (!open || !player?.profile_slug) { setProfile(null); return; }
    setLoading(true);
    supabase.rpc("get_public_profile", { _slug: player.profile_slug }).then(({ data }) => {
      setProfile(data as unknown as ProfileData);
      setLoading(false);
    });
  }, [open, player?.profile_slug]);

  const saveProspect = async () => {
    if (!scoutInfo || !player) return;
    setSavingProspect(true);
    const result = await saveProspectService(scoutInfo.id, player.id);
    if (result.error?.includes("23505")) toast.info("Already saved");
    else if (result.error) toast.error("Failed to save");
    else toast.success("Prospect saved!");
    setSavingProspect(false);
  };

  const openListDialog = async () => {
    if (!scoutInfo) return;
    const { data } = await supabase.from("scout_lists").select("id, name").eq("scout_id", scoutInfo.id);
    if (data) setLists(data);
    setListDialogOpen(true);
  };

  const addToList = async () => {
    if (!selectedList || !player) return;
    const result = await addToScoutList(selectedList, player.id);
    if (result.error?.includes("23505")) toast.error("Already in that list");
    else if (result.error) toast.error("Failed to add");
    else toast.success("Added to list");
    setListDialogOpen(false);
    setSelectedList("");
  };

  const handleSendMessageRequest = async () => {
    if (!scoutInfo || !player || !initialMessage.trim()) return;
    setSendingMessage(true);
    const result = await sendConversationRequest({
      scoutId: scoutInfo.id,
      playerId: player.id,
      initialMessage: initialMessage.trim(),
    });
    if (result.error?.includes("23505")) toast.error("Request already sent to this player");
    else if (result.error) toast.error("Failed to send request");
    else toast.success("Message request sent!");
    setMessageDialogOpen(false);
    setInitialMessage("");
    setSendingMessage(false);
  };

  const p = profile?.player;
  const allMetrics = [...(profile?.metrics || []), ...(profile?.evaluator_metrics || [])];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="p-5 pb-3">
            <SheetTitle className="text-base">Player Preview</SheetTitle>
          </SheetHeader>

          {loading || !p ? (
            <div className="p-5 space-y-4">
              <div className="flex gap-3">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="px-5 pb-6 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <Avatar className="h-16 w-16 rounded-xl border shrink-0">
                  <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-xl bg-muted text-sm font-bold">
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-lg leading-tight">{p.first_name} {p.last_name}</h2>
                  {profile?.program && (
                    <p className="text-sm text-muted-foreground">{profile.program.school_name} • {profile.program.name}</p>
                  )}
                  {p.high_school && (
                    <p className="text-xs text-muted-foreground">HS: {p.high_school}</p>
                  )}
                  {p.recruiting_status === "committed" && p.committed_school_name && (
                    <Badge className="bg-accent/15 text-accent border-0 text-[10px] mt-1">
                      <Trophy className="h-2.5 w-2.5 mr-0.5" /> {p.committed_school_name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-2">
                {p.graduation_year && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Class of {p.graduation_year}</span>
                  </div>
                )}
                {p.height && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{p.height}</span>
                  </div>
                )}
                {p.weight && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{p.weight} lbs</span>
                  </div>
                )}
                {(p.city || p.state) && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{[p.city, p.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>

              {/* Positions */}
              {p.positions?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.positions.map((pos: string) => (
                    <Badge key={pos} variant="secondary" className="text-xs">{pos}</Badge>
                  ))}
                  {p.bats && <Badge variant="outline" className="text-xs">B: {p.bats}</Badge>}
                  {p.throws && <Badge variant="outline" className="text-xs">T: {p.throws}</Badge>}
                </div>
              )}

              {/* External links */}
              {(p.gamechanger_profile_url || p.maxpreps_profile_url) && (
                <div className="flex gap-2">
                  {p.gamechanger_profile_url && (
                    <a href={p.gamechanger_profile_url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Link2 className="h-3 w-3" /> GameChanger
                    </a>
                  )}
                  {p.maxpreps_profile_url && (
                    <a href={p.maxpreps_profile_url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Link2 className="h-3 w-3" /> MaxPreps
                    </a>
                  )}
                </div>
              )}

              <Separator />

              {/* Metrics */}
              {allMetrics.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Top Metrics</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {allMetrics.slice(0, 8).map((m: any, i: number) => (
                      <div key={i} className="rounded-lg bg-muted/50 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{m.name}</p>
                        <p className="text-sm font-bold leading-none">
                          {Number(m.value).toFixed(1)}
                          {m.unit && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{m.unit}</span>}
                        </p>
                        {m.source_name && (
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {m.source_type === "evaluator" ? m.source_org || m.source_name : m.source_name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Club teams */}
              {profile?.club_teams?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-1">Club Teams</h3>
                  <div className="flex flex-wrap gap-1">
                    {profile.club_teams.map((ct, i) => (
                      <Badge key={i} variant={ct.is_current ? "default" : "outline"} className="text-xs">{ct.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="space-y-2">
                {isScout && (
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="h-9 text-xs" disabled={savingProspect} onClick={saveProspect}>
                      <Bookmark className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 text-xs" onClick={openListDialog}>
                      <ListPlus className="h-3.5 w-3.5 mr-1" /> List
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => { setMessageDialogOpen(true); setInitialMessage(""); }}>
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Message
                    </Button>
                  </div>
                )}
                <Button className="w-full" onClick={() => { onOpenChange(false); player?.profile_slug && navigate(`/p/${player.profile_slug}`); }}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Open Full Profile
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add to List Dialog */}
      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
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

      {/* Message Request Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Message {player?.first_name} {player?.last_name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">This will send a message request. The player must accept before you can continue messaging.</p>
          <Textarea
            value={initialMessage}
            onChange={e => setInitialMessage(e.target.value)}
            placeholder="Introduce yourself and why you're reaching out..."
            className="min-h-[80px]"
          />
          <Button className="w-full" disabled={!initialMessage.trim() || sendingMessage} onClick={handleSendMessageRequest}>
            {sendingMessage ? "Sending..." : "Send Request"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
