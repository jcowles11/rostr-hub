import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Camera, Video, Trophy, Dumbbell, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const POST_TYPES = [
  { value: "highlight", label: "Highlight", icon: Video },
  { value: "workout", label: "Workout", icon: Dumbbell },
  { value: "commitment", label: "Commitment", icon: Trophy },
  { value: "update", label: "Update", icon: Camera },
] as const;

interface Props {
  onPostCreated: () => void;
}

export default function CreatePost({ onPostCreated }: Props) {
  const { user, playerInfo } = useAuth();
  const [caption, setCaption] = useState("");
  const [postType, setPostType] = useState<string>("update");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + mediaFiles.length > 4) {
      toast.error("Maximum 4 files per post");
      return;
    }
    const validFiles = files.filter((f) => {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 20MB limit`);
        return false;
      }
      return true;
    });
    setMediaFiles((prev) => [...prev, ...validFiles]);
    validFiles.forEach((f) => {
      const url = URL.createObjectURL(f);
      setMediaPreviews((prev) => [...prev, url]);
    });
    setExpanded(true);
  };

  const removeMedia = (index: number) => {
    URL.revokeObjectURL(mediaPreviews[index]);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!user || (!caption.trim() && mediaFiles.length === 0)) return;
    setPosting(true);

    try {
      // Upload media
      const mediaUrls: string[] = [];
      for (const file of mediaFiles) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("post-media")
          .upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("post-media")
          .getPublicUrl(path);
        mediaUrls.push(urlData.publicUrl);
      }

      // Get player_id if user is a player
      let playerId: string | null = null;
      if (playerInfo) {
        const { data: player } = await supabase
          .from("players")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        playerId = player?.id || null;
      }

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        player_id: playerId,
        post_type: postType,
        caption: caption.trim() || null,
        media_urls: mediaUrls,
      });

      if (error) throw error;

      setCaption("");
      setPostType("update");
      setMediaFiles([]);
      mediaPreviews.forEach(URL.revokeObjectURL);
      setMediaPreviews([]);
      setExpanded(false);
      toast.success("Posted!");
      onPostCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div
        className="flex items-start gap-3 cursor-text"
        onClick={() => setExpanded(true)}
      >
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Camera className="h-5 w-5 text-primary" />
        </div>
        <Textarea
          placeholder="Share a highlight, workout, or update..."
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value);
            setExpanded(true);
          }}
          className="min-h-[44px] resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 shadow-none"
          rows={expanded ? 3 : 1}
        />
      </div>

      {expanded && (
        <>
          {/* Post type selector */}
          <div className="flex gap-1.5 flex-wrap">
            {POST_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setPostType(value)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                  postType === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Media previews */}
          {mediaPreviews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mediaPreviews.map((url, i) => (
                <div key={i} className="relative shrink-0">
                  {mediaFiles[i]?.type.startsWith("video/") ? (
                    <video
                      src={url}
                      className="h-24 w-24 rounded-xl object-cover"
                    />
                  ) : (
                    <img
                      src={url}
                      alt=""
                      className="h-24 w-24 rounded-xl object-cover"
                    />
                  )}
                  <button
                    onClick={() => removeMedia(i)}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground h-5 w-5 flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-muted-foreground"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-4 w-4" /> Media
              </Button>
            </div>
            <Button
              size="sm"
              disabled={posting || (!caption.trim() && mediaFiles.length === 0)}
              onClick={handlePost}
              className="rounded-full px-5 text-xs font-bold"
            >
              {posting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
