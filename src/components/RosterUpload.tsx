import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, FileSpreadsheet, AlertCircle, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { normalizeHeader, splitFullName, splitBatsThrows } from "@/lib/importUtils";
import { fetchPlayerNames, buildPlayerNameIndex } from "@/services/playerService";
import { track } from "@/services/analyticsService";

interface RosterUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ColumnMapping = {
  player_name: string;
  first_name: string;
  last_name: string;
  grade: string;
  positions: string;
  jersey_number_preference: string;
  bats_throws: string;
  bats: string;
  throws: string;
};

const PLAYER_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean; hint?: string }[] = [
  { key: "player_name", label: "Full Name", required: false, hint: "Single column with first & last name" },
  { key: "first_name", label: "First Name", required: false },
  { key: "last_name", label: "Last Name", required: false },
  { key: "grade", label: "Grade", required: false },
  { key: "positions", label: "Position(s)", required: false },
  { key: "jersey_number_preference", label: "Jersey #", required: false },
  { key: "bats_throws", label: "B/T", required: false, hint: "Combined bats/throws (e.g. R/R)" },
  { key: "bats", label: "Bats", required: false },
  { key: "throws", label: "Throws", required: false },
];

function guessMapping(headers: string[]): ColumnMapping {
  const find = (terms: string[]) => {
    const idx = headers.findIndex((h) => {
      const norm = normalizeHeader(h);
      return terms.some((t) => norm === t || norm.includes(t));
    });
    return idx >= 0 ? headers[idx] : "";
  };

  const playerName = find(["player name", "playername", "full name", "fullname", "athlete name", "athlete", "name"]);
  const firstName = find(["first name", "firstname", "first"]);
  const lastName = find(["last name", "lastname", "last", "surname"]);

  const batsThrows = find(["b/t", "b t", "bats/throws", "bats throws", "bats-throws", "bat/throw"]);
  const bats = find(["bats", "bat"]);
  const throws_ = find(["throws", "throw", "arm"]);

  return {
    player_name: !firstName && !lastName ? playerName : "",
    first_name: firstName,
    last_name: lastName,
    grade: find(["grade", "year", "class"]),
    positions: find(["position", "pos"]),
    jersey_number_preference: find(["jersey", "number", "#", "num"]),
    bats_throws: !bats && !throws_ ? batsThrows : "",
    bats: bats,
    throws: throws_,
  };
}

export default function RosterUpload({ open, onOpenChange, onSuccess }: RosterUploadProps) {
  const { coach } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    player_name: "", first_name: "", last_name: "", grade: "", positions: "", jersey_number_preference: "", bats_throws: "", bats: "", throws: "",
  });
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [existingNameIndex, setExistingNameIndex] = useState<Set<string>>(new Set());

  // Fetch existing player names when dialog opens for duplicate detection
  useEffect(() => {
    if (open && coach?.program_id) {
      fetchPlayerNames(coach.program_id).then(({ data }) => {
        setExistingNameIndex(buildPlayerNameIndex(data));
      });
    }
  }, [open, coach?.program_id]);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({ player_name: "", first_name: "", last_name: "", grade: "", positions: "", jersey_number_preference: "", bats_throws: "", bats: "", throws: "" });
    setImporting(false);
    setImportCount(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const parseFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (!result.data.length || !result.meta.fields?.length) {
            toast.error("No data found in file");
            return;
          }
          setHeaders(result.meta.fields);
          setRows(result.data as Record<string, string>[]);
          setMapping(guessMapping(result.meta.fields));
          setStep("map");
        },
        error: () => toast.error("Failed to parse CSV file"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
          if (!json.length) { toast.error("No data found in file"); return; }
          const hdrs = Object.keys(json[0]);
          setHeaders(hdrs);
          setRows(json.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))));
          setMapping(guessMapping(hdrs));
          setStep("map");
        } catch {
          toast.error("Failed to parse Excel file");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Please upload a .csv, .xlsx, or .xls file");
    }
  };

  const useFullName = !!mapping.player_name && !mapping.first_name && !mapping.last_name;
  const hasValidNameMapping = useFullName || (!!mapping.first_name && !!mapping.last_name);

  const mappedPlayers = rows.map((row) => {
    let firstName: string, lastName: string;
    if (useFullName) {
      const split = splitFullName(row[mapping.player_name] || "");
      firstName = split.first;
      lastName = split.last;
    } else {
      firstName = (row[mapping.first_name] || "").trim();
      lastName = (row[mapping.last_name] || "").trim();
    }
    return {
      first_name: firstName,
      last_name: lastName,
      grade: mapping.grade ? parseInt(row[mapping.grade]) || null : null,
      positions: mapping.positions
        ? (row[mapping.positions] || "").split(/[,\/;]/).map((s) => s.trim().toUpperCase()).filter(Boolean)
        : [],
      jersey_number_preference: mapping.jersey_number_preference ? parseInt(row[mapping.jersey_number_preference]) || null : null,
      bats: (() => {
        if (mapping.bats_throws && !mapping.bats && !mapping.throws) {
          return splitBatsThrows(row[mapping.bats_throws] || "").bats || null;
        }
        return mapping.bats ? (row[mapping.bats] || "").trim().substring(0, 1).toUpperCase() || null : null;
      })(),
      throws: (() => {
        if (mapping.bats_throws && !mapping.bats && !mapping.throws) {
          return splitBatsThrows(row[mapping.bats_throws] || "").throws || null;
        }
        return mapping.throws ? (row[mapping.throws] || "").trim().substring(0, 1).toUpperCase() || null : null;
      })(),
    };
  }).filter((p) => p.first_name && p.last_name);

  // Duplicate detection: mark each player as existing-duplicate or within-file-duplicate
  const playerDuplicateInfo = mappedPlayers.map((p, i) => {
    const key = `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}`;
    const isExistingDuplicate = existingNameIndex.has(key);
    // Check if an earlier row in this file has the same name
    const isFileDuplicate = mappedPlayers.findIndex((other) =>
      other.first_name.trim().toLowerCase() === p.first_name.trim().toLowerCase() &&
      other.last_name.trim().toLowerCase() === p.last_name.trim().toLowerCase()
    ) < i;
    return { ...p, isExistingDuplicate, isFileDuplicate, isDuplicate: isExistingDuplicate || isFileDuplicate };
  });

  const duplicateCount = playerDuplicateInfo.filter((p) => p.isDuplicate).length;
  const newPlayerCount = playerDuplicateInfo.filter((p) => !p.isDuplicate).length;
  const playersToImport = skipDuplicates
    ? playerDuplicateInfo.filter((p) => !p.isDuplicate)
    : playerDuplicateInfo;

  const handleImport = async () => {
    if (!coach || importing || playersToImport.length === 0) return;
    setImporting(true);

    const toInsert = playersToImport.map((p) => ({
      program_id: coach.program_id,
      first_name: p.first_name,
      last_name: p.last_name,
      grade: p.grade,
      positions: p.positions.length > 0 ? p.positions : [],
      jersey_number_preference: p.jersey_number_preference,
      bats: p.bats,
      throws: p.throws,
    }));

    const { error } = await supabase.from("players").insert(toInsert);
    if (error) {
      toast.error(`Import failed: ${error.message}`);
      setImporting(false);
    } else {
      setImportCount(toInsert.length);
      setStep("done");
      setImporting(false);
      if (coach) track("roster_import", coach.program_id, coach.id, { count: toInsert.length, source: "roster_upload" });
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import Roster
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a spreadsheet (.csv, .xlsx, .xls) with your player roster. Include columns for first name, last name, and optionally grade, position, jersey number, etc.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) parseFile(file);
              }}
            />
            <Button
              variant="outline"
              className="w-full h-32 rounded-xl border-dashed border-2 flex flex-col gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="font-semibold">Choose File</span>
              <span className="text-xs text-muted-foreground">CSV, Excel (.xlsx, .xls)</span>
            </Button>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We found <span className="font-semibold text-foreground">{rows.length}</span> rows. Map your columns to player fields:
            </p>
            <div className="space-y-3">
              {PLAYER_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <Label className="w-24 text-sm shrink-0">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Select
                    value={mapping[field.key] || "__none__"}
                    onValueChange={(v) => setMapping({ ...mapping, [field.key]: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className="h-10 rounded-lg flex-1">
                      <SelectValue placeholder="Skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
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
              <Button
                className="flex-1 h-11 rounded-xl gradient-primary border-0 font-bold"
                disabled={!hasValidNameMapping}
                onClick={() => setStep("preview")}
              >
                Preview ({mappedPlayers.length} player{mappedPlayers.length !== 1 ? "s" : ""})
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found <span className="font-semibold text-foreground">{mappedPlayers.length}</span> players in file.
              {duplicateCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {" "}{duplicateCount} already on roster.
                </span>
              )}
            </p>

            {duplicateCount > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Skip {duplicateCount} duplicate{duplicateCount !== 1 ? "s" : ""}?</span>
                </div>
                <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-xl border p-3">
              {playerDuplicateInfo.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm ${
                    p.isDuplicate && skipDuplicates ? "opacity-40 line-through" : ""
                  }`}
                >
                  <span className="font-medium">{p.last_name}, {p.first_name}</span>
                  {p.grade && <Badge variant="secondary" className="text-[10px] h-4">{p.grade}th</Badge>}
                  {p.positions?.map((pos) => (
                    <Badge key={pos} variant="outline" className="text-[10px] h-4">{pos}</Badge>
                  ))}
                  {p.isExistingDuplicate && (
                    <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-300">
                      <Users className="h-2.5 w-2.5 mr-0.5" />on roster
                    </Badge>
                  )}
                  {p.isFileDuplicate && !p.isExistingDuplicate && (
                    <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-300">
                      duplicate in file
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {mappedPlayers.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No valid players found. Check your column mappings.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep("map")}>Back</Button>
              <Button
                className="flex-1 h-11 rounded-xl gradient-primary border-0 font-bold"
                disabled={importing || playersToImport.length === 0}
                onClick={handleImport}
              >
                {importing ? "Importing..." : `Import ${playersToImport.length} Player${playersToImport.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="text-lg font-bold">Import Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Successfully imported {importCount} player{importCount !== 1 ? "s" : ""}.
                {duplicateCount > 0 && skipDuplicates && (
                  <span className="block mt-0.5 text-amber-600 dark:text-amber-400">
                    {duplicateCount} duplicate{duplicateCount !== 1 ? "s" : ""} skipped.
                  </span>
                )}
              </p>
            </div>
            <Button className="w-full h-11 rounded-xl font-bold" onClick={() => handleClose(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
