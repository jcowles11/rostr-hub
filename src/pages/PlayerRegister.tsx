import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

export default function PlayerRegister() {
  const { code } = useParams<{ code: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    grade: "",
    positions: "",
    jersey_number_preference: "",
    travel_ball_experience: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    medical_notes: "",
  });

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

    const { error } = await supabase.from("players").insert({
      program_id: program.id,
      first_name: form.first_name,
      last_name: form.last_name,
      grade: form.grade ? parseInt(form.grade) : null,
      positions: form.positions ? form.positions.split(",").map((s) => s.trim()) : [],
      jersey_number_preference: form.jersey_number_preference ? parseInt(form.jersey_number_preference) : null,
      travel_ball_experience: form.travel_ball_experience || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      medical_notes: form.medical_notes || null,
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
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl gradient-primary text-4xl shadow-glow">
            ⚾
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tryout Registration</h1>
          <p className="mt-1 text-muted-foreground">Fill out your information for tryouts</p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Positions (comma separated)</Label>
                <Input value={form.positions} onChange={(e) => setForm({ ...form, positions: e.target.value })} placeholder="SS, OF, P" className="tap-target h-12 rounded-xl" />
              </div>
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
