/**
 * PlayerCompare — Side-by-side comparison of 2 (or 3) public player profiles.
 *
 * Route: /compare?players=slug1,slug2
 * Uses get_public_profile RPC for each player — SECURITY DEFINER, public access.
 * Compares: bio stats, verified metrics, development trends (if available).
 * Accessible from scout search results via "Compare" selection mode.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, User, GraduationCap, Ruler, Weight, MapPin,
  TrendingUp, TrendingDown, Minus, CheckCircle, Trophy,
  Award, BarChart3, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types (match PublicProfile.tsx) ──────────────────────────────

interface MetricEntry {
  name: string;
  unit: string;
  metric_type: string;
  aggregation?: string;
  value: number;
  verified: boolean;
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

interface ProfileData {
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
    city: string | null;
    state: string | null;
    profile_slug: string;
    recruiting_status: string;
    committed_school_name: string | null;
    highlight_video_url: string | null;
    high_school?: string | null;
  };
  program: {
    name: string;
    school_name: string;
    sport: string;
    logo_url: string | null;
  } | null;
  metrics: MetricEntry[];
  evaluator_metrics: MetricEntry[];
  trend_data?: TrendEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────

/** Merge all metric names across players for alignment. */
function collectMetricNames(profiles: ProfileData[]): string[] {
  const nameSet = new Map<string, number>(); // name → first appearance index
  let idx = 0;
  for (const p of profiles) {
    for (const m of p.metrics) {
      if (!nameSet.has(m.name)) nameSet.set(m.name, idx++);
    }
  }
  return [...nameSet.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
}

/** Get metric value for a player by name. */
function getMetricValue(profile: ProfileData, metricName: string): MetricEntry | undefined {
  return profile.metrics.find((m) => m.name === metricName);
}

/** Determine which of two values is "better" for a given metric type. */
function isBetter(value: number, otherValue: number, metricType: string): boolean {
  if (metricType === "timed") return value < otherValue;
  return value > otherValue;
}

/** Compute trend direction from trend_data. */
function getTrendDirection(
  profile: ProfileData,
  metricName: string
): { direction: "improving" | "regressing" | "stable"; delta: number } | null {
  if (!profile.trend_data) return null;
  const trend = profile.trend_data.find((t) => t.metric_name === metricName);
  if (!trend?.points || trend.points.length < 2) return null;
  const first = trend.points[0].value;
  const latest = trend.points[trend.points.length - 1].value;
  const delta = latest - first;
  const threshold = Math.abs(first) * 0.02;
  const lowerIsBetter = trend.metric_type === "timed";
  let direction: "improving" | "regressing" | "stable";
  if (Math.abs(delta) <= threshold) direction = "stable";
  else if (lowerIsBetter) direction = delta < 0 ? "improving" : "regressing";
  else direction = delta > 0 ? "improving" : "regressing";
  return { direction, delta };
}

// ── Mini Sparkline ────────────────────────────────────────────────

function MiniSparkline({
  points,
  direction,
}: {
  points: number[];
  direction: "improving" | "regressing" | "stable";
}) {
  if (points.length < 2) return null;
  const w = 48, h = 18, pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((v, i) => ({
    x: pad + (i / (points.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  }));
  const d = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const color = direction === "improving" ? "#22c55e" : direction === "regressing" ? "#ef4444" : "#94a3b8";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 inline-block ml-1">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Direction Icon ────────────────────────────────────────────────

function DirectionBadge({ direction, delta }: { direction: "improving" | "regressing" | "stable"; delta: number }) {
  const Icon = direction === "improving" ? TrendingUp : direction === "regressing" ? TrendingDown : Minus;
  const color = direction === "improving" ? "text-green-600" : direction === "regressing" ? "text-red-500" : "text-muted-foreground";
  const sign = delta > 0 ? "+" : "";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold", color)}>
      <Icon className="h-3 w-3" />
      {direction !== "stable" && <span className="tabular-nums">{sign}{delta.toFixed(1)}</span>}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────

export default function PlayerCompare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slugs = useMemo(() => {
    const raw = searchParams.get("players") || "";
    return raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  }, [searchParams]);

  const [profiles, setProfiles] = useState<(ProfileData | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slugs.length < 2) {
      setLoading(false);
      return;
    }
    const fetchAll = async () => {
      const results = await Promise.all(
        slugs.map(async (slug) => {
          const { data, error } = await supabase.rpc("get_public_profile", { _slug: slug });
          if (error || !data) return null;
          return data as unknown as ProfileData;
        })
      );
      setProfiles(results);
      setLoading(false);
    };
    fetchAll();
  }, [slugs]);

  // Filter out failed loads
  const validProfiles = profiles.filter((p): p is ProfileData => p !== null);
  const allMetricNames = useMemo(() => collectMetricNames(validProfiles), [validProfiles]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (slugs.length < 2) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="section-card max-w-md w-full">
          <CardContent className="py-16 text-center">
            <User className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h1 className="text-xl font-bold mb-2">Select Players to Compare</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Choose 2 or 3 players from the search results to compare side by side.
            </p>
            <Button variant="outline" onClick={() => navigate("/scout")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Search
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validProfiles.length < 2) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="section-card max-w-md w-full">
          <CardContent className="py-16 text-center">
            <User className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h1 className="text-xl font-bold mb-2">Profiles Not Available</h1>
            <p className="text-sm text-muted-foreground mb-4">
              One or more profiles couldn't be loaded. They may be private or no longer available.
            </p>
            <Button variant="outline" onClick={() => navigate("/scout")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Search
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const colCount = validProfiles.length; // 2 or 3

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="page-hero">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10 shrink-0"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-extrabold text-white">Player Comparison</h1>
            <p className="text-sm text-white/70">{colCount} players side by side</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-12 -mt-4 space-y-4 animate-fade-in">

        {/* Player Headers */}
        <Card className="section-card overflow-hidden">
          <CardContent className="p-0">
            <div className={cn("grid divide-x", colCount === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {validProfiles.map((p, i) => (
                <div key={i} className="p-4 text-center">
                  {/* Photo */}
                  {p.player.photo_url ? (
                    <img
                      src={p.player.photo_url}
                      alt={`${p.player.first_name} ${p.player.last_name}`}
                      className="h-16 w-16 rounded-xl object-cover border mx-auto mb-2"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center mx-auto mb-2">
                      <User className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                  )}
                  {/* Name + link */}
                  <Link
                    to={`/p/${p.player.profile_slug}`}
                    className="text-sm font-bold hover:text-primary transition-colors"
                  >
                    {p.player.first_name} {p.player.last_name}
                  </Link>
                  {/* Program */}
                  {p.program && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {p.program.school_name}
                    </p>
                  )}
                  {/* Positions */}
                  <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                    {p.player.positions?.slice(0, 3).map((pos) => (
                      <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0">{pos}</Badge>
                    ))}
                  </div>
                  {/* Commitment */}
                  {p.player.recruiting_status === "committed" && p.player.committed_school_name && (
                    <p className="text-[10px] text-accent font-medium mt-1">
                      <Trophy className="h-2.5 w-2.5 inline mr-0.5" />
                      {p.player.committed_school_name}
                    </p>
                  )}
                  {p.player.recruiting_status !== "committed" && (
                    <Badge variant="outline" className="text-[9px] mt-1 px-1.5 py-0">Uncommitted</Badge>
                  )}
                  {/* Remove button */}
                  {colCount > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] text-muted-foreground mt-1"
                      onClick={() => {
                        const remaining = slugs.filter((_, idx) => idx !== i);
                        navigate(`/compare?players=${remaining.join(",")}`, { replace: true });
                      }}
                    >
                      <X className="h-3 w-3 mr-0.5" /> Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bio Comparison */}
        <Card className="section-card">
          <CardContent className="py-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" /> Bio
            </h2>
            <div className="space-y-0 divide-y">
              {/* Grad Year */}
              <CompareRow label="Grad Year" colCount={colCount}>
                {validProfiles.map((p, i) => (
                  <span key={i} className="font-semibold text-sm">
                    {p.player.graduation_year || "—"}
                  </span>
                ))}
              </CompareRow>
              {/* Height */}
              <CompareRow label="Height" colCount={colCount}>
                {validProfiles.map((p, i) => (
                  <span key={i} className="font-semibold text-sm">{p.player.height || "—"}</span>
                ))}
              </CompareRow>
              {/* Weight */}
              <CompareRow label="Weight" colCount={colCount}>
                {validProfiles.map((p, i) => (
                  <span key={i} className="font-semibold text-sm">
                    {p.player.weight ? `${p.player.weight} lbs` : "—"}
                  </span>
                ))}
              </CompareRow>
              {/* Bats / Throws */}
              <CompareRow label="Bats / Throws" colCount={colCount}>
                {validProfiles.map((p, i) => (
                  <span key={i} className="font-semibold text-sm">
                    {[p.player.bats, p.player.throws].filter(Boolean).join(" / ") || "—"}
                  </span>
                ))}
              </CompareRow>
              {/* Location */}
              <CompareRow label="Location" colCount={colCount}>
                {validProfiles.map((p, i) => (
                  <span key={i} className="text-sm">
                    {[p.player.city, p.player.state].filter(Boolean).join(", ") || "—"}
                  </span>
                ))}
              </CompareRow>
              {/* GPA */}
              <CompareRow label="GPA" colCount={colCount}>
                {validProfiles.map((p, i) => (
                  <span key={i} className="font-semibold text-sm">{p.player.gpa || "—"}</span>
                ))}
              </CompareRow>
              {/* High School */}
              <CompareRow label="High School" colCount={colCount}>
                {validProfiles.map((p, i) => (
                  <span key={i} className="text-sm truncate">
                    {(p.player as Record<string, unknown>).high_school as string || "—"}
                  </span>
                ))}
              </CompareRow>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Comparison */}
        {allMetricNames.length > 0 && (
          <Card className="section-card">
            <CardContent className="py-4">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" /> Verified Metrics
              </h2>
              <div className="space-y-0 divide-y">
                {allMetricNames.map((metricName) => {
                  const entries = validProfiles.map((p) => getMetricValue(p, metricName));
                  const values = entries.map((e) => e?.value ?? null);
                  const metricType = entries.find((e) => e)?.metric_type || "measured";

                  return (
                    <CompareRow key={metricName} label={metricName} colCount={colCount}>
                      {validProfiles.map((p, i) => {
                        const entry = entries[i];
                        if (!entry) {
                          return <span key={i} className="text-sm text-muted-foreground">—</span>;
                        }
                        // Determine if this is the best value among the compared players
                        const otherValues = values.filter((v, idx): v is number => v !== null && idx !== i);
                        const isBest = otherValues.length > 0 && otherValues.every((ov) => isBetter(entry.value, ov, metricType));

                        // Get trend data
                        const trend = getTrendDirection(p, metricName);

                        return (
                          <div key={i} className="text-center">
                            <span className={cn(
                              "font-bold text-sm tabular-nums",
                              isBest && "text-green-600"
                            )}>
                              {entry.value.toFixed(1)}
                            </span>
                            {entry.unit && (
                              <span className="text-[10px] text-muted-foreground ml-0.5">{entry.unit}</span>
                            )}
                            {/* Trend sparkline + direction */}
                            {trend && (
                              <div className="mt-0.5">
                                <DirectionBadge direction={trend.direction} delta={trend.delta} />
                                {p.trend_data && (() => {
                                  const td = p.trend_data!.find((t) => t.metric_name === metricName);
                                  if (!td?.points || td.points.length < 2) return null;
                                  return (
                                    <MiniSparkline
                                      points={td.points.map((pt) => pt.value)}
                                      direction={trend.direction}
                                    />
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CompareRow>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Evaluator Metrics Comparison (if any players have them) */}
        {validProfiles.some((p) => p.evaluator_metrics.length > 0) && (
          <Card className="section-card">
            <CardContent className="py-4">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Award className="h-4 w-4 text-accent" /> Showcase Data
              </h2>
              <div className="space-y-0 divide-y">
                {(() => {
                  // Collect all unique evaluator metric names
                  const evalMetricNames = new Map<string, number>();
                  let idx = 0;
                  for (const p of validProfiles) {
                    for (const m of p.evaluator_metrics) {
                      if (!evalMetricNames.has(m.name)) evalMetricNames.set(m.name, idx++);
                    }
                  }
                  const sortedNames = [...evalMetricNames.entries()]
                    .sort((a, b) => a[1] - b[1])
                    .map(([n]) => n);

                  return sortedNames.map((name) => (
                    <CompareRow key={name} label={name} colCount={colCount}>
                      {validProfiles.map((p, i) => {
                        const entry = p.evaluator_metrics.find((m) => m.name === name);
                        if (!entry) return <span key={i} className="text-sm text-muted-foreground">—</span>;
                        return (
                          <span key={i} className="font-bold text-sm tabular-nums">
                            {entry.value.toFixed(1)}
                            {entry.unit && <span className="text-[10px] text-muted-foreground ml-0.5">{entry.unit}</span>}
                          </span>
                        );
                      })}
                    </CompareRow>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* View Full Profiles */}
        <Card className="section-card">
          <CardContent className="py-4">
            <h2 className="text-sm font-bold mb-3">Full Profiles</h2>
            <div className={cn("grid gap-2", colCount === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {validProfiles.map((p, i) => (
                <Link
                  key={i}
                  to={`/p/${p.player.profile_slug}`}
                  className="block"
                >
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    View {p.player.first_name}'s Profile
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Compare Row Layout ────────────────────────────────────────────

function CompareRow({
  label,
  colCount,
  children,
}: {
  label: string;
  colCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center py-2.5">
      <div className="w-28 shrink-0 pr-2">
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={cn("flex-1 grid text-center", colCount === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {children}
      </div>
    </div>
  );
}
