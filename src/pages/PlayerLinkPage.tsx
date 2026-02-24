import { useState, useEffect } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LogOut, ChevronDown, ChevronUp, X } from "lucide-react";
import { getSportPositions, sportHasBatsThrows } from "@/lib/sports";
import PlayerPhotoUpload from "@/components/PlayerPhotoUpload";

const GRADUATION_YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + i);

export default function PlayerLinkPage() {
  const { user, signOut, refreshPlayer } = useAuth();
  const navigate = useNavigate();
  const [regCode, setRegCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  // Additional profile fields
  const [details, setDetails] = useState({
    grade: "",
    graduation_year: "",
    height: "",
    weight: "",
    high_school: "",
    city: "",
    state: "",
    bats: "",
    throws: "",
    gpa: "",
    email: "",
    phone: "",
  });

  // Sport (fetched when reg code entered)
  const [sport, setSport] = useState("baseball");

  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`rostr_player_reg_${user.id}`);
    if (stored) {
      const { full_name } = JSON.parse(stored);
      const parts = full_name.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    } else {
      const meta = user.user_metadata;
      if (meta?.full_name) {
        const parts = meta.full_name.split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }
    }
  }, [user]);

  // Fetch sport when reg code changes (debounced)
  useEffect(() => {
    if (regCode.trim().length < 3) return;
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("programs")
        .select("sport")
        .eq("registration_code", regCode.trim().toLowerCase())
        .maybeSingle();
      if (data?.sport) setSport(data.sport);
    }, 500);
    return () => clearTimeout(timeout);
  }, [regCode]);

  const positions = getSportPositions(sport);
  const showBatsThrows = sportHasBatsThrows(sport);

  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const buildPlayerFields = () => ({
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    photo_url: photoUrl,
    positions: selectedPositions.length > 0 ? selectedPositions : [],
    grade: details.grade ? parseInt(details.grade) : null,
    graduation_year: details.graduation_year ? parseInt(details.graduation_year) : null,
    height: details.height || null,
    weight: details.weight ? parseInt(details.weight) : null,
    high_school: details.high_school || null,
    city: details.city || null,
    state: details.state || null,
    bats: details.bats || null,
    throws: details.throws || null,
    gpa: details.gpa || null,
    email: details.email || user?.email || null,
    phone: details.phone || null,
  });

  const handleSkip = async () => {
    if (!user || !firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name");
      return;
    }
    setSkipping(true);
    const { error } = await supabase.from("players").insert({
      ...buildPlayerFields(),
      user_id: user.id,
      program_id: null,
    } as any);

    if (error) {
      toast.error("Failed to create profile");
      setSkipping(false);
      return;
    }

    localStorage.removeItem(`rostr_player_reg_${user.id}`);
    await refreshPlayer();
    toast.success("Profile created!");
    navigate("/social");
    setSkipping(false);
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("registration_code", regCode.trim().toLowerCase())
      .maybeSingle();

    if (!program) {
      toast.error("Invalid registration code");
      setLoading(false);
      return;
    }

    const { data: existingPlayer } = await supabase
      .from("players")
      .select("id, user_id")
      .eq("program_id", program.id)
      .ilike("first_name", firstName.trim())
      .ilike("last_name", lastName.trim())
      .is("user_id", null)
      .limit(1)
      .maybeSingle();

    if (existingPlayer) {
      const { error } = await supabase
        .from("players")
        .update({ user_id: user.id, ...buildPlayerFields() })
        .eq("id", existingPlayer.id);
      if (error) {
        toast.error("Failed to link account");
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.from("players").insert({
        program_id: program.id,
        user_id: user.id,
        ...buildPlayerFields(),
      });
      if (error) {
        toast.error("Failed to create player profile");
        setLoading(false);
        return;
      }
    }

    localStorage.removeItem(`rostr_player_reg_${user.id}`);
    await refreshPlayer();
    toast.success("Account linked!");
    navigate("/player-dashboard");
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8 animate-slide-up">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow object-cover" />
          <h1 className="text-3xl font-extrabold tracking-tight">Set Up Your Profile</h1>
          <p className="mt-1 text-muted-foreground">Connect to your team or create a standalone profile</p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Photo */}
              <div className="flex flex-col items-center gap-2">
                <PlayerPhotoUpload currentUrl={photoUrl} onUploaded={setPhotoUrl} size="lg" />
                <span className="text-xs text-muted-foreground font-medium">Tap to add photo</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">First Name</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="tap-target h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Last Name</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="tap-target h-12 rounded-xl"
                  />
                </div>
              </div>

              {/* Expandable details */}
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-1"
              >
                {showDetails ? "Hide" : "Add"} profile details (optional)
                {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showDetails && (
                <div className="space-y-4 animate-fade-in border-t pt-4">
                  {/* Position selector */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Position(s)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {positions.map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => togglePosition(pos)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border ${
                            selectedPositions.includes(pos)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                    {selectedPositions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPositions.map((pos) => (
                          <Badge key={pos} variant="secondary" className="text-xs gap-1">
                            {pos}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => togglePosition(pos)} />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Grade</Label>
                      <Select value={details.grade} onValueChange={(v) => setDetails({ ...details, grade: v })}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {[9, 10, 11, 12].map((g) => (
                            <SelectItem key={g} value={String(g)}>{g}th</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Grad Year</Label>
                      <Select value={details.graduation_year} onValueChange={(v) => setDetails({ ...details, graduation_year: v })}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {GRADUATION_YEARS.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">High School</Label>
                    <Input
                      value={details.high_school}
                      onChange={(e) => setDetails({ ...details, high_school: e.target.value })}
                      placeholder="e.g. Heritage High School"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Height</Label>
                      <Input
                        value={details.height}
                        onChange={(e) => setDetails({ ...details, height: e.target.value })}
                        placeholder={`5'10"`}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Weight (lbs)</Label>
                      <Input
                        type="number"
                        value={details.weight}
                        onChange={(e) => setDetails({ ...details, weight: e.target.value })}
                        placeholder="175"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  {showBatsThrows && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Bats</Label>
                        <Select value={details.bats} onValueChange={(v) => setDetails({ ...details, bats: v })}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="R">Right (R)</SelectItem>
                            <SelectItem value="L">Left (L)</SelectItem>
                            <SelectItem value="S">Switch (S)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Throws</Label>
                        <Select value={details.throws} onValueChange={(v) => setDetails({ ...details, throws: v })}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="R">Right (R)</SelectItem>
                            <SelectItem value="L">Left (L)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">City</Label>
                      <Input
                        value={details.city}
                        onChange={(e) => setDetails({ ...details, city: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">State</Label>
                      <Input
                        value={details.state}
                        onChange={(e) => setDetails({ ...details, state: e.target.value })}
                        placeholder="CO"
                        maxLength={2}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">GPA</Label>
                    <Input
                      value={details.gpa}
                      onChange={(e) => setDetails({ ...details, gpa: e.target.value })}
                      placeholder="3.5"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Email</Label>
                      <Input
                        type="email"
                        value={details.email}
                        onChange={(e) => setDetails({ ...details, email: e.target.value })}
                        placeholder={user?.email || ""}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Phone</Label>
                      <Input
                        type="tel"
                        value={details.phone}
                        onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Skip / standalone path */}
              <Button
                onClick={handleSkip}
                disabled={skipping || !firstName.trim() || !lastName.trim()}
                className="w-full tap-target h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-glow"
              >
                {skipping ? "Creating..." : "Create My Profile"}
              </Button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or connect to a team</span>
                </div>
              </div>

              <form onSubmit={handleLink} className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Registration Code</Label>
                  <Input
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value)}
                    placeholder="Enter code from your coach"
                    required
                    className="tap-target h-12 text-base rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the same name you registered with so we can match your tryout data.
                  </p>
                </div>
                <Button type="submit" variant="outline" className="w-full tap-target h-12 text-base font-semibold rounded-xl" disabled={loading}>
                  {loading ? "Linking..." : "Link to Team"}
                </Button>
              </form>
            </div>
            <div className="mt-4 text-center">
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}