import { useState, useEffect } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PlayerSearchFilters, { type SearchFilters } from "@/components/PlayerSearchFilters";
import PlayerSearchResults from "@/components/PlayerSearchResults";

export interface PlayerResult {
  id: string;
  first_name: string;
  last_name: string;
  positions: string[] | null;
  photo_url: string | null;
  profile_slug: string | null;
  graduation_year: number | null;
  height: string | null;
  weight: number | null;
  bats: string | null;
  throws: string | null;
  school_name: string;
  program_name: string;
  sport: string;
  program_logo: string | null;
  metrics: { name: string; value: number; unit: string }[];
}

export default function ScoutDashboard() {
  const { scoutInfo, signOut } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const handleSearch = async (searchFilters: SearchFilters) => {
    setFilters(searchFilters);
    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase.rpc("search_public_players", {
      _sport: searchFilters.sport || null,
      _positions: searchFilters.positions?.length ? searchFilters.positions : null,
      _grad_year_min: searchFilters.gradYearMin || null,
      _grad_year_max: searchFilters.gradYearMax || null,
      _bats: searchFilters.bats || null,
      _throws: searchFilters.throws || null,
      _name_search: searchFilters.nameSearch || null,
      _limit: 50,
      _offset: 0,
    });

    if (error) {
      console.error("Search error:", error);
      setResults([]);
    } else {
      let players = (data as unknown as PlayerResult[]) || [];

      // Client-side metric filtering
      if (searchFilters.metricFilters?.length) {
        players = players.filter((p) =>
          searchFilters.metricFilters!.every((mf) => {
            const metric = p.metrics.find(
              (m) => m.name.toLowerCase() === mf.metricName.toLowerCase()
            );
            if (!metric) return false;
            if (mf.min !== undefined && metric.value < mf.min) return false;
            if (mf.max !== undefined && metric.value > mf.max) return false;
            return true;
          })
        );
      }

      setResults(players);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={rostrLogo} alt="Rostr" className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <h1 className="text-sm font-bold">Player Discovery</h1>
              {scoutInfo && (
                <p className="text-xs text-muted-foreground">{scoutInfo.organization_name}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-8">
        <div className="page-hero mb-6">
          <div className="flex items-center gap-3">
            <Search className="h-8 w-8 text-white/80" />
            <div>
              <h2 className="text-xl font-extrabold text-white">Find Players</h2>
              <p className="text-sm text-white/70">Search public player profiles by position, metrics, and more</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <PlayerSearchFilters onSearch={handleSearch} loading={loading} />
          <PlayerSearchResults results={results} loading={loading} searched={searched} />
        </div>
      </div>
    </div>
  );
}
