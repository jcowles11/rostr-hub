import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, User } from "lucide-react";
import type { PlayerResult } from "@/pages/ScoutDashboard";

interface Props {
  results: PlayerResult[];
  loading: boolean;
  searched: boolean;
}

export default function PlayerSearchResults({ results, loading, searched }: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground/40 animate-pulse mb-3" />
          <p className="text-sm text-muted-foreground">Searching players...</p>
        </div>
      </div>
    );
  }

  if (!searched) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-bold mb-1">Search for Players</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Use the filters to find public player profiles by position, metrics, graduation year, and more.
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-bold mb-1">No Players Found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your filters to broaden the search.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground font-medium">{results.length} player{results.length !== 1 ? "s" : ""} found</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((player) => (
          <Card
            key={player.id}
            className="section-card cursor-pointer transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-[1px]"
            onClick={() => player.profile_slug && navigate(`/p/${player.profile_slug}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 rounded-xl border">
                  <AvatarImage src={player.photo_url || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-xl bg-muted text-xs font-bold">
                    {player.first_name[0]}{player.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate">{player.first_name} {player.last_name}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {player.school_name} • {player.program_name}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {player.graduation_year && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{player.graduation_year}</Badge>
                    )}
                    {player.positions?.slice(0, 3).map((pos) => (
                      <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0">{pos}</Badge>
                    ))}
                    {player.bats && (
                      <span className="text-[10px] text-muted-foreground">B: {player.bats}</span>
                    )}
                    {player.throws && (
                      <span className="text-[10px] text-muted-foreground">T: {player.throws}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Top metrics */}
              {player.metrics.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  {player.metrics.slice(0, 4).map((m, i) => (
                    <div key={i} className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{m.name}</p>
                      <p className="text-sm font-bold leading-none">
                        {Number(m.value).toFixed(1)}
                        {m.unit && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{m.unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
