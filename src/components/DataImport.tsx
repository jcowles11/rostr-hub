import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, AlertCircle, CheckCircle2, Database, UserPlus, Plus, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { fetchPlayerImportSummaries, bulkCreatePlayers, updatePlayerProfile } from "@/services/playerService";
import { bulkInsertEvaluations, fetchExistingEvalKeys } from "@/services/evaluationService";
import { fetchMetricSummaries, createMetricAndReturn, createMetricsAndReturn } from "@/services/metricService";
import type { MetricBounds } from "@/lib/validation";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  normalizeHeader,
  isPlayerInfoColumn,
  isNumericColumn,
  splitFullName,
  splitBatsThrows,
  groupAttemptColumns,
  stripUnitsFromValue,
  preprocessRawData,
  type ColumnGroup,
} from "@/lib/importUtils";

interface DataImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ExistingPlayer {
  id: string;
  first_name: string;
  last_name: string;
}

interface MetricInfo {
  id: string;
  name: string;
  unit: string;
  metric_type: string;
  min_value?: number | null;
  max_value?: number | null;
}

type Step = "upload" | "identify" | "map_metrics" | "preview" | "done";

interface PlayerIdMapping {
  player_name: string;
  first_name: string;
  last_name: string;
}

// Maps group displayName → metric_id
type GroupMetricMap = Record<string, string>;

/** Flexible column finder: exact → starts-with → contains matching */
function findCol(headers: string[], terms: string[]): string {
  const normed = headers.map(normalizeHeader);
  const normTerms = terms.map(normalizeHeader);
  // Exact
  for (const t of normTerms) {
    const idx = normed.indexOf(t);
    if (idx !== -1) return headers[idx];
  }
  // Starts with
  for (const t of normTerms) {
    const idx = normed.findIndex((h) => h.startsWith(t));
    if (idx !== -1) return headers[idx];
  }
  // Contains
  for (const t of normTerms) {
    if (t.length < 3) continue; // avoid false positives for short terms
    const idx = normed.findIndex((h) => h.includes(t));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

interface DetectedProfileColumns {
  batsThrows: string;
  bats: string;
  throws: string;
  grade: string;
  gradYear: string;
  position: string;
  height: string;
  weight: string;
}

function detectProfileColumns(headers: string[]): DetectedProfileColumns {
  return {
    batsThrows: findCol(headers, ["b/t", "bats/throws", "bat/throw", "bats throws", "bats-throws", "bats / throws", "bat throw"]),
    bats: findCol(headers, ["bats", "bat"]),
    throws: findCol(headers, ["throws", "throw"]),
    grade: findCol(headers, ["grade", "class", "year"]),
    gradYear: findCol(headers, ["grad year", "graduation year", "grad_year", "graduation_year", "grad yr"]),
    position: findCol(headers, ["position", "pos", "positions"]),
    height: findCol(headers, ["height", "ht"]),
    weight: findCol(headers, ["weight", "wt"]),
  };
}

interface PlayerProfileData {
  bats?: string;
  throws?: string;
  grade?: number;
  graduation_year?: number;
  positions?: string[];
  height?: string;
  weight?: number;
}

function extractProfileData(row: Record<string, string>, cols: DetectedProfileColumns): PlayerProfileData {
  const data: PlayerProfileData = {};

  // B/T - handle combined column or separate columns
  if (cols.batsThrows) {
    const bt = splitBatsThrows(row[cols.batsThrows] || "");
    if (bt.bats) data.bats = bt.bats;
    if (bt.throws) data.throws = bt.throws;
  }
  if (!data.bats && cols.bats) {
    const v = (row[cols.bats] || "").trim().toUpperCase();
    if (v && /^[RLSB]/.test(v)) data.bats = v.substring(0, 1);
  }
  if (!data.throws && cols.throws) {
    const v = (row[cols.throws] || "").trim().toUpperCase();
    if (v && /^[RLB]/.test(v)) data.throws = v.substring(0, 1);
  }

  // Grade
  if (cols.grade) {
    const v = parseInt((row[cols.grade] || "").trim());
    if (v >= 1 && v <= 12) data.grade = v;
  }

  // Graduation year
  if (cols.gradYear) {
    const v = parseInt((row[cols.gradYear] || "").trim());
    if (v >= 2000 && v <= 2040) data.graduation_year = v;
  }

  // Position(s)
  if (cols.position) {
    const raw = (row[cols.position] || "").trim();
    if (raw) {
      data.positions = raw.split(/[,\/;]+/).map((p) => p.trim()).filter(Boolean);
    }
  }

  // Height (keep as string like "5'10" or "5-10")
  if (cols.height) {
    const v = (row[cols.height] || "").trim();
    if (v) data.height = v;
  }

  // Weight
  if (cols.weight) {
    const v = stripUnitsFromValue(row[cols.weight] || "");
    if (v && v > 50 && v < 400) data.weight = v;
  }

  return data;
}

function guessPlayerColumns(headers: string[]): PlayerIdMapping {
  const firstName = findCol(headers, ["first name", "firstname", "first"]);
  const lastName = findCol(headers, ["last name", "lastname", "last", "surname"]);
  const playerName = !firstName && !lastName
    ? findCol(headers, ["player name", "playername", "full name", "fullname", "athlete name", "athlete", "name"])
    : "";
  return {
    player_name: playerName,
    first_name: firstName,
    last_name: lastName,
  };
}

function guessGroupMetricMap(groups: ColumnGroup[], metrics: MetricInfo[]): GroupMetricMap {
  const map: GroupMetricMap = {};
  const usedMetricIds = new Set<string>();

  // Pre-compute normalized metric names and stripped variants
  const metricEntries = metrics.map((m) => {
    const mNorm = normalizeHeader(m.name);
    const mStripped = mNorm.replace(/\s*\(.*?\)\s*$/, "").trim();
    // Build tokens for word-level matching (e.g. "fb velo" → ["fb", "velo"])
    const mTokens = mStripped.split(/\s+/).filter(Boolean);
    return { metric: m, mNorm, mStripped, mTokens };
  });

  // Score each group against each metric — higher score = better match
  const scorePair = (gStripped: string, gTokens: string[], entry: typeof metricEntries[0]): number => {
    const { mNorm, mStripped, mTokens } = entry;
    // Exact match
    if (gStripped === mNorm || gStripped === mStripped) return 100;
    // One contains the other
    if (mStripped.includes(gStripped) || gStripped.includes(mStripped)) return 80;
    // All tokens from group found in metric (or vice versa)
    const allGroupInMetric = gTokens.every((t) => mTokens.some((mt) => mt.includes(t) || t.includes(mt)));
    const allMetricInGroup = mTokens.every((t) => gTokens.some((gt) => gt.includes(t) || t.includes(gt)));
    if (allGroupInMetric && allMetricInGroup) return 70;
    if (allGroupInMetric) return 60;
    if (allMetricInGroup) return 50;
    // Partial token overlap (at least half)
    const overlapCount = gTokens.filter((t) => mTokens.some((mt) => mt.includes(t) || t.includes(mt))).length;
    if (overlapCount > 0 && overlapCount >= Math.min(gTokens.length, mTokens.length) * 0.5) return 30;
    return 0;
  };

  // Sort groups by specificity (longer names first) so they get first pick
  const sortedGroups = [...groups].sort((a, b) => b.displayName.length - a.displayName.length);

  for (const group of sortedGroups) {
    const gNorm = normalizeHeader(group.displayName);
    const gStripped = gNorm.replace(/\s*\(.*?\)\s*$/, "").trim();
    const gTokens = gStripped.split(/\s+/).filter(Boolean);
    if (gStripped.length < 2) continue;

    let bestScore = 0;
    let bestMetric: MetricInfo | null = null;

    for (const entry of metricEntries) {
      if (usedMetricIds.has(entry.metric.id)) continue;
      const score = scorePair(gStripped, gTokens, entry);
      if (score > bestScore) {
        bestScore = score;
        bestMetric = entry.metric;
      }
    }

    // Only auto-map if score is reasonably confident
    if (bestMetric && bestScore >= 30) {
      map[group.displayName] = bestMetric.id;
      usedMetricIds.add(bestMetric.id);
    }
  }

  return map;
}

interface MatchedRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  matchedPlayer: ExistingPlayer | null;
  createNew: boolean;
  metricValues: { metricId: string; metricName: string; value: number; attemptNumber: number }[];
  profileData: PlayerProfileData;
}

export default function DataImport({ open, onOpenChange, onSuccess }: DataImportProps) {
  const { coach } = useAuth();
  const { sessions, createSession } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [playerMapping, setPlayerMapping] = useState<PlayerIdMapping>({ player_name: "", first_name: "", last_name: "" });
  const [columnGroups, setColumnGroups] = useState<ColumnGroup[]>([]);
  const [groupMapping, setGroupMapping] = useState<GroupMetricMap>({});
  const [existingPlayers, setExistingPlayers] = useState<ExistingPlayer[]>([]);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [createMissing, setCreateMissing] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState({ players: 0, evals: 0, skippedDupes: 0 });
  const [creatingMetric, setCreatingMetric] = useState(false);
  const [importSessionId, setImportSessionId] = useState<string>("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");

  useEffect(() => {
    if (!coach || !open) return;
    Promise.all([
      fetchPlayerImportSummaries(coach.program_id),
      fetchMetricSummaries(coach.program_id),
    ]).then(([pRes, mRes]) => {
      setExistingPlayers(pRes.data || []);
      setMetrics(mRes.data || []);
    }).catch(() => {
      toast.error("Failed to load roster or metrics. Please close and try again.");
    });
  }, [coach, open]);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setPlayerMapping({ player_name: "", first_name: "", last_name: "" });
    setColumnGroups([]);
    setGroupMapping({});
    setMatchedRows([]);
    setImporting(false);
    setImportResult({ players: 0, evals: 0, skippedDupes: 0 });
    setImportSessionId("");
    setCreatingSession(false);
    setNewSessionName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const parseFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    const processData = (data: Record<string, string>[], fields: string[]) => {
      if (!data.length || !fields.length) { toast.error("No data found"); return; }
      setHeaders(fields);
      setRows(data);
      const guessedNames = guessPlayerColumns(fields);
      setPlayerMapping(guessedNames);

      const nameSet = new Set([guessedNames.player_name, guessedNames.first_name, guessedNames.last_name].filter(Boolean));
      const groups = groupAttemptColumns(fields, data, nameSet);
      setColumnGroups(groups);
      setGroupMapping(guessGroupMetricMap(groups, metrics));
      setStep("identify");
    };

    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        header: false, // Parse as raw 2D array for preprocessing
        skipEmptyLines: true,
        complete: (result) => {
          const rawRows = result.data as string[][];
          const { headers: cleanHeaders, rows: cleanRows } = preprocessRawData(rawRows);
          processData(cleanRows, cleanHeaders);
        },
        error: () => toast.error("Failed to parse CSV"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          // Get raw 2D array for preprocessing
          const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" })
            .map((row: any) => (Array.isArray(row) ? row.map(String) : []));
          const { headers: cleanHeaders, rows: cleanRows } = preprocessRawData(rawRows);
          processData(cleanRows, cleanHeaders);
        } catch { toast.error("Failed to parse Excel"); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Please upload a .csv, .xlsx, or .xls file");
    }
  };

  // Recompute groups when name mapping changes
  const recomputeGroups = () => {
    const nameSet = new Set([playerMapping.player_name, playerMapping.first_name, playerMapping.last_name].filter(Boolean));
    const groups = groupAttemptColumns(headers, rows, nameSet);
    setColumnGroups(groups);
    // Preserve existing mappings where group names match
    const newMap: GroupMetricMap = {};
    for (const g of groups) {
      if (groupMapping[g.displayName]) {
        newMap[g.displayName] = groupMapping[g.displayName];
      }
    }
    setGroupMapping(newMap);
  };

  const useFullName = !!playerMapping.player_name && !playerMapping.first_name && !playerMapping.last_name;
  const hasValidNameMapping = useFullName || (!!playerMapping.first_name && !!playerMapping.last_name);

  const buildMatchedRows = () => {
    const profileCols = detectProfileColumns(headers);

    // Step 1: Build raw rows with player identification and metric extraction
    const rawMatched: MatchedRow[] = rows.map((row, i) => {
      let firstName: string, lastName: string;
      if (useFullName) {
        const split = splitFullName(row[playerMapping.player_name] || "");
        firstName = split.first;
        lastName = split.last;
      } else {
        firstName = (row[playerMapping.first_name] || "").trim();
        lastName = (row[playerMapping.last_name] || "").trim();
      }

      const match = existingPlayers.find(
        (p) => p.first_name.toLowerCase() === firstName.toLowerCase() && p.last_name.toLowerCase() === lastName.toLowerCase()
      );

      const profileData = extractProfileData(row, profileCols);

      const metricValues: MatchedRow["metricValues"] = [];
      for (const group of columnGroups) {
        const metricId = groupMapping[group.displayName];
        if (!metricId) continue;
        const metric = metrics.find((m) => m.id === metricId);

        group.columns.forEach((col, colIdx) => {
          const raw = row[col];
          const val = stripUnitsFromValue(raw || "");
          if (val !== null) {
            metricValues.push({
              metricId,
              metricName: metric?.name || group.displayName,
              value: val,
              attemptNumber: colIdx + 1,
            });
          }
        });
      }

      return {
        rowIndex: i,
        firstName,
        lastName,
        matchedPlayer: match || null,
        createNew: !match && createMissing,
        metricValues,
        profileData,
      };
    }).filter((r) => r.firstName || r.lastName);

    // Step 2: Merge rows that map to the same player (within-file duplicate detection)
    // This handles CSVs where the same player appears on multiple rows (e.g., long-format timing data)
    const playerKey = (r: MatchedRow) => `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`;
    const seen = new Map<string, number>(); // key → index in merged array
    const merged: MatchedRow[] = [];
    let mergedRowCount = 0;

    for (const row of rawMatched) {
      const key = playerKey(row);
      const existingIdx = seen.get(key);

      if (existingIdx !== undefined) {
        // Merge metric values: append with adjusted attempt numbers to avoid collisions
        const existing = merged[existingIdx];
        for (const mv of row.metricValues) {
          // Check if this exact (metricId, attemptNumber) already exists
          const collision = existing.metricValues.find(
            (e) => e.metricId === mv.metricId && e.attemptNumber === mv.attemptNumber
          );
          if (collision) {
            // Assign next available attempt number for this metric
            const maxAttempt = Math.max(
              ...existing.metricValues.filter((e) => e.metricId === mv.metricId).map((e) => e.attemptNumber),
              0
            );
            existing.metricValues.push({ ...mv, attemptNumber: maxAttempt + 1 });
          } else {
            existing.metricValues.push(mv);
          }
        }
        // Merge profile data (first row's data wins, fill in gaps from later rows)
        if (row.profileData) {
          for (const [k, v] of Object.entries(row.profileData)) {
            if (v !== undefined && (existing.profileData as any)[k] === undefined) {
              (existing.profileData as any)[k] = v;
            }
          }
        }
        mergedRowCount++;
      } else {
        seen.set(key, merged.length);
        merged.push({ ...row });
      }
    }

    if (mergedRowCount > 0) {
      toast.info(`${mergedRowCount} duplicate row${mergedRowCount > 1 ? "s" : ""} merged (same player appeared multiple times in file)`);
    }

    setMatchedRows(merged);
    return merged;
  };

  const proceedToMetrics = () => {
    recomputeGroups();
    setStep("map_metrics");
  };

  const proceedToPreview = () => {
    const matched = buildMatchedRows();
    if (matched.length === 0) {
      toast.error("No players could be identified. Check your name column mapping.");
      return;
    }
    const hasAnyScores = matched.some((r) => (r.matchedPlayer || r.createNew) && r.metricValues.length > 0);
    if (!hasAnyScores) {
      toast.warning("No scores to import. All metric values are empty or could not be parsed.");
    }
    setStep("preview");
  };

  const mappedGroupCount = Object.values(groupMapping).filter(Boolean).length;
  const unmappedGroups = columnGroups.filter((g) => !groupMapping[g.displayName]);
  const totalEvals = matchedRows.reduce((acc, r) => acc + (r.matchedPlayer || r.createNew ? r.metricValues.length : 0), 0);
  const newPlayerCount = matchedRows.filter((r) => !r.matchedPlayer && r.createNew).length;
  const matchedCount = matchedRows.filter((r) => r.matchedPlayer).length;
  const skippedCount = matchedRows.filter((r) => !r.matchedPlayer && !r.createNew).length;

  const handleImport = async () => {
    if (!coach || importing) return;
    setImporting(true);

    try {
      let createdPlayers = 0;
      let insertedEvals = 0;
      const playerIdMap = new Map<number, string>();

      const newPlayers = matchedRows.filter((r) => !r.matchedPlayer && r.createNew);
      if (newPlayers.length > 0) {
        const { data: inserted, error } = await bulkCreatePlayers(
          newPlayers.map((r) => ({
            program_id: coach.program_id,
            first_name: r.firstName || "Unknown",
            last_name: r.lastName || "Player",
            positions: r.profileData.positions || [],
            bats: r.profileData.bats || null,
            throws: r.profileData.throws || null,
            grade: r.profileData.grade || null,
            graduation_year: r.profileData.graduation_year || null,
            height: r.profileData.height || null,
            weight: r.profileData.weight || null,
          }))
        );

        if (error) { toast.error(`Failed to create players: ${error}`); setImporting(false); return; }

        (inserted || []).forEach((p, i) => {
          playerIdMap.set(newPlayers[i].rowIndex, p.id);
        });
        createdPlayers = inserted?.length || 0;
      }

      matchedRows.forEach((r) => {
        if (r.matchedPlayer) playerIdMap.set(r.rowIndex, r.matchedPlayer.id);
      });

      // Update existing players with profile data from spreadsheet (via service layer)
      const existingWithProfile = matchedRows.filter((r) => r.matchedPlayer && Object.keys(r.profileData).length > 0);
      for (const r of existingWithProfile) {
        const updates: Partial<PlayerProfileData> = {};
        if (r.profileData.bats) updates.bats = r.profileData.bats;
        if (r.profileData.throws) updates.throws = r.profileData.throws;
        if (r.profileData.grade) updates.grade = r.profileData.grade;
        if (r.profileData.graduation_year) updates.graduation_year = r.profileData.graduation_year;
        if (r.profileData.positions?.length) updates.positions = r.profileData.positions;
        if (r.profileData.height) updates.height = r.profileData.height;
        if (r.profileData.weight) updates.weight = r.profileData.weight;
        if (Object.keys(updates).length > 0) {
          const { error: profileErr } = await updatePlayerProfile(r.matchedPlayer!.id, updates);
          if (profileErr) {
            toast.error(`Failed to update profile for ${r.firstName} ${r.lastName}: ${profileErr}`);
          }
        }
      }

      const sessionId = importSessionId && importSessionId !== "none" ? importSessionId : null;

      // Build candidate evaluations
      const candidateEvals: { program_id: string; player_id: string; metric_id: string; coach_id: string; value: number; attempt_number: number; session_id: string | null }[] = [];
      for (const row of matchedRows) {
        const playerId = playerIdMap.get(row.rowIndex);
        if (!playerId || row.metricValues.length === 0) continue;

        for (const mv of row.metricValues) {
          candidateEvals.push({
            program_id: coach.program_id,
            player_id: playerId,
            metric_id: mv.metricId,
            coach_id: coach.id,
            value: mv.value,
            attempt_number: mv.attemptNumber,
            session_id: sessionId,
          });
        }
      }

      // Deduplicate against existing evaluations to prevent re-import
      let evals = candidateEvals;
      let skippedDupes = 0;
      if (evals.length > 0) {
        const playerIds = [...new Set(evals.map((e) => e.player_id))];
        const metricIds = [...new Set(evals.map((e) => e.metric_id))];

        const { keys: existingKeys } = await fetchExistingEvalKeys(playerIds, metricIds, coach.id, sessionId);

        if (existingKeys.size > 0) {
          const filtered = evals.filter(
            (e) => !existingKeys.has(`${e.player_id}|${e.metric_id}|${e.attempt_number}|${e.coach_id}`)
          );
          skippedDupes = evals.length - filtered.length;
          evals = filtered;
        }
      }

      if (evals.length > 0) {
        // Build metric bounds map for validation
        const boundsMap = new Map<string, MetricBounds>();
        (metrics || []).forEach((m: any) => {
          boundsMap.set(m.id, {
            min_value: m.min_value ?? null,
            max_value: m.max_value ?? null,
            metric_type: m.metric_type || "measured",
            name: m.name || "",
            unit: m.unit || "",
          });
        });

        const { insertedCount, skippedCount: boundsSkipped, error } = await bulkInsertEvaluations(evals, boundsMap);
        if (error) { toast.error(`Failed to import evaluations: ${error}`); setImporting(false); return; }
        insertedEvals = insertedCount;
        if (boundsSkipped > 0) {
          toast.warning(`${boundsSkipped} score(s) skipped — values outside metric bounds`);
        }
      }

      setImportResult({ players: createdPlayers, evals: insertedEvals, skippedDupes });
      setStep("done");
      onSuccess();
    } catch (err: any) {
      toast.error(`Import error: ${err.message || "Unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Database className="h-5 w-5" /> Import Tryout Data
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a spreadsheet with player names and tryout scores. We'll match players to your roster and import their metric data.
            </p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) parseFile(file); }}
            />
            <Button variant="outline" className="w-full h-32 rounded-xl border-dashed border-2 flex flex-col gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="font-semibold">Choose File</span>
              <span className="text-xs text-muted-foreground">CSV, Excel (.xlsx, .xls)</span>
            </Button>
            {metrics.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No metrics configured yet. Set up metrics in Settings first.
              </div>
            )}
          </div>
        )}

        {step === "identify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{rows.length}</span> rows found. Identify the player name column(s):
            </p>
            <div className="space-y-3">
              {(["player_name", "first_name", "last_name"] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <Label className="w-24 text-sm shrink-0">
                    {key === "player_name" ? "Full Name" : key === "first_name" ? "First Name" : "Last Name"}
                  </Label>
                  <Select value={playerMapping[key] || "__none__"}
                    onValueChange={(v) => setPlayerMapping({ ...playerMapping, [key]: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className="h-10 rounded-lg flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Select —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!hasValidNameMapping && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Map either a Full Name column, or both First Name and Last Name columns.
              </div>
            )}
            {useFullName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Names will be split automatically. Supports "First Last" and "Last, First" formats.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={reset}>Back</Button>
              <Button className="flex-1 h-11 rounded-xl gradient-primary border-0 font-bold"
                disabled={!hasValidNameMapping}
                onClick={proceedToMetrics}
              >
                Next: Map Metrics
              </Button>
            </div>
          </div>
        )}

        {step === "map_metrics" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We detected <span className="font-semibold text-foreground">{columnGroups.length}</span> data groups from your columns.
              Multi-attempt columns (e.g. <span className="font-mono text-xs">FB_Velo_1–5</span>) are grouped automatically.
              Map each group to a metric or skip it.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {columnGroups.map((group) => (
                <div key={group.displayName} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="w-32 shrink-0">
                    <p className="text-sm font-medium truncate" title={group.displayName}>{group.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {group.columns.length} attempt{group.columns.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <Select
                    value={groupMapping[group.displayName] || "__none__"}
                    onValueChange={async (v) => {
                      if (v === "__create__") {
                        if (!coach || creatingMetric) return;
                        setCreatingMetric(true);
                        try {
                          const { data: newMetric, error } = await createMetricAndReturn({
                            program_id: coach.program_id,
                            name: group.displayName,
                            unit: "",
                            metric_type: "measured",
                            max_attempts: group.columns.length,
                            sort_order: metrics.length,
                          });

                          if (error) { toast.error(`Failed to create metric: ${error}`); return; }
                          if (newMetric) {
                            setMetrics((prev) => [...prev, newMetric]);
                            setGroupMapping((prev) => ({ ...prev, [group.displayName]: newMetric.id }));
                            toast.success(`Created metric "${group.displayName}"`);
                          }
                        } finally {
                          setCreatingMetric(false);
                        }
                        return;
                      }
                      setGroupMapping({ ...groupMapping, [group.displayName]: v === "__none__" ? "" : v });
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg flex-1 text-sm">
                      <SelectValue placeholder="Skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip —</SelectItem>
                      <SelectItem value="__create__" className="text-primary font-medium">
                        <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Create "{group.displayName}"</span>
                      </SelectItem>
                      {metrics.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {unmappedGroups.length > 0 && (
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl text-sm font-medium gap-2"
                disabled={creatingMetric}
                onClick={async () => {
                  if (!coach || creatingMetric) return;
                  setCreatingMetric(true);
                  try {
                    const toCreate = unmappedGroups.map((g, i) => ({
                      program_id: coach.program_id,
                      name: g.displayName,
                      unit: "",
                      metric_type: "measured",
                      max_attempts: g.columns.length,
                      sort_order: metrics.length + i,
                    }));
                    const { data: created, error } = await createMetricsAndReturn(toCreate);
                    if (error) { toast.error(`Failed to create metrics: ${error}`); return; }
                    if (created && created.length > 0) {
                      setMetrics((prev) => [...prev, ...created]);
                      const newMappings: GroupMetricMap = {};
                      for (const m of created) {
                        const group = unmappedGroups.find((g) => g.displayName === m.name);
                        if (group) newMappings[group.displayName] = m.id;
                      }
                      setGroupMapping((prev) => ({ ...prev, ...newMappings }));
                      toast.success(`Created ${created.length} new metric${created.length > 1 ? "s" : ""}`);
                    }
                  } finally {
                    setCreatingMetric(false);
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                {creatingMetric ? "Creating..." : `Create All Unmapped (${unmappedGroups.length})`}
              </Button>
            )}

            {mappedGroupCount === 0 && unmappedGroups.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Map at least one group to a metric to import data.
              </div>
            )}

            {mappedGroupCount > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <span className="font-semibold text-foreground">{mappedGroupCount}</span> metric{mappedGroupCount > 1 ? "s" : ""} mapped.
                {unmappedGroups.length > 0 && <> {unmappedGroups.length} unmapped.</>}
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Create missing players</p>
                <p className="text-xs text-muted-foreground">Auto-add players not in your roster</p>
              </div>
              <Switch checked={createMissing} onCheckedChange={setCreateMissing} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep("identify")}>Back</Button>
              <Button className="flex-1 h-11 rounded-xl gradient-primary border-0 font-bold"
                disabled={mappedGroupCount === 0}
                onClick={proceedToPreview}
              >
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border p-3 text-center">
                <p className="text-lg font-extrabold text-foreground">{matchedCount}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">Matched</p>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <p className="text-lg font-extrabold text-foreground">{newPlayerCount}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">New Players</p>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <p className="text-lg font-extrabold text-foreground">{totalEvals}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">Scores</p>
              </div>
            </div>

            {/* Event picker */}
            <div className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Assign to Event</Label>
              </div>
              <p className="text-xs text-muted-foreground">Link imported scores to an event so they appear when filtering.</p>
              {!creatingSession ? (
                <div className="flex gap-2">
                  <Select value={importSessionId} onValueChange={setImportSessionId}>
                    <SelectTrigger className="flex-1 h-9 rounded-lg text-sm">
                      <SelectValue placeholder="No event (unassigned)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No event (unassigned)</SelectItem>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.session_date})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-9 rounded-lg shrink-0" onClick={() => setCreatingSession(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> New
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    placeholder="Event name (e.g. Fall Tryouts)"
                    className="flex-1 h-9 rounded-lg text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSessionName.trim()) {
                        createSession(newSessionName.trim()).then((s) => {
                          if (s) {
                            setImportSessionId(s.id);
                            toast.success(`Event "${s.name}" created`);
                          }
                          setCreatingSession(false);
                          setNewSessionName("");
                        }).catch(() => {
                          toast.error("Failed to create event");
                        });
                      }
                      if (e.key === "Escape") { setCreatingSession(false); setNewSessionName(""); }
                    }}
                    autoFocus
                  />
                  <Button size="sm" className="h-9 rounded-lg" disabled={!newSessionName.trim()} onClick={() => {
                    createSession(newSessionName.trim()).then((s) => {
                      if (s) {
                        setImportSessionId(s.id);
                        toast.success(`Event "${s.name}" created`);
                      }
                      setCreatingSession(false);
                      setNewSessionName("");
                    }).catch(() => {
                      toast.error("Failed to create event");
                    });
                  }}>Create</Button>
                  <Button variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => { setCreatingSession(false); setNewSessionName(""); }}>Cancel</Button>
                </div>
              )}
            </div>

            {skippedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {skippedCount} player{skippedCount > 1 ? "s" : ""} not matched and will be skipped.
              </div>
            )}

            {totalEvals === 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No scores to import. Check that your metric columns contain valid numeric values.
              </div>
            )}

            <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-xl border p-3">
              {matchedRows.filter((r) => r.matchedPlayer || r.createNew).map((r) => (
                <div key={r.rowIndex} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{r.lastName}, {r.firstName}</span>
                  {r.matchedPlayer ? (
                    <Badge variant="secondary" className="text-[10px] h-4">existing</Badge>
                  ) : (
                    <Badge className="text-[10px] h-4 bg-primary/10 text-primary border-0">
                      <UserPlus className="h-3 w-3 mr-0.5" /> new
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{r.metricValues.length} scores</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep("map_metrics")}>Back</Button>
              <Button className="flex-1 h-11 rounded-xl gradient-primary border-0 font-bold"
                disabled={importing || totalEvals === 0}
                onClick={handleImport}
              >
                {importing ? "Importing..." : `Import ${totalEvals} Scores`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <div>
              <p className="text-lg font-bold">Import Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {importResult.players > 0 && <>Created {importResult.players} new player{importResult.players > 1 ? "s" : ""}. </>}
                Imported {importResult.evals} evaluation{importResult.evals !== 1 ? "s" : ""}.
                {importResult.skippedDupes > 0 && (
                  <span className="block mt-0.5 text-amber-600 dark:text-amber-400">
                    {importResult.skippedDupes} duplicate score{importResult.skippedDupes !== 1 ? "s" : ""} skipped (already existed).
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                View results on the Dashboard to see grades and percentile rankings.
              </p>
            </div>
            <Button className="w-full h-11 rounded-xl font-bold" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
