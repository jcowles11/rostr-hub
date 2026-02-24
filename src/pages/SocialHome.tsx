import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Trophy, User, Heart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

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

/* ── Stories strip (horizontal scroll) ── */
function StoriesStrip({ players, navigate }: { players: FeedPlayer[]; navigate: (p: string) => void }) {
  if (players.length === 0) return null;
  return (
    <div className="space-y-2.5">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 text-secondary" /> Featured
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {players.slice(0, 10).map((p) => (
          <button
            key={p.id}
            onClick={() => p.profile_slug && navigate(`/p/${p.profile_slug}`)}
            className="flex flex-col items-center gap-1.5 min-w-[72px]"
          >
            <div className="rounded-full p-[2px] bg-gradient-to-br from-secondary to-accent">
              <Avatar className="h-16 w-16 border-2 border-card">
                <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                <AvatarFallback className="bg-muted text-sm font-bold">
                  {p.first_name[0]}{p.last_name[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <span className="text-[10px] font-semibold truncate w-full text-center">
              {p.first_name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Large feed card (IG / TikTok style) ── */
function FeedCard({
  player,
  navigate,
  isFollowed,
  onToggleFollow,
}: {
  player: FeedPlayer;
  navigate: (p: string) => void;
  isFollowed: boolean;
  onToggleFollow: (playerId: string) => void;
}) {
  const isCommitted = player.recruiting_status === "committed";

  return (
    <div className="rounded-2xl overflow-hidden border bg-card shadow-sm">
      {/* Image area */}
      <button
        onClick={() => player.profile_slug && navigate(`/p/${player.profile_slug}`)}
        className="relative w-full aspect-[4/3] bg-muted block overflow-hidden"
      >
        {player.photo_url ? (
          <img
            src={player.photo_url}
            alt={`${player.first_name} ${player.last_name}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <User className="h-16 w-16 text-muted-foreground/20" />
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Overlaid info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-white font-extrabold text-lg leading-tight drop-shadow-md">
                {player.first_name} {player.last_name}
              </h3>
              <p className="text-white/80 text-xs mt-0.5">
                {player.school_name}
                {player.graduation_year && ` • '${String(player.graduation_year).slice(-2)}`}
              </p>
            </div>
            {isCommitted && player.committed_school_logo_url && (
              <img
                src={player.committed_school_logo_url}
                alt=""
                className="h-8 w-8 rounded object-cover border border-white/30 shrink-0"
              />
            )}
          </div>
        </div>
      </button>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {player.positions?.slice(0, 3).map((pos) => (
            <Badge key={pos} variant="secondary" className="text-[9px] px-1.5 py-0">
              {pos}
            </Badge>
          ))}
          {isCommitted && (
            <Badge className="bg-accent/15 text-accent border-0 text-[9px] px-1.5 py-0 gap-0.5">
              <Trophy className="h-2.5 w-2.5" /> {player.committed_school_name}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2.5 text-xs gap-1",
            isFollowed && "text-destructive"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFollow(player.id);
          }}
        >
          <Heart className={cn("h-4 w-4", isFollowed && "fill-current")} />
          {isFollowed ? "Following" : "Follow"}
        </Button>
      </div>
    </div>
  );
}

/* ── Main Feed ── */
export default function SocialHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feed, setFeed] = useState<SocialFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingPlayers, setFollowingPlayers] = useState<FeedPlayer[]>([]);

  // Fetch feed + follows
  useEffect(() => {
    const fetchAll = async () => {
      const [feedRes, followRes] = await Promise.all([
        supabase.rpc("get_social_feed", { _limit: 30 }),
        user
          ? supabase.from("follows").select("followed_player_id").eq("follower_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      if (!feedRes.error && feedRes.data) {
        setFeed(feedRes.data as unknown as SocialFeed);
      }

      if (followRes.data) {
        const ids = new Set((followRes.data as any[]).map((f: any) => f.followed_player_id));
        setFollowedIds(ids);
      }

      setLoading(false);
    };
    fetchAll();
  }, [user]);

  // When switching to "following" tab, fetch followed players
  useEffect(() => {
    if (tab !== "following" || followedIds.size === 0 || !feed) return;
    // Filter from existing feed data for now
    const all = [...(feed.featured || []), ...(feed.recent || []), ...(feed.commitments || [])];
    const unique = new Map<string, FeedPlayer>();
    all.forEach((p) => {
      if (followedIds.has(p.id)) unique.set(p.id, p);
    });
    setFollowingPlayers(Array.from(unique.values()));
  }, [tab, followedIds, feed]);

  const toggleFollow = async (playerId: string) => {
    if (!user) return;
    const isFollowed = followedIds.has(playerId);
    const next = new Set(followedIds);
    if (isFollowed) {
      next.delete(playerId);
      setFollowedIds(next);
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("followed_player_id", playerId);
    } else {
      next.add(playerId);
      setFollowedIds(next);
      await supabase.from("follows").insert({ follower_id: user.id, followed_player_id: playerId });
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 p-4">
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-[72px] rounded-full shrink-0" />
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!feed) return null;

  // Merge recent + commitments for "For You" feed, sorted by updated_at
  const forYouPlayers: FeedPlayer[] = [];
  const seenIds = new Set<string>();
  [...feed.recent, ...feed.commitments].forEach((p) => {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      forYouPlayers.push(p);
    }
  });

  const displayPlayers = tab === "foryou" ? forYouPlayers : followingPlayers;

  return (
    <div className="space-y-5">
      {/* Stories */}
      <StoriesStrip players={feed.featured} navigate={navigate} />

      {/* For You / Following tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        <button
          onClick={() => setTab("foryou")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
            tab === "foryou"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground"
          )}
        >
          For You
        </button>
        <button
          onClick={() => setTab("following")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
            tab === "following"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground"
          )}
        >
          Following
        </button>
      </div>

      {/* Feed cards */}
      {displayPlayers.length === 0 ? (
        <div className="py-16 text-center">
          <User className="mx-auto h-10 w-10 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">
            {tab === "following"
              ? "Follow players to see their updates here"
              : "No public profiles yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4 stagger-list">
          {displayPlayers.map((p) => (
            <FeedCard
              key={p.id}
              player={p}
              navigate={navigate}
              isFollowed={followedIds.has(p.id)}
              onToggleFollow={toggleFollow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
