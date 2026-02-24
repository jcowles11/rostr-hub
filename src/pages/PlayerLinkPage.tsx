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
import { LogOut, ChevronDown, ChevronUp, X, Search, CheckCircle, Loader2 } from "lucide-react";
import { getSportPositions, sportHasBatsThrows } from "@/lib/sports";
import PlayerPhotoUpload from "@/components/PlayerPhotoUpload";

interface ProgramResult {
  id: string;
  name: string;
  school_name: string;
  sport: string;
  logo_url: string | null;
}

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
      const parsed = JSON.parse(stored);
      const nameParts = (parsed.full_name || "").split(" ");
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");

      // If player signed up via "Find my school", auto-create join request
      if (parsed.join_method === "request" && parsed.program_id) {
        setRegCode(""); // Don't pre-fill code
        const createJoinRequest = async () => {
          const { error } = await supabase.from("program_join_requests").insert({
            program_id: parsed.program_id,
            user_id: user.id,
            player_name: parsed.full_name || "Player",
          } as any);
          if (!error) {
            toast.success(`Access request sent to ${parsed.requested_program_name || "the program"}! The coach will review it.`);
          }
          // Clear the flag so it doesn't re-run
          const updated = { ...parsed, join_method: "request_sent" };
          localStorage.setItem(`rostr_player_reg_${user.id}`, JSON.stringify(updated));
        };
        createJoinRequest();
      }

      // If reg code method, pre-fill it
      if (parsed.join_method === "code" && parsed.program_id) {
        // They had a valid code at signup — we can auto-link or let them confirm
      }
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

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or find your school</span>
                </div>
              </div>

              <ProgramSearch
                userName={`${firstName} ${lastName}`.trim()}
                userId={user?.id}
              />
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

function ProgramSearch({ userName, userId }: { userName: string; userId?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProgramResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Load existing pending requests
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("program_join_requests")
      .select("program_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .then(({ data }) => {
        if (data) setRequestedIds(new Set(data.map((r: any) => r.program_id)));
      });
  }, [userId]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("programs")
        .select("id, name, school_name, sport, logo_url")
        .or(`school_name.ilike.%${query.trim()}%,name.ilike.%${query.trim()}%`)
        .limit(10);
      setResults(data || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleRequest = async (program: ProgramResult) => {
    if (!userId || !userName.trim()) {
      toast.error("Please enter your name above first");
      return;
    }
    setSubmitting(program.id);
    const { error } = await supabase.from("program_join_requests").insert({
      program_id: program.id,
      user_id: userId,
      player_name: userName,
    } as any);

    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        toast.info("You've already requested to join this program");
      } else {
        toast.error("Failed to send request");
      }
    } else {
      toast.success(`Request sent to ${program.name}!`);
      setRequestedIds((prev) => new Set([...prev, program.id]));
    }
    setSubmitting(null);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by school or team name..."
          className="tap-target h-12 text-base rounded-xl pl-10"
        />
      </div>

      {searching && (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {results.map((program) => {
            const alreadyRequested = requestedIds.has(program.id);
            return (
              <div
                key={program.id}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5 bg-muted/30"
              >
                {program.logo_url ? (
                  <img src={program.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {program.school_name?.[0] || "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{program.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{program.school_name} · {program.sport}</p>
                </div>
                {alreadyRequested ? (
                  <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                    <CheckCircle className="h-3 w-3" /> Requested
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs rounded-lg shrink-0 h-8"
                    disabled={submitting === program.id}
                    onClick={() => handleRequest(program)}
                  >
                    {submitting === program.id ? "..." : "Request Access"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="text-xs text-center text-muted-foreground py-2">No programs found matching "{query}"</p>
      )}
    </div>
  );
}