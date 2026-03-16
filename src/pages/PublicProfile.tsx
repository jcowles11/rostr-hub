import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle, MapPin, Ruler, Weight, GraduationCap, Trophy, Youtube,
  Instagram, Twitter, User, Award, Copy, Mail, Phone, ExternalLink,
  Share2, Link2, Heart, Grid3X3, Image, QrCode, TrendingUp, TrendingDown,
  Minus, FileDown, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ProfileQrCode from "@/components/ProfileQrCode";

// ── Types ──────────────────────────────────────────────────────────

interface MetricEntry {
  name: string;
  unit: string;
  metric_type: string;
  aggregation?: string;       // Added by migration 000006
  value: number;
  verified: boolean;
  source_type?: string;
  source_name?: string;
  source_org?: string;
  evaluator_id?: string;
  event_name?: string;
  event_date?: string;
  created_at?: string;
}

interface TrendPoint {
  session_name: string;
  session_date: string;
  value: number;
}

interface TrendEntry {
  metric_name: string;
  metric_unit: string;
  metric_type: string;
  aggregation: string;
  points: TrendPoint[] | null;
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
    bats: string | null;
    throws: string | null;
    social_twitter: string | null;
    social_instagram: string | null;
    highlight_video_url: string | null;
    profile_slug: string;
    recruiting_status: string;
    committed_school_name: string | null;
    committed_school_logo_url: string | null;
    commitment_date: string | null;
    city: string | null;
    state: string | null;
    email: string | null;
    phone: string | null;
    gamechanger_profile_url: string | null;
    maxpreps_profile_url: string | null;
  };
  program: {
    name: string;
    school_name: string;
    sport: string;
    logo_url: string | null;
  };
  metrics: MetricEntry[];
  evaluator_metrics: MetricEntry[];
  trend_data?: TrendEntry[];   // Added by migration 000006
}

// ── Aggregation labels ─────────────────────────────────────────────

const AGG_LABELS: Record<string, string> = {
  best: "Best",
  average: "Avg",
  latest: "Latest",
};

// ── Helpers ────────────────────────────────────────────────────────

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied!`);
}

// ── Sparkline (reused from PlayerDevelopment pattern) ──────────────

function ProfileSparkline({
  points,
  direction,
  width = 64,
  height = 24,
}: {
  points: number[];
  direction: "improving" | "regressing" | "stable";
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 2;
  const coords = points.map((v, i) => ({
    x: pad + (i / (points.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }));
  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const color = direction === "improving" ? "#22c55e" : direction === "regressing" ? "#ef4444" : "#94a3b8";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[0].x} cy={coords[0].y} r={2} fill={color} opacity={0.4} />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={2} fill={color} />
    </svg>
  );
}

// ── Trend computation from RPC data ───────────────────────────────

interface ComputedTrend {
  name: string;
  unit: string;
  points: TrendPoint[];
  first: number;
  latest: number;
  delta: number;
  direction: "improving" | "regressing" | "stable";
}

function computePublicTrends(trendData: TrendEntry[]): ComputedTrend[] {
  const results: ComputedTrend[] = [];
  for (const t of trendData) {
    if (!t.points || t.points.length < 2) continue;
    const pts = t.points;
    const first = pts[0].value;
    const latest = pts[pts.length - 1].value;
    const delta = latest - first;
    const threshold = Math.abs(first) * 0.02;
    const lowerIsBetter = t.metric_type === "timed";
    let direction: ComputedTrend["direction"];
    if (Math.abs(delta) <= threshold) {
      direction = "stable";
    } else if (lowerIsBetter) {
      direction = delta < 0 ? "improving" : "regressing";
    } else {
      direction = delta > 0 ? "improving" : "regressing";
    }
    results.push({ name: t.metric_name, unit: t.metric_unit, points: pts, first, latest, delta, direction });
  }
  return results;
}

// ── Program Metrics Section (enhanced) ────────────────────────────

function ProgramMetricsSection({ metrics, programName }: { metrics: MetricEntry[]; programName: string }) {
  if (metrics.length === 0) return null;
  return (
    <Card className="section-card">
      <CardContent className="pt-5 pb-4">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-accent" /> Verified Metrics
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Evaluated by {programName} coaching staff</p>
        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map((m, i) => (
            <div key={i} className="rounded-xl bg-muted/40 p-3.5">
              <div className="flex items-baseline justify-between mb-0.5">
                <p className="text-xs text-muted-foreground truncate">{m.name}</p>
                {m.aggregation && (
                  <span className="text-[9px] text-muted-foreground/60 font-medium ml-1 shrink-0">
                    {AGG_LABELS[m.aggregation] || m.aggregation}
                  </span>
                )}
              </div>
              <p className="text-2xl font-extrabold tabular-nums">
                {Number(m.value).toFixed(1)}
                {m.unit && (
                  <span className="text-xs font-medium text-muted-foreground ml-1">{m.unit}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Development Trends Section ────────────────────────────────────

function DevelopmentSection({ trends }: { trends: ComputedTrend[] }) {
  if (trends.length === 0) return null;
  const improving = trends.filter((t) => t.direction === "improving").length;

  return (
    <Card className="section-card">
      <CardContent className="pt-5 pb-4">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Development
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          {trends.length} metric{trends.length !== 1 ? "s" : ""} tracked across sessions
          {improving > 0 && (
            <span className="text-green-600 font-semibold ml-2">
              {improving} improving
            </span>
          )}
        </p>
        <div className="space-y-2">
          {trends.map((t, i) => {
            const DirIcon = t.direction === "improving" ? TrendingUp : t.direction === "regressing" ? TrendingDown : Minus;
            const dirColor = t.direction === "improving" ? "text-green-600" : t.direction === "regressing" ? "text-red-500" : "text-muted-foreground";
            const sign = t.direction === "stable" ? "" : t.delta > 0 ? "+" : "";

            return (
              <div key={i} className="rounded-xl bg-muted/40 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.points.length} sessions
                  </p>
                </div>
                <ProfileSparkline
                  points={t.points.map((p) => p.value)}
                  direction={t.direction}
                />
                <div className="text-right shrink-0 min-w-[4rem]">
                  <p className="text-sm font-extrabold tabular-nums">
                    {t.latest.toFixed(1)}
                    <span className="text-[10px] font-medium text-muted-foreground ml-0.5">
                      {t.unit}
                    </span>
                  </p>
                  <div className={cn("flex items-center justify-end gap-0.5 text-[10px] font-semibold", dirColor)}>
                    <DirIcon className="h-3 w-3" />
                    <span className="tabular-nums">{sign}{t.delta.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Share & QR Section ────────────────────────────────────────────

function ShareSection({ profileUrl, playerName }: { profileUrl: string; playerName: string }) {
  const [showQr, setShowQr] = useState(false);

  return (
    <Card className="section-card">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Share Profile
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setShowQr(!showQr)}
          >
            <QrCode className="h-3.5 w-3.5 mr-1" />
            {showQr ? "Hide QR" : "Show QR"}
          </Button>
        </div>

        {/* Profile URL */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 mb-3">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{profileUrl}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={() => copyToClipboard(profileUrl, "Profile link")}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* QR Code */}
        {showQr && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <ProfileQrCode url={profileUrl} size={160} />
            <p className="text-[10px] text-muted-foreground text-center">
              Scan to view {playerName}'s profile
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Showcase Metrics Section (unchanged) ──────────────────────────

interface GroupedEval {
  evaluatorName: string;
  organization: string;
  evaluatorId: string | null;
  entries: MetricEntry[];
}

function ShowcaseMetricsSection({ metrics }: { metrics: MetricEntry[] }) {
  if (metrics.length === 0) return null;
  const groups: GroupedEval[] = [];
  const groupMap = new Map<string, GroupedEval>();
  metrics.forEach((m) => {
    const key = `${m.source_name || "Unknown"}|${m.source_org || ""}`;
    if (!groupMap.has(key)) {
      const group: GroupedEval = { evaluatorName: m.source_name || "Evaluator", organization: m.source_org || "", evaluatorId: m.evaluator_id || null, entries: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key)!.entries.push(m);
  });

  return (
    <Card className="section-card">
      <CardContent className="pt-5 pb-4">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Award className="h-5 w-5 text-accent" /> Showcase & Evaluator Data
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Independent verified evaluations</p>
        <div className="space-y-5">
          {groups.map((group, gi) => (
            <div key={gi}>
              <div className="flex items-center gap-2 mb-2.5">
                {group.evaluatorId ? (
                  <Link to={`/evaluator/${group.evaluatorId}`}>
                    <Badge variant="outline" className="text-[10px] gap-1 border-accent/30 text-accent font-medium px-1.5 py-0.5 hover:bg-accent/10 transition-colors cursor-pointer">
                      <Award className="h-2.5 w-2.5" />
                      {group.evaluatorName}{group.organization ? `, ${group.organization}` : ""}
                    </Badge>
                  </Link>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1 border-accent/30 text-accent font-medium px-1.5 py-0.5">
                    <Award className="h-2.5 w-2.5" />
                    {group.evaluatorName}{group.organization ? `, ${group.organization}` : ""}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.entries.map((m, i) => (
                  <div key={i} className="rounded-xl bg-muted/40 p-3.5">
                    <p className="text-xs text-muted-foreground mb-0.5">{m.name} {m.unit && `(${m.unit})`}</p>
                    <p className="text-xl font-extrabold">{Number(m.value).toFixed(1)}</p>
                    {(m.event_name || m.event_date) && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {m.event_name}{m.event_date ? ` • ${new Date(m.event_date).toLocaleDateString()}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────

export default function PublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followPlayerId, setFollowPlayerId] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [playerPosts, setPlayerPosts] = useState<{ id: string; media_urls: string[]; post_type: string }[]>([]);

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

  // Get the player id, follow status, counts, and posts
  useEffect(() => {
    if (!slug) return;
    const getPlayerData = async () => {
      const { data: playerRow } = await supabase
        .from("players")
        .select("id, user_id")
        .eq("profile_slug", slug)
        .eq("profile_public", true)
        .maybeSingle();
      if (!playerRow) return;

      setFollowPlayerId(playerRow.id);

      // Follower count
      const { count: fCount } = await supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("followed_player_id", playerRow.id);
      setFollowerCount(fCount || 0);

      // Following count (if player has a user_id)
      if (playerRow.user_id) {
        const { count: fgCount } = await supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", playerRow.user_id);
        setFollowingCount(fgCount || 0);
      }

      // Posts count + grid
      if (playerRow.user_id) {
        const { data: posts, count: pCount } = await supabase
          .from("posts")
          .select("id, media_urls, post_type", { count: "exact" })
          .eq("author_id", playerRow.user_id)
          .order("created_at", { ascending: false })
          .limit(30);
        setPostCount(pCount || 0);
        setPlayerPosts(posts || []);
      }

      // Check if current user follows
      if (user) {
        const { data: follow } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("followed_player_id", playerRow.id)
          .maybeSingle();
        setIsFollowed(!!follow);
      }
    };
    getPlayerData();
  }, [slug, user]);

  // Compute trends from RPC trend_data (available after migration 000006)
  const trends = useMemo(() => {
    if (!data?.trend_data || data.trend_data.length === 0) return [];
    return computePublicTrends(data.trend_data);
  }, [data?.trend_data]);

  const toggleFollow = async () => {
    if (!user || !followPlayerId) return;
    if (isFollowed) {
      setIsFollowed(false);
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("followed_player_id", followPlayerId);
    } else {
      setIsFollowed(true);
      await supabase.from("follows").insert({ follower_id: user.id, followed_player_id: followPlayerId });
    }
  };

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
  const embedUrl = player.highlight_video_url ? getYouTubeEmbedUrl(player.highlight_video_url) : null;
  const isCommitted = player.recruiting_status === "committed";
  const profileUrl = `${window.location.origin}/p/${player.profile_slug}`;
  const playerName = `${player.first_name} ${player.last_name}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="page-hero">
        <div className="mx-auto max-w-2xl">
          {/* Commitment Banner */}
          {isCommitted && player.committed_school_name && (
            <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2 mb-4 border border-white/10">
              <Trophy className="h-4 w-4 text-white shrink-0" />
              <span className="text-sm font-bold text-white">
                Committed to {player.committed_school_name}
              </span>
              {player.committed_school_logo_url && (
                <img src={player.committed_school_logo_url} alt="" className="h-6 w-6 rounded object-cover ml-auto shrink-0" />
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            {player.photo_url ? (
              <img src={player.photo_url} alt={playerName} className="h-24 w-24 rounded-2xl object-cover border-2 border-white/30 shadow-lg" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 border-2 border-white/30">
                <User className="h-10 w-10 text-white/70" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-extrabold text-white">
                {playerName}
              </h1>
              {program && (
                <div className="flex items-center gap-2 mt-1">
                  {program.logo_url && (
                    <img src={program.logo_url} alt={program.name} className="h-5 w-5 rounded object-cover" />
                  )}
                  <span className="text-sm font-medium text-white/80">{program.school_name} • {program.sport}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {player.positions?.map((p) => (
                  <Badge key={p} variant="secondary" className="bg-white/20 text-white border-0 text-xs">{p}</Badge>
                ))}
                {!isCommitted && (
                  <Badge className="bg-white/10 text-white/70 border-0 text-xs">Uncommitted</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Hero action buttons */}
          <div className="flex gap-2 mt-4">
            {user && followPlayerId && (
              <Button
                size="sm"
                variant="secondary"
                className={cn(
                  "text-xs gap-1",
                  isFollowed
                    ? "bg-white/25 text-white border-0 hover:bg-white/30"
                    : "bg-white/15 text-white border-0 hover:bg-white/25"
                )}
                onClick={toggleFollow}
              >
                <Heart className={cn("h-3.5 w-3.5", isFollowed && "fill-current")} />
                {isFollowed ? "Following" : "Follow"}
              </Button>
            )}
            <Button size="sm" variant="secondary" className="bg-white/15 text-white border-0 hover:bg-white/25 text-xs" onClick={() => copyToClipboard(profileUrl, "Profile link")}>
              <Share2 className="h-3.5 w-3.5 mr-1" /> Share
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-12 -mt-4 space-y-5 animate-fade-in">
        {/* Social stats bar */}
        <Card className="section-card">
          <CardContent className="py-3">
            <div className="grid grid-cols-3 divide-x text-center">
              <div>
                <p className="text-lg font-extrabold">{postCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Posts</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">{followerCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Followers</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">{followingCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Following</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio stats */}
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
            {/* Extra bio row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3 pt-3 border-t">
              {player.bats && <span className="text-xs text-muted-foreground">Bats: <strong>{player.bats}</strong></span>}
              {player.throws && <span className="text-xs text-muted-foreground">Throws: <strong>{player.throws}</strong></span>}
              {(player.city || player.state) && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {[player.city, player.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        {(player.email || player.phone) && (
          <Card className="section-card">
            <CardContent className="py-4">
              <h2 className="text-base font-bold mb-3">Contact</h2>
              <div className="space-y-2">
                {player.email && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{player.email}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyToClipboard(player.email!, "Email")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {player.phone && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{player.phone}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyToClipboard(player.phone!, "Phone")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Program Metrics (enhanced with aggregation labels) */}
        <ProgramMetricsSection metrics={metrics || []} programName={program?.name || "Program"} />

        {/* Development Trends (from migration 000006 trend_data) */}
        {trends.length > 0 && <DevelopmentSection trends={trends} />}

        {/* Showcase & Evaluator Data */}
        <ShowcaseMetricsSection metrics={evaluator_metrics || []} />

        {/* Share & QR Section */}
        <ShareSection profileUrl={profileUrl} playerName={playerName} />

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

        {/* Stats Integrations */}
        {(player.gamechanger_profile_url || player.maxpreps_profile_url) && (
          <Card className="section-card">
            <CardContent className="py-4">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Stats Integrations
              </h2>
              <div className="space-y-2">
                {player.gamechanger_profile_url && (
                  <a href={player.gamechanger_profile_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors">
                    <ExternalLink className="h-4 w-4 text-primary" />
                    <span className="font-medium">GameChanger</span>
                    <Badge className="ml-auto bg-accent/15 text-accent border-0 text-[10px]">Connected</Badge>
                  </a>
                )}
                {player.maxpreps_profile_url && (
                  <a href={player.maxpreps_profile_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors">
                    <ExternalLink className="h-4 w-4 text-primary" />
                    <span className="font-medium">MaxPreps</span>
                    <Badge className="ml-auto bg-accent/15 text-accent border-0 text-[10px]">Connected</Badge>
                  </a>
                )}
              </div>
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

        {/* Posts Grid */}
        {playerPosts.length > 0 && (
          <Card className="section-card">
            <CardContent className="pt-5 pb-4">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Grid3X3 className="h-5 w-5" /> Posts
              </h2>
              <div className="grid grid-cols-3 gap-1">
                {playerPosts.map((post) => (
                  <div key={post.id} className="aspect-square rounded-lg overflow-hidden bg-muted relative">
                    {post.media_urls?.[0] ? (
                      post.media_urls[0].match(/\.(mp4|mov|webm)(\?|$)/i) ? (
                        <video src={post.media_urls[0]} className="w-full h-full object-cover" />
                      ) : (
                        <img src={post.media_urls[0]} alt="" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                    {(post.media_urls?.length || 0) > 1 && (
                      <div className="absolute top-1.5 right-1.5">
                        <Grid3X3 className="h-3.5 w-3.5 text-white drop-shadow" />
                      </div>
                    )}
                  </div>
                ))}
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
