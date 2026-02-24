import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ChevronLeft, Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  scout_id: string;
  player_id: string;
  last_message_at: string;
  player: {
    first_name: string;
    last_name: string;
    photo_url: string | null;
    graduation_year: number | null;
    positions: string[] | null;
  };
  unread_count?: number;
}

interface PendingRequest {
  id: string;
  player_id: string;
  initial_message: string;
  status: string;
  created_at: string;
  player: {
    first_name: string;
    last_name: string;
    photo_url: string | null;
  };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_role: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export default function ScoutMessagesPage() {
  const { scoutInfo } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scoutInfo) {
      fetchConversations();
      fetchPendingRequests();
    }
  }, [scoutInfo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime messages
  useEffect(() => {
    if (!activeConvo) return;
    const channel = supabase
      .channel(`messages-${activeConvo.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvo.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvo]);

  const fetchConversations = async () => {
    if (!scoutInfo) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, scout_id, player_id, last_message_at, players(first_name, last_name, photo_url, graduation_year, positions)")
      .eq("scout_id", scoutInfo.id)
      .order("last_message_at", { ascending: false });
    if (data) setConversations(data.map((d: any) => ({ ...d, player: d.players })));
    setLoading(false);
  };

  const fetchPendingRequests = async () => {
    if (!scoutInfo) return;
    const { data } = await supabase
      .from("conversation_requests")
      .select("id, player_id, initial_message, status, created_at, players(first_name, last_name, photo_url)")
      .eq("scout_id", scoutInfo.id)
      .eq("status", "pending");
    if (data) setPendingRequests(data.map((d: any) => ({ ...d, player: d.players })));
  };

  const openConversation = async (convo: Conversation) => {
    setActiveConvo(convo);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convo.id)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!activeConvo || !scoutInfo || !newMessage.trim()) return;
    setSending(true);
    await supabase.from("messages").insert({
      conversation_id: activeConvo.id,
      sender_role: "scout",
      sender_id: scoutInfo.id,
      body: newMessage.trim(),
    });
    setNewMessage("");
    setSending(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading messages...</p></div>;
  }

  // Conversation thread view
  if (activeConvo) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-8 flex flex-col h-[calc(100vh-140px)] animate-fade-in">
        <button onClick={() => setActiveConvo(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-9 w-9 rounded-lg border">
            <AvatarImage src={activeConvo.player.photo_url || undefined} className="object-cover" />
            <AvatarFallback className="rounded-lg bg-muted text-xs font-bold">
              {activeConvo.player.first_name[0]}{activeConvo.player.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-bold">{activeConvo.player.first_name} {activeConvo.player.last_name}</p>
            <p className="text-xs text-muted-foreground">{activeConvo.player.graduation_year || ""}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {messages.map(m => (
            <div key={m.id} className={cn("flex", m.sender_role === "scout" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                m.sender_role === "scout" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {m.body}
                <p className={cn("text-[10px] mt-0.5", m.sender_role === "scout" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-8 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold">Messages</h1>
          <p className="text-xs text-muted-foreground">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Pending requests sent */}
      {pendingRequests.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Requests</p>
          {pendingRequests.map(req => (
            <Card key={req.id} className="section-card">
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9 rounded-lg border">
                  <AvatarImage src={req.player.photo_url || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-muted text-xs font-bold">
                    {req.player.first_name[0]}{req.player.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{req.player.first_name} {req.player.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{req.initial_message}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  <Clock className="h-3 w-3 mr-1" /> Pending
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Conversations */}
      {conversations.length === 0 && pendingRequests.length === 0 ? (
        <div className="py-16 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">No conversations yet</p>
          <p className="text-xs text-muted-foreground">Send a message request from a player profile</p>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversations</p>}
          {conversations.map(c => (
            <Card key={c.id} className="section-card cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openConversation(c)}>
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-lg border">
                  <AvatarImage src={c.player.photo_url || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-muted text-xs font-bold">
                    {c.player.first_name[0]}{c.player.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{c.player.first_name} {c.player.last_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.player.graduation_year ? `Class of ${c.player.graduation_year}` : ""}
                    {c.player.positions?.length ? ` • ${c.player.positions.slice(0, 2).join(", ")}` : ""}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(c.last_message_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
