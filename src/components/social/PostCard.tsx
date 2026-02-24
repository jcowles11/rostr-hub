import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Share2, Trophy, Video, Dumbbell, Camera, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PostAuthor {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  profile_slug: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_photo?: string | null;
}

export interface PostData {
  id: string;
  author_id: string;
  player_id: string | null;
  post_type: string;
  caption: string | null;
  media_urls: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
  // Joined data
  author?: PostAuthor;
}

const TYPE_ICONS: Record<string, typeof Video> = {
  highlight: Video,
  workout: Dumbbell,
  commitment: Trophy,
  update: Camera,
};

const TYPE_LABELS: Record<string, string> = {
  highlight: "Highlight",
  workout: "Workout",
  commitment: "Commitment",
  update: "Update",
};

interface Props {
  post: PostData;
  onDelete?: () => void;
}

export default function PostCard({ post, onDelete }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [loadingComments, setLoadingComments] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const TypeIcon = TYPE_ICONS[post.post_type] || Camera;
  const author = post.author;

  // Check if user liked this post
  useEffect(() => {
    if (!user) return;
    supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [post.id, user]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(c - 1, 0));
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase
        .from("post_likes")
        .insert({ post_id: post.id, user_id: user.id });
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) {
      // Fetch author names for comments
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: players } = await supabase
        .from("players")
        .select("user_id, first_name, last_name, photo_url")
        .in("user_id", userIds);

      const playerMap = new Map(
        (players || []).map((p) => [p.user_id, p])
      );

      setComments(
        data.map((c) => {
          const p = playerMap.get(c.user_id);
          return {
            ...c,
            author_name: p
              ? `${p.first_name} ${p.last_name}`
              : "User",
            author_photo: p?.photo_url || null,
          };
        })
      );
    }
    setLoadingComments(false);
  };

  const handleToggleComments = () => {
    if (!showComments) {
      loadComments();
    }
    setShowComments(!showComments);
  };

  const submitComment = async () => {
    if (!user || !commentText.trim()) return;
    const content = commentText.trim();
    setCommentText("");

    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: post.id, user_id: user.id, content })
      .select()
      .single();

    if (!error && data) {
      setComments((prev) => [
        ...prev,
        {
          ...data,
          author_name: "You",
          author_photo: null,
        },
      ]);
      setCommentCount((c) => c + 1);
    }
  };

  const deletePost = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id);
    if (!error) {
      toast.success("Post deleted");
      onDelete?.();
    }
  };

  const sharePost = () => {
    if (author?.profile_slug) {
      navigator.clipboard.writeText(
        `${window.location.origin}/p/${author.profile_slug}`
      );
      toast.success("Profile link copied!");
    }
  };

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() =>
            author?.profile_slug && navigate(`/p/${author.profile_slug}`)
          }
        >
          <Avatar className="h-10 w-10 border">
            <AvatarImage
              src={author?.photo_url || undefined}
              className="object-cover"
            />
            <AvatarFallback className="bg-muted text-xs font-bold">
              {author?.first_name?.[0] || "?"}
              {author?.last_name?.[0] || ""}
            </AvatarFallback>
          </Avatar>
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={() =>
              author?.profile_slug && navigate(`/p/${author.profile_slug}`)
            }
            className="font-bold text-sm block truncate hover:underline text-left"
          >
            {author?.first_name} {author?.last_name}
          </button>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <TypeIcon className="h-3 w-3" />
            <span>{TYPE_LABELS[post.post_type] || "Post"}</span>
            <span>•</span>
            <span>
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
        {user?.id === post.author_id && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={deletePost}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Media */}
      {post.media_urls.length > 0 && (
        <div className="relative">
          {post.media_urls[currentMediaIndex]?.match(
            /\.(mp4|mov|webm)(\?|$)/i
          ) ? (
            <video
              src={post.media_urls[currentMediaIndex]}
              controls
              className="w-full aspect-square object-cover bg-muted"
            />
          ) : (
            <img
              src={post.media_urls[currentMediaIndex]}
              alt=""
              className="w-full aspect-square object-cover bg-muted"
            />
          )}
          {post.media_urls.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              {post.media_urls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentMediaIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === currentMediaIndex
                      ? "w-4 bg-white"
                      : "w-1.5 bg-white/50"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="px-4 pt-3">
          <p className="text-sm">
            <span className="font-bold mr-1.5">
              {author?.first_name} {author?.last_name}
            </span>
            {post.caption}
          </p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1 text-xs h-9", liked && "text-destructive")}
          onClick={toggleLike}
        >
          <Heart
            className={cn("h-5 w-5", liked && "fill-current")}
          />
          {likeCount > 0 && likeCount}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs h-9"
          onClick={handleToggleComments}
        >
          <MessageCircle className="h-5 w-5" />
          {commentCount > 0 && commentCount}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs h-9"
          onClick={sharePost}
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t px-4 py-3 space-y-3">
          {loadingComments ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : (
            <>
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage
                      src={c.author_photo || undefined}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-[9px] bg-muted">
                      {c.author_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs">
                      <span className="font-bold mr-1">{c.author_name}</span>
                      {c.content}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {user && (
                <div className="flex gap-2 items-center">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="h-9 text-xs rounded-full"
                    onKeyDown={(e) => e.key === "Enter" && submitComment()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0"
                    disabled={!commentText.trim()}
                    onClick={submitComment}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
