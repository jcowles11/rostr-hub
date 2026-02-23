import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, MapPin, Ruler, Weight, GraduationCap, Trophy, Youtube, Instagram, Twitter, User } from "lucide-react";

interface MetricEntry {
  name: string;
  unit: string;
  metric_type: string;
  value: number;
  verified: boolean;
  source_type?: string;
  source_name?: string;
  source_org?: string;
  event_name?: string;
  event_date?: string;
  created_at?: string;
}

interface PublicProfileData {
  player: {
    first_name: string;
    last_name: string;
    positions: string[] | null;
    photo_url: string | null;
    graduation_year: number | null;
    height: string | null;
    weight: number | null;
    gpa: string | null;
    social_twitter: string | null;
    social_instagram: string | null;
    highlight_video_url: string | null;
    profile_slug: string;
  };
  program: {
    name: string;
    school_name: string;
    sport: string;
    logo_url: string | null;
  };
  metrics: MetricEntry[];
  evaluator_metrics: MetricEntry[];
}

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function SourceBadge({ entry }: { entry: MetricEntry }) {
  if (entry.source_type === "evaluator") {
    const label = entry.source_org
      ? `${entry.source_name}, ${entry.source_org}`
      : entry.source_name || "Evaluator";
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-accent/30 text-accent font-medium px-1.5 py-0">
        <CheckCircle className="h-2.5 w-2.5" /> {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 border-accent/30 text-accent font-medium px-1.5 py-0">
      <CheckCircle className="h-2.5 w-2.5" /> {entry.source_name || "Verified"}
    </Badge>
  );
}

export default function PublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const fetchProfile = async () => {
      const { data: result, error } = await supabase.rpc("get_public_profile", { _slug: slug });
      if (error || !result) {
        setNotFound(true);
      } else {
        setData(result as unknown as PublicProfileData);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="section-card max-w-md w-full">
          <CardContent className="py-16 text-center">
            <User className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h1 className="text-xl font-bold mb-2">Profile Not Found</h1>
            <p className="text-sm text-muted-foreground">This player profile doesn't exist or isn't public yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { player, program, metrics, evaluator_metrics } = data;
  const allMetrics = [...(metrics || []), ...(evaluator_metrics || [])];
  const embedUrl = player.highlight_video_url ? getYouTubeEmbedUrl(player.highlight_video_url) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="page-hero">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-4">
            {player.photo_url ? (
              <img src={player.photo_url} alt={`${player.first_name} ${player.last_name}`} className="h-24 w-24 rounded-full object-cover border-2 border-white/30 shadow-lg" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 border-2 border-white/30">
                <User className="h-10 w-10 text-white/70" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-extrabold text-white">
                {player.first_name} {player.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {program.logo_url && (
                  <img src={program.logo_url} alt={program.name} className="h-5 w-5 rounded object-cover" />
                )}
                <span className="text-sm font-medium text-white/80">{program.name} • {program.sport}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {player.positions?.map((p) => (
                  <Badge key={p} variant="secondary" className="bg-white/20 text-white border-0 text-xs">{p}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-12 -mt-4 space-y-5 animate-fade-in">
        {/* Bio stats */}
        {(player.graduation_year || player.height || player.weight || player.gpa) && (
          <Card className="section-card">
            <CardContent className="py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {player.graduation_year && (
                  <div className="text-center">
                    <GraduationCap className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{player.graduation_year}</p>
                    <p className="text-xs text-muted-foreground">Grad Year</p>
                  </div>
                )}
                {player.height && (
                  <div className="text-center">
                    <Ruler className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{player.height}</p>
                    <p className="text-xs text-muted-foreground">Height</p>
                  </div>
                )}
                {player.weight && (
                  <div className="text-center">
                    <Weight className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{player.weight} lbs</p>
                    <p className="text-xs text-muted-foreground">Weight</p>
                  </div>
                )}
                {player.gpa && (
                  <div className="text-center">
                    <Trophy className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{player.gpa}</p>
                    <p className="text-xs text-muted-foreground">GPA</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verified Metrics */}
        {allMetrics.length > 0 && (
          <Card className="section-card">
            <CardContent className="pt-5 pb-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-accent" />
                Verified Metrics
              </h2>
              <div className="space-y-2.5">
                {allMetrics.map((m, i) => (
                  <div key={i} className="rounded-xl bg-muted/40 p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{m.name}</span>
                        {m.unit && <span className="text-xs text-muted-foreground">({m.unit})</span>}
                        <SourceBadge entry={m} />
                      </div>
                      <span className="text-xl font-extrabold">{Number(m.value).toFixed(1)}</span>
                    </div>
                    {(m.event_name || m.event_date) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {m.event_name}{m.event_date ? ` • ${new Date(m.event_date).toLocaleDateString()}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Highlight Video */}
        {embedUrl && (
          <Card className="section-card">
            <CardContent className="pt-5 pb-4">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Youtube className="h-5 w-5 text-destructive" /> Highlights
              </h2>
              <div className="aspect-video rounded-xl overflow-hidden bg-muted">
                <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Highlight video" />
              </div>
            </CardContent>
          </Card>
        )}
        {player.highlight_video_url && !embedUrl && (
          <Card className="section-card">
            <CardContent className="pt-5 pb-4">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Youtube className="h-5 w-5 text-destructive" /> Highlights
              </h2>
              <a href={player.highlight_video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                Watch highlight video →
              </a>
            </CardContent>
          </Card>
        )}

        {/* Social Links */}
        {(player.social_twitter || player.social_instagram) && (
          <Card className="section-card">
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-4">
                {player.social_twitter && (
                  <a href={`https://twitter.com/${player.social_twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Twitter className="h-4 w-4" /> @{player.social_twitter.replace("@", "")}
                  </a>
                )}
                {player.social_instagram && (
                  <a href={`https://instagram.com/${player.social_instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Instagram className="h-4 w-4" /> @{player.social_instagram.replace("@", "")}
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          Powered by <span className="font-semibold">Rostr</span> • Metrics verified by coaching staff & evaluators
        </p>
      </div>
    </div>
  );
}
