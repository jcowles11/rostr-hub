import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Database, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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
}

type Step = "upload" | "identify" | "map_metrics" | "preview" | "done";

// Mapping spreadsheet columns to identify players
interface PlayerIdMapping {
  player_name: string; // single combined name column
  first_name: string;
  last_name: string;
}

// Mapping spreadsheet columns to metrics
type MetricColumnMap = Record<string, string>; // header -> metric_id

function splitFullName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { first: "", last: "" };
  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",");
    return { first: rest.join(",").trim(), last: last.trim() };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function guessPlayerColumns(headers: string[]): PlayerIdMapping {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (terms: string[]) => {
    const idx = lower.findIndex((h) => terms.some((t) => h === t || h.includes(t)));
    return idx >= 0 ? headers[idx] : "";
  };
  const firstName = find(["first name", "first_name", "firstname", "first"]);
  const lastName = find(["last name", "last_name", "lastname", "last", "surname"]);
  const playerName = find(["player name", "player_name", "playername", "full name", "full_name", "fullname", "athlete name", "athlete", "name"]);
  return {
    player_name: (!firstName && !lastName) ? playerName : "",
    first_name: firstName,
    last_name: lastName,
  };
}

function guessMetricColumns(headers: string[], metrics: MetricInfo[]): MetricColumnMap {
  const map: MetricColumnMap = {};
  for (const header of headers) {
    const hLower = header.toLowerCase().trim();
    // Skip obvious player info columns
    if (["first name", "last name", "first_name", "last_name", "firstname", "lastname", "name",
         "grade", "position", "pos", "jersey", "number", "#", "bats", "throws", "first", "last", "surname"].some(t => hLower.includes(t))) continue;

    const match = metrics.find((m) => {
      const mLower = m.name.toLowerCase();
      return hLower === mLower || hLower.includes(mLower) || mLower.includes(hLower);
    });
    if (match) map[header] = match.id;
  }
  return map;
}

interface MatchedRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  matchedPlayer: ExistingPlayer | null;
  createNew: boolean;
  metricValues: { metricId: string; metricName: string; value: number }[];
}

export default function DataImport({ open, onOpenChange, onSuccess }: DataImportProps) {
  const { coach } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [playerMapping, setPlayerMapping] = useState<PlayerIdMapping>({ player_name: "", first_name: "", last_name: "" });
  const [metricMapping, setMetricMapping] = useState<MetricColumnMap>({});
  const [existingPlayers, setExistingPlayers] = useState<ExistingPlayer[]>([]);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [createMissing, setCreateMissing] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState({ players: 0, evals: 0 });

  // Fetch existing players and metrics
  useEffect(() => {
    if (!coach || !open) return;
    Promise.all([
      supabase.from("players").select("id, first_name, last_name").eq("program_id", coach.program_id),
      supabase.from("metrics").select("id, name, unit, metric_type").eq("program_id", coach.program_id).order("sort_order"),
    ]).then(([pRes, mRes]) => {
      setExistingPlayers(pRes.data || []);
      setMetrics(mRes.data || []);
    });
  }, [coach, open]);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setPlayerMapping({ player_name: "", first_name: "", last_name: "" });
    setMetricMapping({});
    setMatchedRows([]);
    setImporting(false);
    setImportResult({ players: 0, evals: 0 });
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
      setPlayerMapping(guessPlayerColumns(fields));
      setMetricMapping(guessMetricColumns(fields, metrics));
      setStep("identify");
    };

    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => processData(result.data as Record<string, string>[], result.meta.fields || []),
        error: () => toast.error("Failed to parse CSV"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
          if (!json.length) { toast.error("No data found"); return; }
          const hdrs = Object.keys(json[0]);
          processData(json.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))), hdrs);
        } catch { toast.error("Failed to parse Excel"); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Please upload a .csv, .xlsx, or .xls file");
    }
  };

  // Match rows to existing players
  const useFullName = !!playerMapping.player_name && !playerMapping.first_name && !playerMapping.last_name;
  const hasValidNameMapping = useFullName || (!!playerMapping.first_name && !!playerMapping.last_name);

  const buildMatchedRows = () => {
    const matched: MatchedRow[] = rows.map((row, i) => {
      let firstName: string, lastName: string;
      if (useFullName) {
        const split = splitFullName(row[playerMapping.player_name] || "");
        firstName = split.first;
        lastName = split.last;
      } else {
        firstName = (row[playerMapping.first_name] || "").trim();
        lastName = (row[playerMapping.last_name] || "").trim();
      }

      // Try exact match
      const match = existingPlayers.find(
        (p) => p.first_name.toLowerCase() === firstName.toLowerCase() && p.last_name.toLowerCase() === lastName.toLowerCase()
      );

      // Extract metric values
      const metricValues: MatchedRow["metricValues"] = [];
      for (const [header, metricId] of Object.entries(metricMapping)) {
        const raw = row[header];
        const val = parseFloat(raw);
        if (!isNaN(val) && metricId) {
          const metric = metrics.find((m) => m.id === metricId);
          metricValues.push({ metricId, metricName: metric?.name || header, value: val });
        }
      }

      return {
        rowIndex: i,
        firstName,
        lastName,
        matchedPlayer: match || null,
        createNew: !match && createMissing,
        metricValues,
      };
    }).filter((r) => r.firstName && r.lastName);

    setMatchedRows(matched);
  };

  const proceedToPreview = () => {
    buildMatchedRows();
    setStep("preview");
  };

  // Get columns that have metric mappings
  const mappedMetricHeaders = headers.filter((h) => {
    const lower = h.toLowerCase().trim();
    return !["first name", "last name", "first_name", "last_name", "firstname", "lastname", "name",
             "grade", "position", "pos", "jersey", "number", "#", "bats", "throws", "first", "last", "surname"]
      .some((t) => lower.includes(t));
  });

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
      const playerIdMap = new Map<number, string>(); // rowIndex -> playerId

      // Phase 1: Create new players
      const newPlayers = matchedRows.filter((r) => !r.matchedPlayer && r.createNew);
      if (newPlayers.length > 0) {
        const { data: inserted, error } = await supabase.from("players").insert(
          newPlayers.map((r) => ({
            program_id: coach.program_id,
            first_name: r.firstName,
            last_name: r.lastName,
            positions: [],
          }))
        ).select("id, first_name, last_name");

        if (error) { toast.error(`Failed to create players: ${error.message}`); setImporting(false); return; }

        // Map created players back to rows
        (inserted || []).forEach((p, i) => {
          playerIdMap.set(newPlayers[i].rowIndex, p.id);
        });
        createdPlayers = inserted?.length || 0;
      }

      // Map existing matched players
      matchedRows.forEach((r) => {
        if (r.matchedPlayer) playerIdMap.set(r.rowIndex, r.matchedPlayer.id);
      });

      // Phase 2: Insert evaluations
      const evals: { program_id: string; player_id: string; metric_id: string; coach_id: string; value: number; attempt_number: number }[] = [];
      for (const row of matchedRows) {
        const playerId = playerIdMap.get(row.rowIndex);
        if (!playerId || row.metricValues.length === 0) continue;

        for (const mv of row.metricValues) {
          evals.push({
            program_id: coach.program_id,
            player_id: playerId,
            metric_id: mv.metricId,
            coach_id: coach.id,
            value: mv.value,
            attempt_number: 1,
          });
        }
      }

      if (evals.length > 0) {
        // Batch in chunks of 500
        for (let i = 0; i < evals.length; i += 500) {
          const chunk = evals.slice(i, i + 500);
          const { error } = await supabase.from("evaluations").insert(chunk);
          if (error) { toast.error(`Failed to import evaluations: ${error.message}`); setImporting(false); return; }
          insertedEvals += chunk.length;
        }
      }

      setImportResult({ players: createdPlayers, evals: insertedEvals });
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
                onClick={() => setStep("map_metrics")}
              >
                Next: Map Metrics
              </Button>
            </div>
          </div>
        )}

        {step === "map_metrics" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map spreadsheet columns to your metrics. Unmapped columns will be skipped.
            </p>
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {mappedMetricHeaders.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <Label className="w-32 text-sm shrink-0 truncate" title={header}>{header}</Label>
                  <Select value={metricMapping[header] || "__none__"}
                    onValueChange={(v) => setMetricMapping({ ...metricMapping, [header]: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className="h-10 rounded-lg flex-1"><SelectValue placeholder="Skip" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip —</SelectItem>
                      {metrics.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {Object.values(metricMapping).filter(Boolean).length === 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Map at least one column to a metric to import data.
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
                disabled={Object.values(metricMapping).filter(Boolean).length === 0}
                onClick={proceedToPreview}
              >
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {/* Summary stats */}
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

            {skippedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {skippedCount} player{skippedCount > 1 ? "s" : ""} not matched and will be skipped.
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
