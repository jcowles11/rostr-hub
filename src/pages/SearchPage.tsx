import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchPlayer {
  id: string;
  first_name: string;
  last_name: string;
  positions: string[] | null;
  photo_url: string | null;
  profile_slug: string | null;
  graduation_year: number | null;
  school_name: string;
  high_school: string | null;
  recruiting_status: string;
  committed_school_name: string | null;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    // Use authenticated search that finds all active players (not just public profiles)
    const { data, error } = await supabase.rpc("search_players_authenticated", {
      _name_search: q.trim(),
      _limit: 30,
    });
    if (error) {
      // Fallback to public search if the new function isn't available
      const { data: fallback } = await supabase.rpc("search_public_players", {
        _name_search: q.trim(),
        _limit: 30,
      });
      setResults((fallback as unknown as SearchPlayer[]) || []);
    } else {
      setResults((data as unknown as SearchPlayer[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 350);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-8">
      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          placeholder="Search players by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 rounded-2xl bg-card border text-base"
          autoFocus
        />
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="py-16 text-center">
          <User className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No players found</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-1">
          {results.map((p) => (
              <button
              key={p.id}
              onClick={() => {
                if (p.profile_slug) navigate(`/p/${p.profile_slug}`);
              }}
              className="flex items-center gap-3 w-full rounded-xl p-3 text-left transition-all hover:bg-muted/60 active:scale-[0.99]"
            >
              <Avatar className="h-12 w-12 rounded-xl border shrink-0">
                <AvatarImage src={p.photo_url || undefined} className="object-cover" />
                <AvatarFallback className="rounded-xl bg-muted text-sm font-bold">
                  {p.first_name[0]}{p.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm block truncate">{p.first_name} {p.last_name}</span>
                <p className="text-xs text-muted-foreground truncate">
                  {p.school_name || p.high_school || ""}
                  {p.graduation_year && ` • Class of ${p.graduation_year}`}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.positions?.slice(0, 3).map((pos) => (
                    <Badge key={pos} variant="secondary" className="text-[9px] px-1.5 py-0">{pos}</Badge>
                  ))}
                  {p.recruiting_status === "committed" && (
                    <Badge className="bg-accent/15 text-accent border-0 text-[9px] px-1.5 py-0">Committed</Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">Search for players by name</p>
        </div>
      )}
    </div>
  );
}
