import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

    // Look up program by registration code
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

    // Use edge function or service role to insert — for now, we'll need an RLS bypass
    // Workaround: insert using anon with a special policy
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
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-accent" />
            <h2 className="text-2xl font-bold mb-2">You're Registered!</h2>
            <p className="text-muted-foreground">Your information has been submitted to the coaching staff. Good luck at tryouts! ⚾</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-3xl text-primary-foreground">⚾</div>
          <CardTitle className="text-2xl font-bold">Tryout Registration</CardTitle>
          <CardDescription>Fill out your information for tryouts</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="tap-target" />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required className="tap-target" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input type="number" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="9-12" className="tap-target" />
              </div>
              <div className="space-y-2">
                <Label>Jersey # Preference</Label>
                <Input type="number" value={form.jersey_number_preference} onChange={(e) => setForm({ ...form, jersey_number_preference: e.target.value })} className="tap-target" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Positions (comma separated)</Label>
              <Input value={form.positions} onChange={(e) => setForm({ ...form, positions: e.target.value })} placeholder="SS, OF, P" className="tap-target" />
            </div>
            <div className="space-y-2">
              <Label>Travel Ball Experience</Label>
              <Input value={form.travel_ball_experience} onChange={(e) => setForm({ ...form, travel_ball_experience: e.target.value })} placeholder="Team name, years" className="tap-target" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Emergency Contact</Label>
                <Input value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="Name" className="tap-target" />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input type="tel" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="(555) 123-4567" className="tap-target" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Medical Notes</Label>
              <Textarea value={form.medical_notes} onChange={(e) => setForm({ ...form, medical_notes: e.target.value })} placeholder="Allergies, injuries, etc." className="tap-target" />
            </div>
            <Button type="submit" className="w-full tap-target text-base font-semibold" disabled={loading}>
              {loading ? "Submitting..." : "Register for Tryouts"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
