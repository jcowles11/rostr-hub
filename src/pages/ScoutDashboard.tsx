import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search } from "lucide-react";
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
  recruiting_status?: string;
  committed_school_name?: string | null;
  committed_school_logo_url?: string | null;
  city?: string | null;
  state?: string | null;
  metrics: { name: string; value: number; unit: string }[];
}

export default function ScoutDashboard() {
  const { scoutInfo } = useAuth();
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (searchFilters: SearchFilters) => {
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
      _recruiting_status: searchFilters.recruitingStatus || null,
      _state: searchFilters.state || null,
      _gpa_min: searchFilters.gpaMin || null,
      _limit: 50,
      _offset: 0,
    });

    if (error) {
      console.error("Search error:", error);
      setResults([]);
    } else {
      let players = (data as unknown as PlayerResult[]) || [];

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

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-8">
      <div className="page-hero mb-6">
        <div className="flex items-center gap-3">
          <Search className="h-8 w-8 text-white/80" />
          <div>
            <h2 className="text-xl font-extrabold text-white">Player Discovery</h2>
            <p className="text-sm text-white/70">
              {scoutInfo ? `${scoutInfo.organization_name} • ` : ""}Search public player profiles by position, metrics, and more
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <PlayerSearchFilters onSearch={handleSearch} loading={loading} isScout={true} />
        <PlayerSearchResults results={results} loading={loading} searched={searched} />
      </div>
    </div>
  );
}
