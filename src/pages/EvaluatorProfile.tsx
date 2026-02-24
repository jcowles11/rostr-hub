import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, User, Building2, ArrowLeft, Calendar, MapPin } from "lucide-react";

interface EvaluatorData {
  id: string;
  full_name: string;
  organization_name: string;
  sport: string;
  title: string | null;
  verified: boolean;
}

interface EntryWithPlayer {
  id: string;
  metric_name: string;
  metric_unit: string;
  metric_type: string;
  metric_value: number;
  event_name: string | null;
  event_date: string | null;
  created_at: string;
  player_first: string;
  player_last: string;
  player_slug: string | null;
  player_photo: string | null;
}

export default function EvaluatorProfile() {
  const { id } = useParams<{ id: string }>();
  const [evaluator, setEvaluator] = useState<EvaluatorData | null>(null);
  const [entries, setEntries] = useState<EntryWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const { data: ev, error } = await supabase
        .from("evaluators")
        .select("id, full_name, organization_name, sport, title, verified")
        .eq("id", id)
        .single();

      if (error || !ev) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setEvaluator(ev);

      const { data: entriesData } = await supabase
        .from("evaluator_entries")
        .select("id, metric_name, metric_unit, metric_type, metric_value, event_name, event_date, created_at, players(first_name, last_name, profile_slug, photo_url, profile_public)")
        .eq("evaluator_id", id)
        .order("created_at", { ascending: false });

      if (entriesData) {
        setEntries(
          entriesData
            .filter((d: any) => d.players?.profile_public)
            .map((d: any) => ({
              id: d.id,
              metric_name: d.metric_name,
              metric_unit: d.metric_unit,
              metric_type: d.metric_type,
              metric_value: d.metric_value,
              event_name: d.event_name,
              event_date: d.event_date,
              created_at: d.created_at,
              player_first: d.players?.first_name || "",
              player_last: d.players?.last_name || "",
              player_slug: d.players?.profile_slug || null,
              player_photo: d.players?.photo_url || null,
            }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !evaluator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="section-card max-w-md w-full">
          <CardContent className="py-16 text-center">
            <User className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h1 className="text-xl font-bold mb-2">Evaluator Not Found</h1>
            <p className="text-sm text-muted-foreground">This evaluator profile doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group entries by player
  const playerMap = new Map<string, { name: string; slug: string | null; photo: string | null; entries: EntryWithPlayer[] }>();
  entries.forEach((e) => {
    const key = `${e.player_first} ${e.player_last}`;
    if (!playerMap.has(key)) {
      playerMap.set(key, { name: key, slug: e.player_slug, photo: e.player_photo, entries: [] });
    }
    playerMap.get(key)!.entries.push(e);
  });

  const uniqueEvents = new Set(entries.filter((e) => e.event_name).map((e) => e.event_name));
  const uniquePlayers = playerMap.size;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="page-hero">
        <div className="mx-auto max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white mb-3 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 border-2 border-white/30">
              <Award className="h-9 w-9 text-white/80" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white">{evaluator.full_name}</h1>
                {evaluator.verified && (
                  <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">
                    <Award className="h-2.5 w-2.5 mr-0.5" /> Verified
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Building2 className="h-3.5 w-3.5 text-white/60" />
                <span className="text-sm font-medium text-white/80">{evaluator.organization_name}</span>
              </div>
              {evaluator.title && (
                <p className="text-xs text-white/60 mt-1">{evaluator.title}</p>
              )}
              <p className="text-xs text-white/50 mt-1 capitalize">{evaluator.sport}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-12 -mt-4 space-y-5 animate-fade-in">
        {/* Stats */}
        <Card className="section-card">
          <CardContent className="py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-extrabold">{entries.length}</p>
                <p className="text-xs text-muted-foreground">Evaluations</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold">{uniquePlayers}</p>
                <p className="text-xs text-muted-foreground">Players</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold">{uniqueEvents.size}</p>
                <p className="text-xs text-muted-foreground">Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evaluations grouped by player */}
        {[...playerMap.entries()].map(([playerName, group]) => (
          <Card key={playerName} className="section-card">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                {group.photo ? (
                  <img src={group.photo} className="h-9 w-9 rounded-full object-cover" alt="" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div>
                  {group.slug ? (
                    <Link to={`/p/${group.slug}`} className="font-bold text-sm hover:text-primary transition-colors">
                      {playerName}
                    </Link>
                  ) : (
                    <span className="font-bold text-sm">{playerName}</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {group.entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">{entry.metric_name}</span>
                        {entry.metric_unit && <span className="text-xs text-muted-foreground ml-1">({entry.metric_unit})</span>}
                      </div>
                      <span className="text-lg font-extrabold">{Number(entry.metric_value).toFixed(1)}</span>
                    </div>
                    {(entry.event_name || entry.event_date) && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {entry.event_name}{entry.event_date ? ` • ${new Date(entry.event_date).toLocaleDateString()}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {entries.length === 0 && (
          <Card className="section-card">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No public evaluations yet.</p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Powered by <span className="font-semibold">Rostr</span>
        </p>
      </div>
    </div>
  );
}
