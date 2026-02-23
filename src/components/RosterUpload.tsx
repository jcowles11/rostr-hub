import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface RosterUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ColumnMapping = {
  first_name: string;
  last_name: string;
  grade: string;
  positions: string;
  jersey_number_preference: string;
  bats: string;
  throws: string;
};

const PLAYER_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name", required: true },
  { key: "grade", label: "Grade", required: false },
  { key: "positions", label: "Position(s)", required: false },
  { key: "jersey_number_preference", label: "Jersey #", required: false },
  { key: "bats", label: "Bats", required: false },
  { key: "throws", label: "Throws", required: false },
];

function guessMapping(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (terms: string[]) => {
    const idx = lower.findIndex((h) => terms.some((t) => h.includes(t)));
    return idx >= 0 ? headers[idx] : "";
  };
  return {
    first_name: find(["first name", "first_name", "firstname", "first"]),
    last_name: find(["last name", "last_name", "lastname", "last", "surname"]),
    grade: find(["grade", "year", "class"]),
    positions: find(["position", "pos"]),
    jersey_number_preference: find(["jersey", "number", "#", "num"]),
    bats: find(["bats", "bat"]),
    throws: find(["throws", "throw", "arm"]),
  };
}

export default function RosterUpload({ open, onOpenChange, onSuccess }: RosterUploadProps) {
  const { coach } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    first_name: "", last_name: "", grade: "", positions: "", jersey_number_preference: "", bats: "", throws: "",
  });
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({ first_name: "", last_name: "", grade: "", positions: "", jersey_number_preference: "", bats: "", throws: "" });
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

  const mappedPlayers = rows.map((row) => ({
    first_name: (row[mapping.first_name] || "").trim(),
    last_name: (row[mapping.last_name] || "").trim(),
    grade: mapping.grade ? parseInt(row[mapping.grade]) || null : null,
    positions: mapping.positions
      ? (row[mapping.positions] || "").split(/[,\/;]/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [],
    jersey_number_preference: mapping.jersey_number_preference ? parseInt(row[mapping.jersey_number_preference]) || null : null,
    bats: mapping.bats ? (row[mapping.bats] || "").trim().substring(0, 1).toUpperCase() || null : null,
    throws: mapping.throws ? (row[mapping.throws] || "").trim().substring(0, 1).toUpperCase() || null : null,
  })).filter((p) => p.first_name && p.last_name);

  const handleImport = async () => {
    if (!coach || importing) return;
    setImporting(true);

    const toInsert = mappedPlayers.map((p) => ({
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

            {(!mapping.first_name || !mapping.last_name) && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                First Name and Last Name mappings are required.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={reset}>Back</Button>
              <Button
                className="flex-1 h-11 rounded-xl gradient-primary border-0 font-bold"
                disabled={!mapping.first_name || !mapping.last_name}
                onClick={() => setStep("preview")}
              >
                Preview ({mappedPlayers.length} players)
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ready to import <span className="font-semibold text-foreground">{mappedPlayers.length}</span> players:
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-xl border p-3">
              {mappedPlayers.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{p.last_name}, {p.first_name}</span>
                  {p.grade && <Badge variant="secondary" className="text-[10px] h-4">{p.grade}th</Badge>}
                  {p.positions?.map((pos) => (
                    <Badge key={pos} variant="outline" className="text-[10px] h-4">{pos}</Badge>
                  ))}
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
                disabled={importing || mappedPlayers.length === 0}
                onClick={handleImport}
              >
                {importing ? "Importing..." : `Import ${mappedPlayers.length} Players`}
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
