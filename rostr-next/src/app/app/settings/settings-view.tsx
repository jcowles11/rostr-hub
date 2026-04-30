"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, User, Users, Shield, Zap, Database, Link2, Check, X as XIcon,
  ChevronUp, ChevronDown, Plus, Copy, Trash2, Mail, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Toggle } from "@/components/atoms/toggle";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";
import {
  updateProgramAction,
  updateCoachNameAction,
  seedDemoDataAction,
} from "./actions";
import {
  createCoachInviteAction,
  deleteCoachInviteAction,
  removeCoachAction,
  type CoachInvite,
  type ProgramCoach,
} from "./invite-actions";
import { TeamsPanel } from "./teams-panel";
import type { Team, TeamCoach } from "@/lib/services/teams";

/**
 * /app/settings — Coach settings stub.
 */
const SECTIONS = [
  { label: "Program", icon: <Users className="w-4 h-4" /> },
  { label: "Teams", icon: <Crown className="w-4 h-4" /> },
  { label: "Team defaults", icon: <User className="w-4 h-4" /> },
  { label: "Coaches", icon: <Users className="w-4 h-4" /> },
  { label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { label: "Integrations", icon: <Link2 className="w-4 h-4" /> },
  { label: "Data & privacy", icon: <Shield className="w-4 h-4" /> },
  { label: "AI Assistant Coach", icon: <Zap className="w-4 h-4" /> },
  { label: "Advanced", icon: <Database className="w-4 h-4" /> },
];

export interface SettingsViewProps {
  hasCoach: boolean;
  isHeadCoach?: boolean;
  programName: string;
  coachName: string;
  sport: string;
  levels: string[];
  logoInitials: string;
  programCoaches?: import("./invite-actions").ProgramCoach[];
  coachInvites?: import("./invite-actions").CoachInvite[];
  currentCoachId?: string | null;
  /** Teams within the program (migration 000029). */
  teams?: Team[];
  /** Coaches grouped by scope (program / team / org). */
  scopedCoaches?: TeamCoach[];
}

export function SettingsView({
  hasCoach,
  isHeadCoach = false,
  programName,
  coachName,
  sport,
  levels,
  logoInitials,
  programCoaches = [],
  coachInvites = [],
  teams = [],
  scopedCoaches = [],
  currentCoachId,
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
      {/* PHASE 5 — removed Notifications bell. */}
      <TopBar
        breadcrumbs={[{ label: programName }, { label: "Settings" }]}
        actions={[]}
      />
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[240px_1fr] max-w-layout-hub mx-auto">
          <nav className="border-r border-hair py-8 px-4 space-y-0.5">
            <div className="type-label mb-3 px-2">Settings</div>
            {SECTIONS.map((s) => {
              // "Program" + "Teams" are real now; others still throw the
              // coming-soon toast until we actually build them out.
              const isWired = s.label === "Program" || s.label === "Teams";
              return (
              <button
                key={s.label}
                onClick={() => {
                  if (isWired) {
                    setActiveSection(s.label);
                  } else {
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
              );
            })}
          </nav>

          <div className="px-10 py-8 max-w-[720px]">
            {activeSection === "Teams" ? (
              <>
                <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                  Teams + staff
                </h1>
                <p className="text-[13.5px] text-ink-3 mt-1 mb-8">
                  Manage the teams within your program (Varsity, JV, C-Team,
                  Freshman, etc.) and assign coach accounts to each one.
                </p>
                {!hasCoach && (
                  <div className="mb-6 flex items-start gap-2 p-3 rounded-sm bg-amber-soft text-amber text-[12.5px]">
                    <span className="font-semibold">Demo mode.</span>
                    <span>
                      Editing is read-only until you{" "}
                      <a href="/app/setup" className="underline font-semibold">
                        set up your program
                      </a>
                      .
                    </span>
                  </div>
                )}
                <TeamsPanel
                  teams={teams}
                  coaches={scopedCoaches}
                  isHeadCoach={isHeadCoach && hasCoach}
                  currentCoachId={currentCoachId ?? null}
                />
              </>
            ) : (
              <>
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
              <LevelsEditor levels={levels} readOnly={!hasCoach} />

              {hasCoach && <SeedDemoPanel />}

              {hasCoach && (
                <StaffPanel
                  coaches={programCoaches}
                  invites={coachInvites}
                  isHeadCoach={isHeadCoach}
                  currentCoachId={currentCoachId ?? null}
                />
              )}

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
              </>
            )}
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

// ── Multi-team (Levels) editor ─────────────────────────────────

function LevelsEditor({
  levels: initial,
  readOnly,
}: {
  levels: string[];
  readOnly?: boolean;
}) {
  const [levels, setLevels] = useState(initial);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = (next: string[]) => {
    setLevels(next);
    startTransition(async () => {
      const r = await updateProgramAction({ levels: next });
      if (r.error) {
        toast.error("Couldn't save teams", { description: r.error });
        setLevels(initial);
      } else {
        toast.success("Teams updated", { description: next.join(" · ") });
      }
    });
  };

  const add = () => {
    const val = input.trim();
    if (!val) return;
    if (levels.some((l) => l.toLowerCase() === val.toLowerCase())) {
      toast.info("Already added", { description: val });
      return;
    }
    setInput("");
    save([...levels, val]);
  };

  const remove = (idx: number) => {
    save(levels.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= levels.length) return;
    const next = [...levels];
    [next[idx], next[target]] = [next[target], next[idx]];
    save(next);
  };

  return (
    <div className="py-3 border-b border-hair-2 last:border-b-0">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="type-label">Teams / Levels</div>
          <p className="text-[11.5px] text-ink-3 mt-0.5 max-w-[440px]">
            Add as many teams as your program runs — Varsity, JV, Sophomore, Freshman, 7th grade,
            whatever. Order top-down by seniority.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {levels.map((l, i) => (
          <div
            key={l}
            className="inline-flex items-center gap-1 bg-card border border-hair rounded-xs pl-2.5 pr-1 py-1 text-[12.5px] font-semibold"
          >
            <span>{l}</span>
            {!readOnly && (
              <>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || isPending}
                  aria-label={`Move ${l} up`}
                  className="p-0.5 text-ink-4 hover:text-ink disabled:opacity-30 rounded-xs"
                  title="Move up"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === levels.length - 1 || isPending}
                  aria-label={`Move ${l} down`}
                  className="p-0.5 text-ink-4 hover:text-ink disabled:opacity-30 rounded-xs"
                  title="Move down"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => remove(i)}
                  disabled={isPending}
                  aria-label={`Remove ${l}`}
                  className="p-0.5 text-ink-4 hover:text-red rounded-xs"
                  title="Remove"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-3 flex gap-1.5 max-w-[340px]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add a team… e.g. Sophomore"
            className="flex-1 bg-paper border border-hair rounded-xs px-2.5 py-1.5 text-[13px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft"
          />
          <button
            onClick={add}
            disabled={!input.trim() || isPending}
            className="px-3 h-[32px] rounded-xs bg-ink text-white text-[12.5px] font-semibold hover:bg-red disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ── Staff panel (head coach manages assistant invites) ─────────────

function StaffPanel({
  coaches,
  invites,
  isHeadCoach,
  currentCoachId,
}: {
  coaches: ProgramCoach[];
  invites: CoachInvite[];
  isHeadCoach: boolean;
  currentCoachId: string | null;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"head_coach" | "assistant_coach">("assistant_coach");
  const [isPending, startTransition] = useTransition();
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const pending = invites.filter((i) => !i.acceptedAt);

  const create = () => {
    setLastInviteUrl(null);
    startTransition(async () => {
      const r = await createCoachInviteAction({ name, email, role });
      if (r.error) {
        toast.error("Couldn't create invite", { description: r.error });
        return;
      }
      const url = `${window.location.origin}/invite/${r.token}`;
      setLastInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied", { description: `Send it to ${name || "your assistant"}` });
      } catch {
        toast.success("Invite created — copy the link below");
      }
      setName("");
      setEmail("");
      setRole("assistant_coach");
      router.refresh();
    });
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this invite? The link will stop working.")) return;
    const r = await deleteCoachInviteAction(id);
    if (r.error) toast.error("Couldn't revoke", { description: r.error });
    else {
      toast.success("Invite revoked");
      router.refresh();
    }
  };

  const remove = async (coachId: string, fullName: string) => {
    if (!confirm(`Remove ${fullName}? They'll lose access to this program.`)) return;
    const r = await removeCoachAction(coachId);
    if (r.error) toast.error("Couldn't remove", { description: r.error });
    else {
      toast.success(`${fullName} removed`);
      router.refresh();
    }
  };

  return (
    <div className="pt-4 border-t border-hair">
      <div className="flex items-center gap-2 mb-3">
        <div className="type-label">Staff · {coaches.length}</div>
        {isHeadCoach && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 bg-ink hover:bg-red text-white rounded-sm text-[11.5px] font-semibold"
          >
            <Plus className="w-3 h-3" /> Invite coach
          </button>
        )}
      </div>

      {/* Active coach list */}
      <div className="space-y-1.5 mb-4">
        {coaches.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-3 py-2 bg-card border border-hair-2 rounded-sm"
          >
            <Avatar
              size="sm"
              color="ink"
              initials={c.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[13px]">
                <span className="font-semibold truncate">{c.fullName}</span>
                {c.role === "head_coach" && (
                  <Crown className="w-3 h-3 text-gold shrink-0" />
                )}
                {c.id === currentCoachId && (
                  <span className="text-[10px] font-semibold text-ink-3">(you)</span>
                )}
              </div>
              <div className="font-mono text-[10.5px] text-ink-3 truncate">
                {c.email ?? "—"} · {c.role === "head_coach" ? "Head Coach" : "Assistant"}
              </div>
            </div>
            {isHeadCoach && c.id !== currentCoachId && (
              <button
                onClick={() => remove(c.id, c.fullName)}
                className="p-1.5 rounded-xs text-ink-3 hover:text-red hover:bg-red-soft"
                aria-label="Remove coach"
                title="Remove coach"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Invite form */}
      {showForm && isHeadCoach && (
        <div className="p-3 bg-paper border border-hair-2 rounded-sm mb-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Coach name (optional)"
              className="bg-card border border-hair rounded-sm px-2.5 py-1.5 text-[12.5px] outline-none focus:border-red"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@school.edu (optional)"
              className="bg-card border border-hair rounded-sm px-2.5 py-1.5 text-[12.5px] outline-none focus:border-red"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "head_coach" | "assistant_coach")}
              className="bg-card border border-hair rounded-sm px-2.5 py-1.5 text-[12.5px] outline-none focus:border-red"
            >
              <option value="assistant_coach">Assistant Coach</option>
              <option value="head_coach">Head Coach (co-lead)</option>
            </select>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-[12px] text-ink-3 hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={isPending}
              className="px-3 py-1.5 bg-red hover:bg-red/90 text-white rounded-sm text-[12px] font-semibold disabled:opacity-60"
            >
              {isPending ? "Creating…" : "Create invite link"}
            </button>
          </div>
          {lastInviteUrl && (
            <div className="mt-2 p-2 bg-card rounded-sm font-mono text-[11px] break-all text-ink-2 flex items-center gap-2">
              <Link2 className="w-3 h-3 text-ink-3 shrink-0" />
              <span className="flex-1">{lastInviteUrl}</span>
              <button
                onClick={() => navigator.clipboard.writeText(lastInviteUrl).then(() => toast.success("Copied"))}
                className="p-1 text-ink-3 hover:text-ink"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <div>
          <div className="type-label mb-2">Pending invites · {pending.length}</div>
          <div className="space-y-1.5">
            {pending.map((inv) => {
              const url =
                typeof window !== "undefined"
                  ? `${window.location.origin}/invite/${inv.inviteToken}`
                  : "";
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-3 py-2 bg-card border border-dashed border-hair rounded-sm"
                >
                  <Mail className="w-4 h-4 text-ink-3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold">
                      {inv.invitedName ?? inv.invitedEmail ?? "Unnamed invite"}
                      <span className="text-ink-3 font-normal ml-2 text-[11px]">
                        {inv.role === "head_coach" ? "· Head Coach" : "· Assistant"}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-ink-3 truncate">
                      {inv.invitedEmail ?? "no email"} · created{" "}
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {isHeadCoach && (
                    <>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(url).then(() => toast.success("Copied"))
                        }
                        className="p-1.5 rounded-xs text-ink-3 hover:text-ink hover:bg-paper-deep"
                        aria-label="Copy link"
                        title="Copy invite link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => revoke(inv.id)}
                        className="p-1.5 rounded-xs text-ink-3 hover:text-red hover:bg-red-soft"
                        aria-label="Revoke invite"
                        title="Revoke"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Demo data seeder panel
// ─────────────────────────────────────────────────────────────

/**
 * SeedDemoPanel — single-button demo populator. Calls
 * `seedDemoDataAction` which is idempotent (skips if marker player
 * already exists). Shows a per-table summary in a toast on success.
 *
 * Useful for sales walkthroughs OR for any new coach who wants to
 * explore the product before importing their real roster.
 */
function SeedDemoPanel() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const seed = () => {
    if (
      !window.confirm(
        "Seed demo data? Adds 25 fictional players, a schedule, a tryout, season stats, and one completed game. Safe to run; idempotent — re-running won't duplicate. Existing real data is untouched.",
      )
    )
      return;
    startTransition(async () => {
      const r = await seedDemoDataAction();
      if (r.error) {
        toast.error("Couldn't seed demo data", { description: r.error });
        return;
      }
      const s = r.summary;
      if (s?.alreadySeeded) {
        toast.info("Demo data already loaded", {
          description: "Marker player Marcus Johnson #21 found — skipping seed.",
        });
        return;
      }
      toast.success("Demo data added", {
        description: s
          ? `${s.playersInserted} players · ${s.gamesInserted} games · ${s.practicesInserted} practices · ${s.tryoutScoresInserted} tryout scores · ${s.completedGameEventsInserted} game events`
          : "Reload to see populated views",
      });
      // Refresh so Hub / Roster / Schedule pick up the new data.
      router.refresh();
    });
  };

  return (
    <div className="pt-4 border-t border-hair">
      <div className="type-label mb-2">Demo data</div>
      <div className="bg-paper border border-hair rounded-md p-4">
        <div className="text-[13px] text-ink-2 leading-relaxed">
          Populate this program with a full sample dataset so you can
          explore every screen without manual entry. Adds:
        </div>
        <ul className="mt-2 ml-4 list-disc text-[12px] text-ink-3 leading-snug space-y-0.5">
          <li>25 players (12 V / 10 JV / 3 Fr) with positions + jerseys</li>
          <li>5 upcoming games + 2 completed games with final scores</li>
          <li>4 practice events + 1 active practice plan with 6 blocks</li>
          <li>1 completed tryout (6 stations, scores for every attendee)</li>
          <li>Season batting + pitching stats for V players</li>
          <li>1 fully-scored game (13 at-bat events) for box-score demo</li>
          <li>8 player notes (used by AI Assistant Coach context)</li>
        </ul>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={seed}
            disabled={isPending}
            className="min-h-[40px] px-4 inline-flex items-center gap-1.5 bg-red text-white rounded-sm text-[13px] font-bold hover:bg-red/90 disabled:opacity-60"
          >
            {isPending ? "Seeding…" : "Seed demo data"}
          </button>
          <span className="text-[11px] text-ink-3">
            Idempotent — safe to click. Won&apos;t duplicate if already seeded.
          </span>
        </div>
      </div>
    </div>
  );
}
