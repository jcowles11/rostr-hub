import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sendPlayerMessage } from "@/services/messagingService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, ChevronLeft, Send, Check, X, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ConversationRequest {
  id: string;
  scout_id: string;
  initial_message: string;
  status: string;
  created_at: string;
  scout: {
    full_name: string;
    organization_name: string;
    title: string | null;
    photo_url: string | null;
    division: string | null;
  };
}

interface Conversation {
  id: string;
  scout_id: string;
  player_id: string;
  last_message_at: string;
  scout: {
    full_name: string;
    organization_name: string;
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

export default function PlayerMessagesPage() {
  const { playerInfo } = useAuth();
  const [requests, setRequests] = useState<ConversationRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (playerInfo) {
      fetchRequests();
      fetchConversations();
    }
  }, [playerInfo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeConvo) return;
    const channel = supabase
      .channel(`messages-${activeConvo.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvo.id}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvo]);

  const fetchRequests = async () => {
    if (!playerInfo) return;
    const { data } = await supabase
      .from("conversation_requests")
      .select("id, scout_id, initial_message, status, created_at, scouts(full_name, organization_name, title, photo_url, division)")
      .eq("player_id", playerInfo.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setRequests(data.map((d: any) => ({ ...d, scout: d.scouts })));
    setLoading(false);
  };

  const fetchConversations = async () => {
    if (!playerInfo) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, scout_id, player_id, last_message_at, scouts(full_name, organization_name, photo_url)")
      .eq("player_id", playerInfo.id)
      .order("last_message_at", { ascending: false });
    if (data) setConversations(data.map((d: any) => ({ ...d, scout: d.scouts })));
  };

  const acceptRequest = async (requestId: string) => {
    const { error } = await supabase.rpc("accept_conversation_request", { _request_id: requestId });
    if (error) { toast.error("Failed to accept"); return; }
    toast.success("Request accepted! You can now message this scout.");
    setRequests(prev => prev.filter(r => r.id !== requestId));
    fetchConversations();
  };

  const declineRequest = async (requestId: string) => {
    const { error } = await supabase.rpc("decline_conversation_request", { _request_id: requestId });
    if (error) { toast.error("Failed to decline"); return; }
    toast.success("Request declined");
    setRequests(prev => prev.filter(r => r.id !== requestId));
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
    if (!activeConvo || !playerInfo || !newMessage.trim()) return;
    setSending(true);
    await sendPlayerMessage(activeConvo.id, playerInfo.id, newMessage.trim());
    setNewMessage("");
    setSending(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (activeConvo) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-8 flex flex-col h-[calc(100vh-140px)] animate-fade-in">
        <button onClick={() => setActiveConvo(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-9 w-9 rounded-lg border">
            <AvatarImage src={activeConvo.scout.photo_url || undefined} className="object-cover" />
            <AvatarFallback className="rounded-lg bg-muted text-xs font-bold">
              {activeConvo.scout.full_name.split(" ").map(n => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-bold">{activeConvo.scout.full_name}</p>
            <p className="text-xs text-muted-foreground">{activeConvo.scout.organization_name}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {messages.map(m => (
            <div key={m.id} className={cn("flex", m.sender_role === "player" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                m.sender_role === "player" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {m.body}
                <p className={cn("text-[10px] mt-0.5", m.sender_role === "player" ? "text-primary-foreground/60" : "text-muted-foreground")}>
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
        <h1 className="text-lg font-extrabold">Messages</h1>
      </div>

      <Tabs defaultValue={requests.length > 0 ? "requests" : "conversations"}>
        <TabsList className="w-full">
          <TabsTrigger value="requests" className="flex-1">
            Requests {requests.length > 0 && <Badge className="ml-1 bg-destructive text-destructive-foreground text-[10px] h-4 min-w-[16px] px-1">{requests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="conversations" className="flex-1">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-2 mt-3">
          {requests.length === 0 ? (
            <div className="py-12 text-center">
              <Mail className="mx-auto h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </div>
          ) : requests.map(r => (
            <Card key={r.id} className="section-card">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-9 w-9 rounded-lg border">
                    <AvatarImage src={r.scout.photo_url || undefined} className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-muted text-xs font-bold">
                      {r.scout.full_name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{r.scout.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.scout.organization_name}{r.scout.division ? ` • ${r.scout.division}` : ""}{r.scout.title ? ` • ${r.scout.title}` : ""}
                    </p>
                  </div>
                </div>
                <p className="text-sm bg-muted rounded-lg px-3 py-2">{r.initial_message}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => acceptRequest(r.id)}>
                    <Check className="h-4 w-4 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => declineRequest(r.id)}>
                    <X className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="conversations" className="space-y-2 mt-3">
          {conversations.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : conversations.map(c => (
            <Card key={c.id} className="section-card cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openConversation(c)}>
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-lg border">
                  <AvatarImage src={c.scout.photo_url || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-muted text-xs font-bold">
                    {c.scout.full_name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{c.scout.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.scout.organization_name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">{new Date(c.last_message_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
