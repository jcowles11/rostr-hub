import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { updateScoutProfile } from "@/services/scoutService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const DIVISIONS = ["D1", "D2", "D3", "NAIA", "JUCO", "Other"];
const TITLES = [
  "Head Coach",
  "Associate Head Coach",
  "Assistant Coach",
  "Recruiting Coordinator",
  "Director of Operations",
  "Volunteer Assistant",
  "Graduate Assistant",
];
const POSITIONS = ["P","C","1B","2B","3B","SS","LF","CF","RF","DH","UTIL"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

interface ScoutProfile {
  id: string;
  full_name: string;
  organization_name: string;
  title: string | null;
  sport: string;
  division: string | null;
  location_city: string | null;
  location_state: string | null;
  recruiting_territories: string[] | null;
  positions_recruiting: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  photo_url: string | null;
}

const REQUIRED_FIELDS: { key: keyof ScoutProfile; label: string }[] = [
  { key: "full_name", label: "Full Name" },
  { key: "organization_name", label: "School / Organization" },
  { key: "title", label: "Title" },
  { key: "division", label: "Division" },
];

export default function ScoutProfilePage() {
  const { user, refreshScout } = useAuth();
  const [profile, setProfile] = useState<ScoutProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("scouts")
        .select("id, full_name, organization_name, title, sport, division, location_city, location_state, recruiting_territories, positions_recruiting, contact_email, contact_phone, photo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile(data as ScoutProfile);
      setLoading(false);
    })();
  }, [user]);

  const completionInfo = useMemo(() => {
    if (!profile) return { filled: 0, total: REQUIRED_FIELDS.length, missing: REQUIRED_FIELDS.map(f => f.label) };
    const missing: string[] = [];
    REQUIRED_FIELDS.forEach(f => {
      const val = profile[f.key];
      if (!val || (typeof val === "string" && !val.trim())) missing.push(f.label);
    });
    return { filled: REQUIRED_FIELDS.length - missing.length, total: REQUIRED_FIELDS.length, missing };
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    if (completionInfo.missing.length > 0) {
      toast.error(`Please fill in: ${completionInfo.missing.join(", ")}`);
      return;
    }
    setSaving(true);
    const result = await updateScoutProfile(profile.id, {
      full_name: profile.full_name,
      organization_name: profile.organization_name,
      title: profile.title,
      sport: profile.sport,
      division: profile.division,
      location_city: profile.location_city,
      location_state: profile.location_state,
      recruiting_territories: profile.recruiting_territories || [],
      positions_recruiting: profile.positions_recruiting || [],
      contact_email: profile.contact_email,
      contact_phone: profile.contact_phone,
    });
    if (result.error) toast.error("Failed to save");
    else {
      toast.success("Profile saved");
      refreshScout();
    }
    setSaving(false);
  };

  const update = (field: keyof ScoutProfile, value: any) => {
    if (profile) setProfile({ ...profile, [field]: value });
  };

  const toggleArrayItem = (field: "recruiting_territories" | "positions_recruiting", item: string) => {
    if (!profile) return;
    const arr = profile[field] || [];
    const next = arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
    setProfile({ ...profile, [field]: next });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading profile...</p></div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 text-center">
        <User className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
        <h2 className="text-lg font-bold mb-2">Scout Profile Not Found</h2>
        <p className="text-sm text-muted-foreground">Your scout account is being set up. Please sign out and back in.</p>
      </div>
    );
  }

  const isRequired = (key: keyof ScoutProfile) => REQUIRED_FIELDS.some(f => f.key === key);
  const isEmpty = (key: keyof ScoutProfile) => {
    const val = profile[key];
    return !val || (typeof val === "string" && !val.trim());
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-8 space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold">Scout Profile</h1>
          <p className="text-xs text-muted-foreground">Manage your recruiting profile</p>
        </div>
      </div>

      {/* Completion indicator */}
      {completionInfo.missing.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">Complete your profile</span>
              <span className="text-xs text-muted-foreground ml-auto">{completionInfo.filled}/{completionInfo.total}</span>
            </div>
            <Progress value={(completionInfo.filled / completionInfo.total) * 100} className="h-1.5 mb-2" />
            <p className="text-xs text-muted-foreground">Missing: {completionInfo.missing.join(", ")}</p>
          </CardContent>
        </Card>
      )}

      {/* Basic Info */}
      <Card className="section-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">
                Full Name {isRequired("full_name") && <span className="text-destructive">*</span>}
              </Label>
              <Input
                value={profile.full_name}
                onChange={e => update("full_name", e.target.value)}
                className={isEmpty("full_name") && isRequired("full_name") ? "border-destructive/50" : ""}
              />
            </div>
            <div>
              <Label className="text-xs">
                Title {isRequired("title") && <span className="text-destructive">*</span>}
              </Label>
              <Select value={profile.title || ""} onValueChange={v => update("title", v)}>
                <SelectTrigger className={isEmpty("title") && isRequired("title") ? "border-destructive/50" : ""}>
                  <SelectValue placeholder="Select your title" />
                </SelectTrigger>
                <SelectContent>
                  {TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">
                School / Organization {isRequired("organization_name") && <span className="text-destructive">*</span>}
              </Label>
              <Input
                value={profile.organization_name}
                onChange={e => update("organization_name", e.target.value)}
                className={isEmpty("organization_name") && isRequired("organization_name") ? "border-destructive/50" : ""}
              />
            </div>
            <div>
              <Label className="text-xs">
                Division {isRequired("division") && <span className="text-destructive">*</span>}
              </Label>
              <Select value={profile.division || ""} onValueChange={v => update("division", v)}>
                <SelectTrigger className={isEmpty("division") && isRequired("division") ? "border-destructive/50" : ""}>
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sport</Label>
              <Input value={profile.sport} onChange={e => update("sport", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">State</Label>
              <Select value={profile.location_state || ""} onValueChange={v => update("location_state", v)}>
                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">City</Label>
            <Input placeholder="City" value={profile.location_city || ""} onChange={e => update("location_city", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="section-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={profile.contact_email || ""} onChange={e => update("contact_email", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input type="tel" value={profile.contact_phone || ""} onChange={e => update("contact_phone", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recruiting Preferences */}
      <Card className="section-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recruiting Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs mb-2 block">Positions Recruiting</Label>
            <div className="flex flex-wrap gap-1.5">
              {POSITIONS.map(pos => (
                <Badge
                  key={pos}
                  variant={(profile.positions_recruiting || []).includes(pos) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleArrayItem("positions_recruiting", pos)}
                >
                  {pos}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">Recruiting Territories</Label>
            <div className="flex flex-wrap gap-1">
              {US_STATES.map(st => (
                <Badge
                  key={st}
                  variant={(profile.recruiting_territories || []).includes(st) ? "default" : "outline"}
                  className="cursor-pointer text-[10px] px-1.5 py-0"
                  onClick={() => toggleArrayItem("recruiting_territories", st)}
                >
                  {st}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving..." : "Save Profile"}
      </Button>
    </div>
  );
}
