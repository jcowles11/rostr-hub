"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, User, Building2, Users } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createProgramAction({
      fullName: fullName.trim(),
      programName: programName.trim(),
      schoolName: schoolName.trim(),
      sport,
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
            placeholder="Lincoln HS Baseball"
            className="flex-1 bg-transparent outline-none text-[13.5px]"
          />
        </div>
        <p className="text-[11px] text-ink-3 mt-1">
          The full program name including level range (Varsity, JV, Frosh). You can rename
          this later.
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
