"use client";

import { useState, useTransition } from "react";
import { Bell, User, Users, Shield, Zap, Database, Link2, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Toggle } from "@/components/atoms/toggle";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";
import { updateProgramAction, updateCoachNameAction } from "./actions";

/**
 * /app/settings — Coach settings stub.
 */
const SECTIONS = [
  { label: "Program", icon: <Users className="w-4 h-4" /> },
  { label: "Team defaults", icon: <User className="w-4 h-4" /> },
  { label: "Coaches", icon: <Users className="w-4 h-4" /> },
  { label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { label: "Integrations", icon: <Link2 className="w-4 h-4" /> },
  { label: "Data & privacy", icon: <Shield className="w-4 h-4" /> },
  { label: "AI Co-coach", icon: <Zap className="w-4 h-4" /> },
  { label: "Advanced", icon: <Database className="w-4 h-4" /> },
];

export interface SettingsViewProps {
  hasCoach: boolean;
  programName: string;
  coachName: string;
  sport: string;
  levels: string[];
  logoInitials: string;
}

export function SettingsView({
  hasCoach,
  programName,
  coachName,
  sport,
  levels,
  logoInitials,
}: SettingsViewProps) {
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: false,
    recruiter: true,
  });
  const [activeSection, setActiveSection] = useState("Program");

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: programName }, { label: "Settings" }]}
        actions={[{ kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") }]}
      />
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[240px_1fr] max-w-layout-hub mx-auto">
          <nav className="border-r border-hair py-8 px-4 space-y-0.5">
            <div className="type-label mb-3 px-2">Settings</div>
            {SECTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setActiveSection(s.label);
                  if (s.label !== "Program") {
                    comingSoon(`Settings · ${s.label}`, "Section lands in the next sprint.");
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[13px] font-medium transition-colors text-left",
                  activeSection === s.label ? "bg-paper-deep text-ink" : "text-ink-2 hover:text-ink hover:bg-paper",
                )}
              >
                <span className="text-ink-3">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          <div className="px-10 py-8 max-w-[720px]">
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Program
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1 mb-8">
              Your team identity, logo, and program-wide defaults.
            </p>

            {!hasCoach && (
              <div className="mb-6 flex items-start gap-2 p-3 rounded-sm bg-amber-soft text-amber text-[12.5px]">
                <span className="font-semibold">Demo mode.</span>
                <span>
                  Editing is read-only until you <a href="/app/setup" className="underline font-semibold">set up your program</a>.
                </span>
              </div>
            )}
            <div className="space-y-6">
              <EditableField
                label="Program name"
                initialValue={programName}
                readOnly={!hasCoach}
                onSave={async (v) => (await updateProgramAction({ name: v })).error}
              />
              <EditableField
                label="Head coach"
                initialValue={coachName}
                readOnly={!hasCoach}
                onSave={async (v) => (await updateCoachNameAction(v)).error}
              />
              <div>
                <div className="type-label mb-2">Team logo</div>
                <div className="flex items-center gap-4">
                  <Avatar size="lg" color="red" initials={logoInitials} />
                  <button
                    onClick={() => comingSoon("Upload logo", "Image upload + crop — next sprint.")}
                    className="px-3 py-2 bg-card border border-hair rounded-sm text-[13px] font-semibold hover:border-ink"
                  >
                    Upload logo
                  </button>
                </div>
              </div>
              <EditableField
                label="Primary sport"
                initialValue={sport}
                readOnly={!hasCoach}
                onSave={async (v) => (await updateProgramAction({ sport: v })).error}
              />
              <EditableField
                label="Levels"
                initialValue={levels.join(" · ")}
                readOnly={!hasCoach}
                onSave={async (v) => {
                  const list = v.split(/[·,]/).map((x) => x.trim()).filter(Boolean);
                  return (await updateProgramAction({ levels: list })).error;
                }}
                hint="Comma- or bullet-separated list (e.g. Varsity · JV · Freshman)"
              />

              <div className="pt-4 border-t border-hair">
                <div className="type-label mb-4">Notifications</div>
                <div className="space-y-3">
                  <ToggleRow
                    label="Email digests"
                    sub="Daily summary of activity across your program"
                    value={notifications.email}
                    onChange={(v) => setNotifications({ ...notifications, email: v })}
                  />
                  <ToggleRow
                    label="SMS for urgent"
                    sub="Practice cancellations, game-day reminders"
                    value={notifications.sms}
                    onChange={(v) => setNotifications({ ...notifications, sms: v })}
                  />
                  <ToggleRow
                    label="Push notifications"
                    sub="Mobile app notifications for messages and alerts"
                    value={notifications.push}
                    onChange={(v) => setNotifications({ ...notifications, push: v })}
                  />
                  <ToggleRow
                    label="Recruiter views · weekly"
                    sub="Bundle of college coach profile views"
                    value={notifications.recruiter}
                    onChange={(v) => setNotifications({ ...notifications, recruiter: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function EditableField({
  label,
  initialValue,
  onSave,
  hint,
  readOnly,
}: {
  label: string;
  initialValue: string;
  onSave: (value: string) => Promise<string | null>;
  hint?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const cancel = () => {
    setValue(initialValue);
    setEditing(false);
  };

  const save = () => {
    if (value.trim() === initialValue) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const error = await onSave(value.trim());
      if (error) {
        toast.error(`Couldn't save ${label.toLowerCase()}`, { description: error });
      } else {
        toast.success(`${label} updated`);
        setEditing(false);
      }
    });
  };

  return (
    <div className="py-3 border-b border-hair-2 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="type-label">{label}</div>
          {editing ? (
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              className="mt-1 w-full bg-paper border border-red rounded-sm px-2 py-1.5 text-[14px] font-semibold outline-none focus:ring-2 focus:ring-red-soft"
            />
          ) : (
            <div className="text-[14px] font-semibold mt-0.5">{value || <span className="text-ink-3">—</span>}</div>
          )}
          {hint && editing && <p className="text-[11px] text-ink-3 mt-1">{hint}</p>}
        </div>
        {readOnly ? null : editing ? (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={save}
              disabled={isPending}
              className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-xs bg-ink text-white hover:bg-red disabled:opacity-60"
              aria-label="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancel}
              className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-xs text-ink-3 hover:text-ink hover:bg-paper"
              aria-label="Cancel"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-[12px] text-ink-3 hover:text-ink font-semibold"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[13.5px] font-semibold">{label}</div>
        <div className="text-[11.5px] text-ink-3 mt-0.5">{sub}</div>
      </div>
      <Toggle on={value} onChange={onChange} aria-label={label} />
    </div>
  );
}
