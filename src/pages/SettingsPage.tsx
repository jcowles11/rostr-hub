import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Share2, User, Shield, Calendar, SlidersHorizontal, Upload, Database, Download, Users, Layers, Eye, Image, ChevronRight, ChevronDown, Clock } from "lucide-react";
import ProgramLogoUpload from "@/components/ProgramLogoUpload";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LevelsManager from "@/components/LevelsManager";
import VisibilityManager from "@/components/VisibilityManager";
import CoachManager from "@/components/CoachManager";
import MetricsManager from "@/components/MetricsManager";
import SeasonsManager from "@/components/SeasonsManager";
import RosterUpload from "@/components/RosterUpload";
import DataImport from "@/components/DataImport";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

interface MenuTile {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  action: "navigate" | "dialog" | "expand";
  target?: string;
  expandKey?: string;
}

function TileButton({ icon, label, subtitle, onClick, trailing }: {
  icon: React.ReactNode; label: string; subtitle?: string; onClick: () => void; trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl bg-card border px-4 py-3.5 text-left transition-all hover:shadow-sm hover:border-primary/20 active:scale-[0.99]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {trailing}
    </button>
  );
}

export default function SettingsPage() {
  const { coach, signOut, refreshCoach } = useAuth();
  const navigate = useNavigate();
  const [regCode, setRegCode] = useState("");
  const [editingCode, setEditingCode] = useState(false);
  const [editRegCode, setEditRegCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [programName, setProgramName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Dialogs
  const [rosterOpen, setRosterOpen] = useState(false);
  const [dataImportOpen, setDataImportOpen] = useState(false);

  // Expandable sections
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = (key: string) => setExpanded(expanded === key ? null : key);

  useEffect(() => {
    if (!coach) return;
    setProgramName(coach.program_name || "");
    supabase.from("programs").select("registration_code").eq("id", coach.program_id).single().then(({ data }) => {
      if (data) setRegCode(data.registration_code);
    });
  }, [coach]);

  const copyRegLink = () => {
    const link = `${window.location.origin}/register/${regCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Registration link copied! (for new players)");
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${regCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied! (for existing players)");
  };

  const handleSaveCode = async () => {
    if (!coach || !editRegCode.trim()) return;
    const cleaned = editRegCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    if (cleaned.length < 3) {
      toast.error("Code must be at least 3 characters");
      return;
    }
    setSavingCode(true);
    const { error } = await supabase
      .from("programs")
      .update({ registration_code: cleaned })
      .eq("id", coach.program_id);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That code is already taken" : "Failed to update code");
    } else {
      setRegCode(cleaned);
      toast.success("Registration code updated!");
      setEditingCode(false);
    }
    setSavingCode(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleSaveName = async () => {
    if (!coach || !programName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from("programs")
      .update({ name: programName.trim() })
      .eq("id", coach.program_id);
    if (error) {
      toast.error("Failed to update program name");
    } else {
      toast.success("Program name updated!");
      await refreshCoach();
    }
    setSavingName(false);
    setEditingName(false);
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24 space-y-5 animate-fade-in">
      {/* Hero */}
      <div className="page-hero">
        <div className="flex items-center gap-3">
          {coach?.logo_url ? (
            <img src={coach.logo_url} alt="Program logo" className="h-12 w-12 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
              <User className="h-6 w-6" />
            </div>
          )}
          <div>
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="h-8 w-40 bg-white/20 border-white/30 text-white placeholder:text-white/50 text-sm font-bold rounded-lg"
                  autoFocus
                  disabled={savingName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") { setEditingName(false); setProgramName(coach?.program_name || ""); }
                  }}
                />
                <button onClick={handleSaveName} disabled={savingName} className="p-1 rounded-md hover:bg-white/20 text-white">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => { setEditingName(false); setProgramName(coach?.program_name || ""); }} className="p-1 rounded-md hover:bg-white/20 text-white/70">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-extrabold text-white">{coach?.program_name || coach?.full_name}</h1>
                <button onClick={() => setEditingName(true)} className="p-1 rounded-md hover:bg-white/20 text-white/60 hover:text-white transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-white/70" />
              <span className="text-white/70 text-sm">{coach?.role === "head_coach" ? "Head Coach" : "Assistant Coach"} · {coach?.full_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TRYOUT PLANNING */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Tryout Planning</p>
        <div className="space-y-1.5">
          <TileButton
            icon={<Calendar className="h-4 w-4" />}
            label="Tryout Planner"
            subtitle="Sessions, metrics & attempts overview"
            onClick={() => navigate("/plan")}
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <TileButton
            icon={<Layers className="h-4 w-4" />}
            label="Roster Board"
            subtitle="Drag & drop roster assignments"
            onClick={() => navigate("/roster-board")}
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <TileButton
            icon={<SlidersHorizontal className="h-4 w-4" />}
            label="Metrics & Drills"
            subtitle={`${expanded === "metrics" ? "Collapse" : "Configure scoring metrics"}`}
            onClick={() => toggleExpand("metrics")}
            trailing={expanded === "metrics" ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        {expanded === "metrics" && (
          <div className="rounded-2xl border bg-card p-4 animate-fade-in">
            <MetricsManager />
          </div>
        )}
      </div>

      {/* DATA */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Data</p>
        <div className="space-y-1.5">
          <TileButton
            icon={<Upload className="h-4 w-4" />}
            label="Import Roster"
            subtitle="Upload players from CSV or Excel"
            onClick={() => setRosterOpen(true)}
          />
          <TileButton
            icon={<Database className="h-4 w-4" />}
            label="Import Scores"
            subtitle="Upload tryout data from spreadsheet"
            onClick={() => setDataImportOpen(true)}
          />
          <TileButton
            icon={<Download className="h-4 w-4" />}
            label="Export & Reports"
            subtitle="Download data and generate reports"
            onClick={() => navigate("/export")}
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* PROGRAM */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Program</p>
        <div className="space-y-1.5">
          <TileButton
            icon={<Users className="h-4 w-4" />}
            label="Coaching Staff"
            subtitle={`${expanded === "coaches" ? "Collapse" : "Manage assistant coaches"}`}
            onClick={() => toggleExpand("coaches")}
            trailing={expanded === "coaches" ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          {expanded === "coaches" && (
            <div className="rounded-2xl border bg-card p-4 animate-fade-in">
              <CoachManager />
            </div>
          )}

          <TileButton
            icon={<Layers className="h-4 w-4" />}
            label="Team Levels"
            subtitle={`${expanded === "levels" ? "Collapse" : "Varsity, JV, Freshman, etc."}`}
            onClick={() => toggleExpand("levels")}
            trailing={expanded === "levels" ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          {expanded === "levels" && (
            <div className="animate-fade-in">
              <LevelsManager />
            </div>
          )}

          <TileButton
            icon={<Clock className="h-4 w-4" />}
            label="Seasons"
            subtitle={`${expanded === "seasons" ? "Collapse" : "Manage seasons & years"}`}
            onClick={() => toggleExpand("seasons")}
            trailing={expanded === "seasons" ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          {expanded === "seasons" && (
            <div className="rounded-2xl border bg-card p-4 animate-fade-in">
              <SeasonsManager />
            </div>
          )}

          <TileButton
            icon={<Eye className="h-4 w-4" />}
            label="Player Visibility"
            subtitle={`${expanded === "visibility" ? "Collapse" : "Control what players see"}`}
            onClick={() => toggleExpand("visibility")}
            trailing={expanded === "visibility" ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          {expanded === "visibility" && (
            <div className="animate-fade-in">
              <VisibilityManager />
            </div>
          )}

          <TileButton
            icon={<Image className="h-4 w-4" />}
            label="Program Logo"
            subtitle={`${expanded === "logo" ? "Collapse" : "Upload or change your logo"}`}
            onClick={() => toggleExpand("logo")}
            trailing={expanded === "logo" ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          {expanded === "logo" && (
            <div className="rounded-2xl border bg-card p-4 flex justify-center animate-fade-in">
              <ProgramLogoUpload />
            </div>
          )}

          <TileButton
            icon={<Share2 className="h-4 w-4" />}
            label="Registration Code"
            subtitle={`Code: ${regCode}`}
            onClick={() => toggleExpand("regcode")}
            trailing={expanded === "regcode" ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          {expanded === "regcode" && (
            <div className="rounded-2xl border bg-card p-4 space-y-3 animate-fade-in">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Current Code</p>
                {editingCode ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editRegCode}
                      onChange={(e) => setEditRegCode(e.target.value)}
                      placeholder="e.g. eagles-baseball"
                      className="h-9 rounded-lg text-sm font-mono"
                      autoFocus
                    />
                    <Button size="sm" className="h-9 rounded-lg" onClick={handleSaveCode} disabled={savingCode}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => setEditingCode(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{regCode}</code>
                    <button onClick={() => { setEditRegCode(regCode); setEditingCode(true); }} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Customize this to make it easier for players to type (e.g. "eagles-baseball")</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs rounded-lg" onClick={copyRegLink}>
                  Copy Registration Link
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs rounded-lg" onClick={copyInviteLink}>
                  Copy Invite Link
                </Button>
              </div>
            </div>
          )}
          <TileButton
            icon={<Users className="h-4 w-4" />}
            label="Invite Existing Player"
            subtitle="Link for players who already have an account"
            onClick={copyInviteLink}
          />
        </div>
      </div>

      {/* ACCOUNT */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Account</p>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-left transition-all hover:bg-destructive/10 active:scale-[0.99]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <LogOut className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-destructive">Sign Out</p>
        </button>
      </div>

      {/* Dialogs */}
      <RosterUpload open={rosterOpen} onOpenChange={setRosterOpen} onSuccess={() => toast.success("Roster imported!")} />
      <DataImport open={dataImportOpen} onOpenChange={setDataImportOpen} onSuccess={() => toast.success("Data imported!")} />
    </div>
  );
}
