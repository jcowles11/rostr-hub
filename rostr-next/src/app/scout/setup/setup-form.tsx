"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { createRecruiterAction } from "../actions";

const DIVISIONS = [
  { value: "d1", label: "NCAA D1" },
  { value: "d2", label: "NCAA D2" },
  { value: "d3", label: "NCAA D3" },
  { value: "naia", label: "NAIA" },
  { value: "juco", label: "JUCO" },
  { value: "pro", label: "Pro / MLB" },
  { value: "club", label: "Club / private scout" },
  { value: "other", label: "Other" },
] as const;

export function RecruiterSetupForm({
  defaultFullName,
}: {
  defaultFullName: string;
}) {
  const [fullName, setFullName] = useState(defaultFullName);
  const [orgName, setOrgName] = useState("");
  const [division, setDivision] = useState<(typeof DIVISIONS)[number]["value"]>("d1");
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createRecruiterAction({
        fullName,
        organizationName: orgName,
        organizationDivision: division,
        title,
        region,
        sport: "Baseball",
      });
      if (r.error) setError(r.error);
    });
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Field label="Your name">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Rebecca Lee"
          required
          className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
        />
      </Field>

      <Field label="Organization you're recruiting for">
        <input
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="University of Texas"
          required
          className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Division / level">
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value as typeof division)}
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
          >
            {DIVISIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Recruiting Coordinator"
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
          />
        </Field>
      </div>

      <Field label="Recruiting region (optional)" hint="Helps us surface relevant searches on day 1">
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Southwest · Texas, Oklahoma, Louisiana"
          className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
        />
      </Field>

      <button
        type="submit"
        disabled={isPending}
        className="w-full inline-flex items-center justify-center h-[44px] bg-red hover:bg-red/90 disabled:bg-red/60 text-white rounded-sm text-[14px] font-semibold transition-colors mt-2"
      >
        {isPending ? "Creating…" : "Start scouting →"}
      </button>

      <p className="text-[11px] text-ink-3 text-center leading-relaxed">
        You can update any of this later from Settings. We&apos;ll verify your
        organization before unlocking contact features.
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="type-label mb-1.5 block">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-ink-3 mt-1">{hint}</div>}
    </div>
  );
}
