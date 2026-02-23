import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Globe, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  playerId: string;
}

interface ProfileFields {
  profile_public: boolean;
  show_contact_info: boolean;
  graduation_year: number | null;
  height: string | null;
  weight: number | null;
  gpa: string | null;
  social_twitter: string | null;
  social_instagram: string | null;
  highlight_video_url: string | null;
  profile_slug: string | null;
}

export default function PlayerProfileSettings({ playerId }: Props) {
  const [fields, setFields] = useState<ProfileFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase
      .from("players")
      .select("profile_public, show_contact_info, graduation_year, height, weight, gpa, social_twitter, social_instagram, highlight_video_url, profile_slug")
      .eq("id", playerId)
      .single()
      .then(({ data }) => {
        if (data) setFields(data as unknown as ProfileFields);
      });
  }, [playerId]);

  if (!fields) return null;

  const profileUrl = fields.profile_slug
    ? `${window.location.origin}/p/${fields.profile_slug}`
    : null;

  const update = (partial: Partial<ProfileFields>) => setFields({ ...fields, ...partial });

  const save = async () => {
    setSaving(true);
    const { profile_slug, ...toSave } = fields;
    const { error } = await supabase.from("players").update(toSave as any).eq("id", playerId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save profile settings");
    } else {
      toast.success("Profile updated");
    }
  };

  const copyLink = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast.success("Profile link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="section-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Globe className="h-5 w-5" /> My Public Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Make my profile public</p>
            <p className="text-xs text-muted-foreground">Allow anyone with the link to see your verified metrics</p>
          </div>
          <Switch checked={fields.profile_public} onCheckedChange={(v) => update({ profile_public: v })} />
        </div>

        {fields.profile_public && profileUrl && (
          <div className="flex items-center gap-2">
            <Input value={profileUrl} readOnly className="text-xs bg-muted/40 flex-1" />
            <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" asChild className="shrink-0">
              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}

        {/* Contact info toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Show contact & academic info</p>
            <p className="text-xs text-muted-foreground">GPA and social handles visible on public profile</p>
          </div>
          <Switch checked={fields.show_contact_info} onCheckedChange={(v) => update({ show_contact_info: v })} />
        </div>

        {/* Profile fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Graduation Year</Label>
            <Input
              type="number"
              placeholder="2027"
              value={fields.graduation_year ?? ""}
              onChange={(e) => update({ graduation_year: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div>
            <Label className="text-xs">Height</Label>
            <Input
              placeholder="5'11&quot;"
              value={fields.height ?? ""}
              onChange={(e) => update({ height: e.target.value || null })}
            />
          </div>
          <div>
            <Label className="text-xs">Weight (lbs)</Label>
            <Input
              type="number"
              placeholder="175"
              value={fields.weight ?? ""}
              onChange={(e) => update({ weight: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div>
            <Label className="text-xs">GPA</Label>
            <Input
              placeholder="3.8"
              value={fields.gpa ?? ""}
              onChange={(e) => update({ gpa: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Twitter/X Handle</Label>
            <Input
              placeholder="@username"
              value={fields.social_twitter ?? ""}
              onChange={(e) => update({ social_twitter: e.target.value || null })}
            />
          </div>
          <div>
            <Label className="text-xs">Instagram Handle</Label>
            <Input
              placeholder="@username"
              value={fields.social_instagram ?? ""}
              onChange={(e) => update({ social_instagram: e.target.value || null })}
            />
          </div>
          <div>
            <Label className="text-xs">Highlight Video URL</Label>
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={fields.highlight_video_url ?? ""}
              onChange={(e) => update({ highlight_video_url: e.target.value || null })}
            />
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Profile Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
