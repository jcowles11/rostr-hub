import { useEffect, useState } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LogOut, Search, Plus, CheckCircle, ClipboardList, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import EvaluatorSubmitForm from "@/components/EvaluatorSubmitForm";

interface PlayerResult {
  id: string;
  first_name: string;
  last_name: string;
  positions: string[] | null;
  profile_slug: string | null;
  photo_url: string | null;
  program_name: string;
}

interface EvalEntry {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  event_name: string | null;
  event_date: string | null;
  created_at: string;
  player_first: string;
  player_last: string;
}

export default function EvaluatorDashboard() {
  const { user, evaluatorInfo, signOut, refreshEvaluator } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [recentEntries, setRecentEntries] = useState<EvalEntry[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupOrg, setSetupOrg] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (!evaluatorInfo && user) {
      // Check localStorage for pending setup
      const stored = localStorage.getItem(`rostr_evaluator_setup_${user.id}`);
      if (stored) {
        try {
          const { full_name, organization_name } = JSON.parse(stored);
          setSetupName(full_name || "");
          setSetupOrg(organization_name || "");
        } catch {}
      }
      setNeedsSetup(true);
    } else {
      setNeedsSetup(false);
    }
  }, [evaluatorInfo, user]);

  useEffect(() => {
    if (!evaluatorInfo) return;
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("evaluator_entries")
        .select("id, metric_name, metric_value, metric_unit, event_name, event_date, created_at, players(first_name, last_name)")
        .eq("evaluator_id", evaluatorInfo.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setRecentEntries(data.map((d: any) => ({
          id: d.id,
          metric_name: d.metric_name,
          metric_value: d.metric_value,
          metric_unit: d.metric_unit,
          event_name: d.event_name,
          event_date: d.event_date,
          created_at: d.created_at,
          player_first: d.players?.first_name || "",
          player_last: d.players?.last_name || "",
        })));
      }
    };
    fetchRecent();
  }, [evaluatorInfo]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSetupLoading(true);

    const { error } = await supabase.from("evaluators").insert({
      user_id: user.id,
      full_name: setupName,
      organization_name: setupOrg,
    });

    if (error) {
      toast.error(error.message);
    } else {
      localStorage.removeItem(`rostr_evaluator_setup_${user.id}`);
      toast.success("Evaluator profile created!");
      await refreshEvaluator();
    }
    setSetupLoading(false);
  };

  const handleSearch = async () => {
    if (search.trim().length < 2) return;
    setSearching(true);
    const terms = search.trim().split(/\s+/);

    let query = supabase
      .from("players")
      .select("id, first_name, last_name, positions, profile_slug, photo_url, programs(name)")
      .eq("profile_public", true)
      .limit(10);

    if (terms.length >= 2) {
      query = query.ilike("first_name", `%${terms[0]}%`).ilike("last_name", `%${terms.slice(1).join(" ")}%`);
    } else {
      query = query.or(`first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[0]}%`);
    }

    const { data } = await query;
    setSearchResults((data || []).map((d: any) => ({
      id: d.id,
      first_name: d.first_name,
      last_name: d.last_name,
      positions: d.positions,
      profile_slug: d.profile_slug,
      photo_url: d.photo_url,
      program_name: d.programs?.name || "",
    })));
    setSearching(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (needsSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="section-card max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-center">Set Up Your Evaluator Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Full Name</Label>
                <Input value={setupName} onChange={(e) => setSetupName(e.target.value)} required placeholder="Coach Mike" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Organization / Business Name</Label>
                <Input value={setupOrg} onChange={(e) => setSetupOrg(e.target.value)} required placeholder="Elite Pitching Academy" className="h-12 rounded-xl" />
              </div>
              <Button type="submit" disabled={setupLoading} className="w-full h-12 rounded-xl gradient-primary border-0 shadow-glow font-bold">
                {setupLoading ? "Creating..." : "Create Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={rostrLogo} alt="Rostr" className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <span className="text-sm font-bold">{evaluatorInfo?.full_name}</span>
              <p className="text-xs text-muted-foreground">{evaluatorInfo?.organization_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4 pb-8 space-y-5 animate-fade-in">
        {/* Search players */}
        <Card className="section-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Search className="h-5 w-5" /> Find a Player
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by name..."
                className="h-11 rounded-xl"
              />
              <Button onClick={handleSearch} disabled={searching} className="h-11 rounded-xl px-5">
                {searching ? "..." : "Search"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayer(p)}
                    className="w-full flex items-center gap-3 rounded-xl bg-muted/40 p-3 hover:bg-muted/60 transition-colors text-left"
                  >
                    {p.photo_url ? (
                      <img src={p.photo_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-sm">{p.first_name} {p.last_name}</span>
                      <p className="text-xs text-muted-foreground">{p.program_name}</p>
                    </div>
                    {p.positions && p.positions.length > 0 && (
                      <div className="ml-auto flex gap-1">
                        {p.positions.slice(0, 2).map((pos) => (
                          <Badge key={pos} variant="secondary" className="text-[10px]">{pos}</Badge>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit form for selected player */}
        {selectedPlayer && evaluatorInfo && (
          <EvaluatorSubmitForm
            player={selectedPlayer}
            evaluatorId={evaluatorInfo.id}
            onClose={() => setSelectedPlayer(null)}
            onSubmitted={() => {
              toast.success("Evaluation submitted!");
              setSelectedPlayer(null);
              // Refresh recent entries
              if (evaluatorInfo) {
                supabase
                  .from("evaluator_entries")
                  .select("id, metric_name, metric_value, metric_unit, event_name, event_date, created_at, players(first_name, last_name)")
                  .eq("evaluator_id", evaluatorInfo.id)
                  .order("created_at", { ascending: false })
                  .limit(20)
                  .then(({ data }) => {
                    if (data) {
                      setRecentEntries(data.map((d: any) => ({
                        id: d.id,
                        metric_name: d.metric_name,
                        metric_value: d.metric_value,
                        metric_unit: d.metric_unit,
                        event_name: d.event_name,
                        event_date: d.event_date,
                        created_at: d.created_at,
                        player_first: d.players?.first_name || "",
                        player_last: d.players?.last_name || "",
                      })));
                    }
                  });
              }
            }}
          />
        )}

        {/* Recent entries */}
        <Card className="section-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Recent Evaluations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No evaluations submitted yet. Search for a player to get started!</p>
            ) : (
              <div className="space-y-2">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                    <div>
                      <span className="font-semibold text-sm">{entry.player_first} {entry.player_last}</span>
                      <p className="text-xs text-muted-foreground">
                        {entry.metric_name} {entry.event_name ? `• ${entry.event_name}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold">{Number(entry.metric_value).toFixed(1)}</span>
                      {entry.metric_unit && <span className="text-xs text-muted-foreground ml-1">{entry.metric_unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
