"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, User, Building2, Users, X, Plus } from "lucide-react";
import { createProgramAction } from "./actions";
import { cn } from "@/lib/utils";

const SPORTS = [
  { key: "baseball", label: "Baseball" },
  { key: "softball", label: "Softball" },
  { key: "football", label: "Football" },
  { key: "basketball", label: "Basketball" },
  { key: "volleyball", label: "Volleyball" },
  { key: "soccer", label: "Soccer" },
];

export function SetupForm({
  defaultName,
  defaultProgram,
}: {
  defaultName: string;
  defaultProgram: string;
}) {
  const [fullName, setFullName] = useState(defaultName);
  const [programName, setProgramName] = useState(defaultProgram);
  const [schoolName, setSchoolName] = useState(
    defaultProgram.split(" · ")[0] ?? defaultProgram,
  );
  const [sport, setSport] = useState("baseball");
  // Teams within the program. A single-team coach only needs one entry
  // (e.g. "JV"). A school running multiple levels adds each one.
  // Defaults to a single "Varsity" line so the happy path is just "keep typing."
  const [teams, setTeams] = useState<string[]>(["Varsity"]);
  const [newTeam, setNewTeam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addTeam = () => {
    const t = newTeam.trim();
    if (!t) return;
    if (teams.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setNewTeam("");
      return;
    }
    setTeams([...teams, t]);
    setNewTeam("");
  };
  const removeTeam = (t: string) => {
    if (teams.length <= 1) return; // always keep at least one
    setTeams(teams.filter((x) => x !== t));
  };
  const renameTeam = (index: number, value: string) => {
    const next = [...teams];
    next[index] = value;
    setTeams(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanTeams = teams.map((t) => t.trim()).filter((t) => t.length > 0);
    if (cleanTeams.length === 0) {
      setError("Add at least one team (e.g. Varsity, or your team name).");
      return;
    }
    setLoading(true);
    const result = await createProgramAction({
      fullName: fullName.trim(),
      programName: programName.trim(),
      schoolName: schoolName.trim(),
      sport,
      levels: cleanTeams,
    });
    // Server action redirects on success; if we hit here, there was an error.
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="type-label mb-1.5 block">Your name</label>
        <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
          <User className="w-3.5 h-3.5 text-ink-3" />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Coach Martinez"
            className="flex-1 bg-transparent outline-none text-[13.5px]"
            autoComplete="name"
          />
        </div>
      </div>

      <div>
        <label className="type-label mb-1.5 block">School or organization</label>
        <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
          <Building2 className="w-3.5 h-3.5 text-ink-3" />
          <input
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            required
            placeholder="Lincoln High School"
            className="flex-1 bg-transparent outline-none text-[13.5px]"
          />
        </div>
      </div>

      <div>
        <label className="type-label mb-1.5 block">Program name</label>
        <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
          <Users className="w-3.5 h-3.5 text-ink-3" />
          <input
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            required
            placeholder="Heritage HS Baseball"
            className="flex-1 bg-transparent outline-none text-[13.5px]"
          />
        </div>
        <p className="text-[11px] text-ink-3 mt-1">
          The umbrella name — you&apos;ll add the individual teams below.
        </p>
      </div>

      <div>
        <label className="type-label mb-1.5 block">Your teams</label>
        <div className="space-y-2">
          {teams.map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2 focus-within:border-red"
            >
              <input
                value={t}
                onChange={(e) => renameTeam(i, e.target.value)}
                placeholder="e.g. Varsity, JV, 9th Grade, or just your team name"
                className="flex-1 bg-transparent outline-none text-[13.5px]"
              />
              {teams.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTeam(t)}
                  className="text-ink-3 hover:text-red"
                  aria-label={`Remove ${t}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 bg-paper border border-dashed border-hair rounded-sm px-3 py-2">
            <Plus className="w-3.5 h-3.5 text-ink-3" />
            <input
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTeam();
                }
              }}
              placeholder="Add another team (optional)"
              className="flex-1 bg-transparent outline-none text-[13.5px]"
            />
            {newTeam.trim() && (
              <button
                type="button"
                onClick={addTeam}
                className="text-[11.5px] font-semibold text-red hover:text-red/80"
              >
                Add
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-ink-3 mt-1.5 leading-relaxed">
          Only running one team? Just name it (e.g. &quot;Heritage JV&quot;) and move on.
          You can always add more later from Settings.
        </p>
      </div>

      <div>
        <label className="type-label mb-1.5 block">Sport</label>
        <div className="grid grid-cols-3 gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSport(s.key)}
              className={cn(
                "px-3 py-2.5 rounded-sm border text-center transition-all text-[13px] font-semibold",
                sport === s.key
                  ? "border-red bg-red-soft text-ink shadow-[0_0_0_3px_var(--red-soft)]"
                  : "border-hair bg-card text-ink-2 hover:border-ink-3",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 h-[44px] bg-red hover:bg-red/90 text-white rounded-sm text-[14px] font-semibold transition-colors mt-3 disabled:opacity-60"
      >
        {loading ? "Creating your program…" : <>Create program <ArrowRight className="w-4 h-4" /></>}
      </button>
    </form>
  );
}
