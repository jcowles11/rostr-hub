import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Copy, Check, ExternalLink, Trophy, Link2 } from "lucide-react";
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
  recruiting_status: string;
  committed_school_name: string | null;
  committed_school_logo_url: string | null;
  commitment_date: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  gamechanger_profile_url: string | null;
  maxpreps_profile_url: string | null;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function isValidUrl(val: string | null): boolean {
  if (!val) return true;
  try {
    const u = new URL(val);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidEmail(val: string | null): boolean {
  if (!val) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isValidPhone(val: string | null): boolean {
  if (!val) return true;
  return /^[\d\s\-\(\)\+\.]{7,20}$/.test(val);
}

export default function PlayerProfileSettings({ playerId }: Props) {
  const [fields, setFields] = useState<ProfileFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase
      .from("players")
      .select("profile_public, show_contact_info, graduation_year, height, weight, gpa, social_twitter, social_instagram, highlight_video_url, profile_slug, recruiting_status, committed_school_name, committed_school_logo_url, commitment_date, city, state, email, phone, gamechanger_profile_url, maxpreps_profile_url")
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
    // Validation
    if (!isValidEmail(fields.email)) { toast.error("Invalid email format"); return; }
    if (!isValidPhone(fields.phone)) { toast.error("Invalid phone format"); return; }
    if (!isValidUrl(fields.highlight_video_url)) { toast.error("Invalid highlight video URL"); return; }
    if (!isValidUrl(fields.gamechanger_profile_url)) { toast.error("Invalid GameChanger URL"); return; }
    if (!isValidUrl(fields.maxpreps_profile_url)) { toast.error("Invalid MaxPreps URL"); return; }

    if (fields.recruiting_status === "committed" && !fields.committed_school_name?.trim()) {
      toast.error("School name is required when committed");
      return;
    }

    setSaving(true);
    const { profile_slug, ...toSave } = fields;
    // Clear commitment fields if uncommitted
    if (toSave.recruiting_status === "uncommitted") {
      toSave.committed_school_name = null;
      toSave.committed_school_logo_url = null;
      toSave.commitment_date = null;
    }
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
    <div className="space-y-5">
      {/* Public Profile Card */}
      <Card className="section-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Globe className="h-5 w-5" /> My Public Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Show contact & academic info</p>
              <p className="text-xs text-muted-foreground">Email, phone, GPA and social handles visible on public profile</p>
            </div>
            <Switch checked={fields.show_contact_info} onCheckedChange={(v) => update({ show_contact_info: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Commitment Status */}
      <Card className="section-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5" /> Recruiting Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={fields.recruiting_status} onValueChange={(v) => update({ recruiting_status: v })}>
              <SelectTrigger className="h-9 text-sm rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uncommitted">Uncommitted</SelectItem>
                <SelectItem value="committed">Committed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fields.recruiting_status === "committed" && (
            <div className="space-y-3 rounded-xl bg-accent/5 border border-accent/10 p-3">
              <div>
                <Label className="text-xs">School Name *</Label>
                <Input
                  placeholder="University of..."
                  value={fields.committed_school_name ?? ""}
                  onChange={(e) => update({ committed_school_name: e.target.value || null })}
                />
              </div>
              <div>
                <Label className="text-xs">School Logo URL (optional)</Label>
                <Input
                  placeholder="https://..."
                  value={fields.committed_school_logo_url ?? ""}
                  onChange={(e) => update({ committed_school_logo_url: e.target.value || null })}
                />
              </div>
              <div>
                <Label className="text-xs">Commitment Date</Label>
                <Input
                  type="date"
                  value={fields.commitment_date ?? ""}
                  onChange={(e) => update({ commitment_date: e.target.value || null })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bio & Location */}
      <Card className="section-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Bio & Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Graduation Year</Label>
              <Input type="number" placeholder="2027" value={fields.graduation_year ?? ""} onChange={(e) => update({ graduation_year: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label className="text-xs">Height</Label>
              <Input placeholder="5'11&quot;" value={fields.height ?? ""} onChange={(e) => update({ height: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs">Weight (lbs)</Label>
              <Input type="number" placeholder="175" value={fields.weight ?? ""} onChange={(e) => update({ weight: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label className="text-xs">GPA</Label>
              <Input placeholder="3.8" value={fields.gpa ?? ""} onChange={(e) => update({ gpa: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs">City</Label>
              <Input placeholder="Austin" value={fields.city ?? ""} onChange={(e) => update({ city: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs">State</Label>
              <Select value={fields.state ?? ""} onValueChange={(v) => update({ state: v || null })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="section-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Contact Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" placeholder="player@email.com" value={fields.email ?? ""} onChange={(e) => update({ email: e.target.value || null })} />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input type="tel" placeholder="(555) 555-5555" value={fields.phone ?? ""} onChange={(e) => update({ phone: e.target.value || null })} />
          </div>
        </CardContent>
      </Card>

      {/* Social & Media */}
      <Card className="section-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Social & Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Twitter/X Handle</Label>
            <Input placeholder="@username" value={fields.social_twitter ?? ""} onChange={(e) => update({ social_twitter: e.target.value || null })} />
          </div>
          <div>
            <Label className="text-xs">Instagram Handle</Label>
            <Input placeholder="@username" value={fields.social_instagram ?? ""} onChange={(e) => update({ social_instagram: e.target.value || null })} />
          </div>
          <div>
            <Label className="text-xs">Highlight Video URL</Label>
            <Input placeholder="https://youtube.com/watch?v=..." value={fields.highlight_video_url ?? ""} onChange={(e) => update({ highlight_video_url: e.target.value || null })} />
          </div>
        </CardContent>
      </Card>

      {/* Stats Integrations */}
      <Card className="section-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Stats Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">GameChanger Profile URL</Label>
            <Input placeholder="https://web.gc.com/..." value={fields.gamechanger_profile_url ?? ""} onChange={(e) => update({ gamechanger_profile_url: e.target.value || null })} />
            {fields.gamechanger_profile_url && isValidUrl(fields.gamechanger_profile_url) && (
              <p className="text-[10px] text-accent mt-1 font-medium">✓ Connected</p>
            )}
          </div>
          <div>
            <Label className="text-xs">MaxPreps Profile URL</Label>
            <Input placeholder="https://maxpreps.com/..." value={fields.maxpreps_profile_url ?? ""} onChange={(e) => update({ maxpreps_profile_url: e.target.value || null })} />
            {fields.maxpreps_profile_url && isValidUrl(fields.maxpreps_profile_url) && (
              <p className="text-[10px] text-accent mt-1 font-medium">✓ Connected</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full gradient-primary border-0 text-primary-foreground font-bold rounded-xl">
        {saving ? "Saving..." : "Save Profile Settings"}
      </Button>
    </div>
  );
}
