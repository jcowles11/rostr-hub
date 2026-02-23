import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, User } from "lucide-react";
import { toast } from "sonner";

interface PlayerInfo {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  program_name: string;
}

interface EvaluatorSubmitFormProps {
  player: PlayerInfo;
  evaluatorId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function EvaluatorSubmitForm({ player, evaluatorId, onClose, onSubmitted }: EvaluatorSubmitFormProps) {
  const [metricName, setMetricName] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [metricUnit, setMetricUnit] = useState("MPH");
  const [metricType, setMetricType] = useState("measured");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("evaluator_entries").insert({
      evaluator_id: evaluatorId,
      player_id: player.id,
      metric_name: metricName,
      metric_value: parseFloat(metricValue),
      metric_unit: metricUnit,
      metric_type: metricType,
      event_name: eventName || null,
      event_date: eventDate || null,
      notes: notes || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      onSubmitted();
    }
    setLoading(false);
  };

  return (
    <Card className="section-card border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Plus className="h-5 w-5" /> Submit Evaluation
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {player.photo_url ? (
            <img src={player.photo_url} className="h-8 w-8 rounded-full object-cover" alt="" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <span className="font-semibold text-sm">{player.first_name} {player.last_name}</span>
            <p className="text-xs text-muted-foreground">{player.program_name}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Metric Name</Label>
              <Input value={metricName} onChange={(e) => setMetricName(e.target.value)} placeholder="Fastball Velocity" required className="h-10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Value</Label>
              <Input type="number" step="any" value={metricValue} onChange={(e) => setMetricValue(e.target.value)} placeholder="91" required className="h-10 rounded-xl text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Unit</Label>
              <Input value={metricUnit} onChange={(e) => setMetricUnit(e.target.value)} placeholder="MPH" className="h-10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Type</Label>
              <Select value={metricType} onValueChange={setMetricType}>
                <SelectTrigger className="h-10 rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="measured">Measured</SelectItem>
                  <SelectItem value="timed">Timed</SelectItem>
                  <SelectItem value="rated">Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Event Name <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Summer Showcase" className="h-10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Date <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-10 rounded-xl text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context..." className="rounded-xl text-sm resize-none" rows={2} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl gradient-primary border-0 shadow-glow font-bold">
            {loading ? "Submitting..." : "Submit Evaluation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
