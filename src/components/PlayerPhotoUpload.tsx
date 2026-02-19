import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PlayerPhotoUploadProps {
  playerId?: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

export default function PlayerPhotoUpload({
  playerId,
  currentUrl,
  onUploaded,
  size = "md",
  className,
}: PlayerPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${playerId || crypto.randomUUID()}-${Date.now()}.${fileExt}`;
    const filePath = `photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("player-photos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload photo");
      setPreview(null);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("player-photos")
      .getPublicUrl(filePath);

    onUploaded(urlData.publicUrl);
    setUploading(false);
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-all flex items-center justify-center bg-muted",
          sizeClasses[size],
          uploading && "opacity-60"
        )}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Player"
            className="h-full w-full object-cover"
          />
        ) : (
          <User className={cn("text-muted-foreground", size === "lg" ? "h-10 w-10" : size === "md" ? "h-7 w-7" : "h-4 w-4")} />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-all rounded-full">
          <Camera className={cn("text-white opacity-0 hover:opacity-100 transition-opacity", size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
