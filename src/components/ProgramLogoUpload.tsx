import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ProgramLogoUpload() {
  const { coach, refreshCoach } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coach) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${coach.program_id}/logo.${ext}`;

    // Remove old logo if exists
    await supabase.storage.from("program-logos").remove([path]);

    const { error: uploadError } = await supabase.storage
      .from("program-logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("program-logos")
      .getPublicUrl(path);

    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase
      .from("programs")
      .update({ logo_url: logoUrl } as any)
      .eq("id", coach.program_id);

    await refreshCoach();
    toast.success("Logo updated!");
    setUploading(false);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/50 transition-all hover:border-primary/50 hover:bg-muted overflow-hidden",
          uploading && "opacity-50"
        )}
      >
        {coach?.logo_url ? (
          <img
            src={coach.logo_url}
            alt="Program logo"
            className="h-full w-full object-cover rounded-2xl"
          />
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
          <Camera className="h-5 w-5 text-white" />
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <p className="text-xs text-muted-foreground">
        {uploading ? "Uploading..." : "Program Logo"}
      </p>
    </div>
  );
}
