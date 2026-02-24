import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, User, Heart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CreatePost from "@/components/social/CreatePost";
import PostCard, { type PostData } from "@/components/social/PostCard";

interface FeedPlayer {
  id: string;
  first_name: string;
  last_name: string;
  positions: string[] | null;
  photo_url: string | null;
  profile_slug: string | null;
  graduation_year: number | null;
  school_name: string;
  program_name: string;
  sport?: string;
  recruiting_status?: string;
  committed_school_name?: string | null;
  metric_count?: number;
}

interface SocialFeed {
  featured: FeedPlayer[];
  recent: FeedPlayer[];
  commitments: FeedPlayer[];
}

/* ── Stories strip ── */
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

export default function SocialHome() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [featured, setFeatured] = useState<FeedPlayer[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const canPost = userRole === "player" || userRole === "coach";

  const fetchPosts = useCallback(async () => {
    const { data: postRows } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (postRows && postRows.length > 0) {
      // Get author info by user_id
      const authorIds = [...new Set(postRows.map((p) => p.author_id))];
      const { data: playersByUser } = await supabase
        .from("players")
        .select("user_id, first_name, last_name, photo_url, profile_slug, id")
        .in("user_id", authorIds);

      const userMap = new Map(
        (playersByUser || []).map((p) => [p.user_id, p])
      );

      // Also fetch players by player_id for posts where author lookup may fail (demo data)
      const playerIds = postRows
        .filter((p) => p.player_id && !userMap.has(p.author_id))
        .map((p) => p.player_id!);

      let playerIdMap = new Map<string, { id: string; first_name: string; last_name: string; photo_url: string | null; profile_slug: string | null }>();
      if (playerIds.length > 0) {
        const { data: playersByPid } = await supabase
          .from("players")
          .select("id, first_name, last_name, photo_url, profile_slug")
          .in("id", [...new Set(playerIds)]);
        playersByPid?.forEach((p) => playerIdMap.set(p.id, p));
      }

      const enriched: PostData[] = postRows.map((p) => {
        const byUser = userMap.get(p.author_id);
        const byPid = p.player_id ? playerIdMap.get(p.player_id) : undefined;
        const player = byUser || byPid;
        return {
          ...p,
          media_urls: p.media_urls || [],
          author: player
            ? {
                id: byUser?.id || byPid?.id || p.player_id || "",
                first_name: player.first_name,
                last_name: player.last_name,
                photo_url: player.photo_url,
                profile_slug: player.profile_slug,
              }
            : undefined,
        };
      });

      setPosts(enriched);
    } else {
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      // Fetch featured players
      const { data: feedData } = await supabase.rpc("get_social_feed", { _limit: 10 });
      if (feedData) {
        const feed = feedData as unknown as SocialFeed;
        setFeatured(feed.featured || []);
      }

      // Fetch follows
      if (user) {
        const { data: followData } = await supabase
          .from("follows")
          .select("followed_player_id")
          .eq("follower_id", user.id);
        if (followData) {
          setFollowedIds(new Set(followData.map((f) => f.followed_player_id)));
        }
      }

      await fetchPosts();
      setLoading(false);
    };
    fetchAll();
  }, [user, fetchPosts]);

  // Filter posts for "following" tab
  const displayPosts =
    tab === "following"
      ? posts.filter((p) => p.player_id && followedIds.has(p.player_id))
      : posts;

  if (loading) {
    return (
      <div className="space-y-5 p-4">
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-[72px] rounded-full shrink-0" />
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stories */}
      <StoriesStrip players={featured} navigate={navigate} />

      {/* Create post */}
      {canPost && <CreatePost onPostCreated={fetchPosts} />}

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

      {/* Post feed */}
      {displayPosts.length === 0 ? (
        <div className="py-16 text-center">
          <User className="mx-auto h-10 w-10 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">
            {tab === "following"
              ? "Follow players to see their posts here"
              : "No posts yet — be the first to share!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4 stagger-list">
          {displayPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={fetchPosts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
