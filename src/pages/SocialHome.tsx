import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Clock, Trophy, User, GraduationCap, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FeedPlayer {
  id: string;
  first_name: string;
  last_name: string;
  positions: string[] | null;
  photo_url: string | null;
  profile_slug: string | null;
  graduation_year: number | null;
  height?: string | null;
  weight?: number | null;
  school_name: string;
  program_name: string;
  sport?: string;
  program_logo?: string | null;
  recruiting_status?: string;
  committed_school_name?: string | null;
  committed_school_logo_url?: string | null;
  commitment_date?: string | null;
  metric_count?: number;
  updated_at?: string;
}

interface SocialFeed {
  featured: FeedPlayer[];
  recent: FeedPlayer[];
  commitments: FeedPlayer[];
}

function PlayerMiniCard({ player, onClick }: { player: FeedPlayer; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full rounded-xl p-3 text-left transition-all hover:bg-muted/60 active:scale-[0.99]">
      <Avatar className="h-11 w-11 rounded-xl border shrink-0">
        <AvatarImage src={player.photo_url || undefined} className="object-cover" />
        <AvatarFallback className="rounded-xl bg-muted text-xs font-bold">
          {player.first_name[0]}{player.last_name[0]}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm truncate">{player.first_name} {player.last_name}</span>
          {player.recruiting_status === "committed" && (
            <Badge className="bg-accent/15 text-accent border-0 text-[9px] px-1.5 py-0 shrink-0">Committed</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {player.school_name}
          {player.graduation_year && ` • ${player.graduation_year}`}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {player.positions?.slice(0, 3).map((pos) => (
            <Badge key={pos} variant="secondary" className="text-[9px] px-1.5 py-0">{pos}</Badge>
          ))}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
    </button>
  );
}

function FeaturedStrip({ players, navigate }: { players: FeedPlayer[]; navigate: (path: string) => void }) {
  if (players.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold flex items-center gap-2 px-1">
        <Star className="h-4 w-4 text-secondary" /> Featured Players
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {players.slice(0, 8).map((p) => (
          <button
            key={p.id}
            onClick={() => p.profile_slug && navigate(`/p/${p.profile_slug}`)}
            className="flex flex-col items-center gap-2 min-w-[90px] rounded-xl p-3 bg-card border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <Avatar className="h-14 w-14 rounded-xl border">
              <AvatarImage src={p.photo_url || undefined} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-muted text-sm font-bold">
                {p.first_name[0]}{p.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="text-center min-w-0 w-full">
              <p className="text-xs font-bold truncate">{p.first_name} {p.last_name?.charAt(0)}.</p>
              <p className="text-[10px] text-muted-foreground truncate">{p.positions?.[0] || ""} {p.graduation_year ? `'${String(p.graduation_year).slice(-2)}` : ""}</p>
              {p.recruiting_status === "committed" && (
                <Badge className="bg-accent/15 text-accent border-0 text-[8px] px-1 py-0 mt-0.5">✓ Committed</Badge>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CommitmentCard({ player, onClick }: { player: FeedPlayer; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full rounded-xl p-3 text-left bg-accent/5 border border-accent/10 transition-all hover:bg-accent/10 active:scale-[0.99]">
      <Avatar className="h-11 w-11 rounded-xl border shrink-0">
        <AvatarImage src={player.photo_url || undefined} className="object-cover" />
        <AvatarFallback className="rounded-xl bg-muted text-xs font-bold">
          {player.first_name[0]}{player.last_name[0]}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <span className="font-bold text-sm truncate block">{player.first_name} {player.last_name}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Trophy className="h-3 w-3 text-accent shrink-0" />
          <span className="text-xs font-semibold text-accent truncate">
            Committed to {player.committed_school_name}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {player.school_name}
          {player.graduation_year && ` • Class of ${player.graduation_year}`}
        </p>
      </div>
      {player.committed_school_logo_url && (
        <img src={player.committed_school_logo_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
      )}
    </button>
  );
}

export default function SocialHome() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<SocialFeed | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      const { data, error } = await supabase.rpc("get_social_feed", { _limit: 20 });
      if (!error && data) {
        setFeed(data as unknown as SocialFeed);
      }
      setLoading(false);
    };
    fetchFeed();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex gap-3 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-24 rounded-xl shrink-0" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!feed) return null;

  return (
    <div className="space-y-6">
      {/* Featured strip */}
      <FeaturedStrip players={feed.featured} navigate={navigate} />

      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="recent" className="flex-1 gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Recently Updated
          </TabsTrigger>
          <TabsTrigger value="commitments" className="flex-1 gap-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5" /> Commitments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-3">
          <Card className="section-card">
            <CardContent className="p-2">
              {feed.recent.length === 0 ? (
                <div className="py-12 text-center">
                  <User className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No public profiles yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {feed.recent.map((p) => (
                    <PlayerMiniCard
                      key={p.id}
                      player={p}
                      onClick={() => p.profile_slug && navigate(`/p/${p.profile_slug}`)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commitments" className="mt-3">
          <Card className="section-card">
            <CardContent className="p-2">
              {feed.commitments.length === 0 ? (
                <div className="py-12 text-center">
                  <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No commitments yet</p>
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {feed.commitments.map((p) => (
                    <CommitmentCard
                      key={p.id}
                      player={p}
                      onClick={() => p.profile_slug && navigate(`/p/${p.profile_slug}`)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
