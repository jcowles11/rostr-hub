import { useState, useEffect } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { registerPlayerForTryouts } from "@/services/playerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, X } from "lucide-react";
import PlayerPhotoUpload from "@/components/PlayerPhotoUpload";
import { getSportPositions, sportHasBatsThrows } from "@/lib/sports";

export default function PlayerRegister() {
  const { code } = useParams<{ code: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [sport, setSport] = useState("baseball");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    grade: "",
    jersey_number_preference: "",
    travel_ball_experience: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    medical_notes: "",
    bats: "",
    throws: "",
  });

  useEffect(() => {
    const fetchSport = async () => {
      if (!code) return;
      const { data } = await supabase
        .from("programs")
        .select("sport")
        .eq("registration_code", code)
        .single();
      if (data?.sport) setSport(data.sport);
    };
    fetchSport();
  }, [code]);

  const positions = getSportPositions(sport);
  const showBatsThrows = sportHasBatsThrows(sport);

  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("registration_code", code)
      .single();

    if (!program) {
      toast.error("Invalid registration link");
      setLoading(false);
      return;
    }

    const { error } = await registerPlayerForTryouts({
      program_id: program.id,
      first_name: form.first_name,
      last_name: form.last_name,
      grade: form.grade ? parseInt(form.grade) : null,
      positions: selectedPositions.length > 0 ? selectedPositions : [],
      jersey_number_preference: form.jersey_number_preference ? parseInt(form.jersey_number_preference) : null,
      travel_ball_experience: form.travel_ball_experience || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      medical_notes: form.medical_notes || null,
      photo_url: photoUrl,
      bats: form.bats || null,
      throws: form.throws || null,
    });

    if (error) {
      toast.error("Registration failed. Please try again.");
    } else {
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="auth-bg">
        <Card className="w-full max-w-md text-center shadow-elevated border-0 animate-bounce-in">
          <CardContent className="py-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">You're Registered!</h2>
            <p className="text-muted-foreground">Your information has been submitted to the coaching staff. You'll be assigned a tryout number. Good luck at tryouts! ⚾</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8 animate-slide-up">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow object-cover" />
          <h1 className="text-3xl font-extrabold tracking-tight">Tryout Registration</h1>
          <p className="mt-1 text-muted-foreground">Fill out your information for tryouts</p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Profile Photo */}
              <div className="flex flex-col items-center gap-2">
                <PlayerPhotoUpload
                  currentUrl={photoUrl}
                  onUploaded={setPhotoUrl}
                  size="lg"
                />
                <span className="text-xs text-muted-foreground font-medium">Tap to add photo</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">First Name *</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="tap-target h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Last Name *</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required className="tap-target h-12 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Grade</Label>
                  <Input type="number" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="9-12" className="tap-target h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Jersey # Preference</Label>
                  <Input type="number" value={form.jersey_number_preference} onChange={(e) => setForm({ ...form, jersey_number_preference: e.target.value })} className="tap-target h-12 rounded-xl" />
                </div>
              </div>

              {/* Position multi-select */}
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

              {/* Bats / Throws for baseball */}
              {showBatsThrows && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Bats</Label>
                    <Select value={form.bats} onValueChange={(v) => setForm({ ...form, bats: v })}>
                      <SelectTrigger className="tap-target h-12 rounded-xl">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="R">Right (R)</SelectItem>
                        <SelectItem value="L">Left (L)</SelectItem>
                        <SelectItem value="S">Switch (S)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Throws</Label>
                    <Select value={form.throws} onValueChange={(v) => setForm({ ...form, throws: v })}>
                      <SelectTrigger className="tap-target h-12 rounded-xl">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="R">Right (R)</SelectItem>
                        <SelectItem value="L">Left (L)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Travel Ball Experience</Label>
                <Input value={form.travel_ball_experience} onChange={(e) => setForm({ ...form, travel_ball_experience: e.target.value })} placeholder="Team name, years" className="tap-target h-12 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Emergency Contact</Label>
                  <Input value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="Name" className="tap-target h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Contact Phone</Label>
                  <Input type="tel" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="(555) 123-4567" className="tap-target h-12 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Medical Notes</Label>
                <Textarea value={form.medical_notes} onChange={(e) => setForm({ ...form, medical_notes: e.target.value })} placeholder="Allergies, injuries, etc." className="tap-target rounded-xl" />
              </div>
              <Button type="submit" className="w-full tap-target h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-glow hover:shadow-lg transition-all duration-200" disabled={loading}>
                {loading ? "Submitting..." : "Register for Tryouts"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
