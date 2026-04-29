"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Pencil, Archive, ArchiveRestore, Crown, Users, ChevronDown,
  X as XIcon, GripVertical, ShieldCheck, UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Team, TeamCoach } from "@/lib/services/teams";
import {
  createTeamAction,
  updateTeamAction,
  archiveTeamAction,
  unarchiveTeamAction,
  assignCoachToTeamAction,
  updateCoachRoleAction,
  removeCoachAction as removeTeamCoachAction,
} from "./team-actions";

/**
 * Settings → Teams.
 *
 * Lets a head coach manage the team structure within their program:
 *   - Add a new team (e.g. C-Team, Sophomore squad)
 *   - Rename / re-order / archive teams
 *   - See every coach grouped by team / program-wide / org-wide
 *   - Reassign a coach to a different team
 *   - Promote / demote between head_coach + assistant_coach
 *   - Remove a coach from the program
 *
 * Existing single-team programs see one team in the list (auto-created
 * from `programs.levels` by migration 000029). Adding a second team is
 * what unlocks per-team coach accounts.
 */

export function TeamsPanel({
  teams,
  coaches,
  isHeadCoach,
  currentCoachId,
}: {
  teams: Team[];
  coaches: TeamCoach[];
  isHeadCoach: boolean;
  currentCoachId: string | null;
}) {
  const router = useRouter();
  const [, startTx] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);

  // Group coaches by scope for display.
  const orgCoaches = coaches.filter((c) => c.scope === "organization");
  const programCoaches = coaches.filter((c) => c.scope === "program");
  const teamCoachesByTeam = new Map<string, TeamCoach[]>();
  for (const c of coaches) {
    if (c.scope === "team" && c.teamId) {
      const list = teamCoachesByTeam.get(c.teamId) ?? [];
      list.push(c);
      teamCoachesByTeam.set(c.teamId, list);
    }
  }

  const archive = (team: Team) => {
    if (!confirm(`Archive ${team.name}? You can unarchive any time.`)) return;
    startTx(async () => {
      const r = await archiveTeamAction(team.id);
      if (r.error) {
        toast.error("Couldn't archive", { description: r.error });
        return;
      }
      toast.success(`${team.name} archived`);
      router.refresh();
    });
  };

  const unarchive = (team: Team) => {
    startTx(async () => {
      const r = await unarchiveTeamAction(team.id);
      if (r.error) {
        toast.error("Couldn't unarchive", { description: r.error });
        return;
      }
      toast.success(`${team.name} restored`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-7">
      <header>
        <div className="flex items-end justify-between gap-3 mb-1">
          <div>
            <h2 className="font-display text-[22px] font-semibold tracking-tight">
              Teams within your program
            </h2>
            <p className="text-[13px] text-ink-3 mt-1 max-w-[520px] leading-relaxed">
              Add Varsity, JV, C-Team, Freshman, or whatever your program calls
              its teams. Each team can have its own head coach + assistants who
              only see their team&apos;s roster, schedule, and stats.
            </p>
          </div>
          {isHeadCoach && (
            <button
              onClick={() => setCreateOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-red hover:bg-red/90 text-white rounded-sm text-[13px] font-bold"
            >
              <Plus className="w-4 h-4" /> Add team
            </button>
          )}
        </div>
      </header>

      {/* Team list */}
      <section className="bg-card border border-hair rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-hair-2 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-ink-3" />
          <h3 className="font-display text-[14.5px] font-semibold tracking-tight">
            Active teams
          </h3>
          <span className="font-mono text-[11px] text-ink-3 ml-auto">
            {teams.filter((t) => !t.archivedAt).length} team{teams.filter((t) => !t.archivedAt).length === 1 ? "" : "s"}
          </span>
        </div>

        {teams.filter((t) => !t.archivedAt).length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="font-display text-[15px] font-semibold tracking-tight">
              No teams yet
            </div>
            <p className="text-[12.5px] text-ink-3 mt-1.5 max-w-[360px] mx-auto leading-relaxed">
              Add your first team to start assigning per-team coach accounts.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-hair-2">
            {teams.filter((t) => !t.archivedAt).map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                teamCoaches={teamCoachesByTeam.get(team.id) ?? []}
                allCoaches={coaches}
                isHeadCoach={isHeadCoach}
                currentCoachId={currentCoachId}
                onEdit={() => setEditing(team)}
                onArchive={() => archive(team)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Program-wide + org-wide coaches */}
      {(programCoaches.length > 0 || orgCoaches.length > 0) && (
        <section className="bg-card border border-hair rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-hair-2 flex items-center gap-2">
            <Crown className="w-3.5 h-3.5 text-ink-3" />
            <h3 className="font-display text-[14.5px] font-semibold tracking-tight">
              Program-wide + organization staff
            </h3>
            <span className="text-[11.5px] text-ink-3 ml-2">
              See every team. Make program-level decisions.
            </span>
          </div>
          <div className="divide-y divide-hair-2">
            {orgCoaches.map((c) => (
              <CoachRow
                key={c.coachId}
                coach={c}
                teams={teams}
                isHeadCoach={isHeadCoach}
                currentCoachId={currentCoachId}
                showAssign={false}
              />
            ))}
            {programCoaches.map((c) => (
              <CoachRow
                key={c.coachId}
                coach={c}
                teams={teams}
                isHeadCoach={isHeadCoach}
                currentCoachId={currentCoachId}
                showAssign
              />
            ))}
          </div>
        </section>
      )}

      {/* Archived teams */}
      {teams.some((t) => t.archivedAt) && (
        <section className="bg-paper-deep/40 border border-dashed border-hair rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-hair-2 flex items-center gap-2">
            <Archive className="w-3.5 h-3.5 text-ink-3" />
            <h3 className="font-display text-[14px] font-semibold tracking-tight text-ink-3">
              Archived
            </h3>
          </div>
          <div className="divide-y divide-hair-2">
            {teams.filter((t) => t.archivedAt).map((team) => (
              <div key={team.id} className="px-4 py-3 flex items-center gap-3">
                <span className="text-[13px] text-ink-3 font-semibold flex-1">
                  {team.name}
                </span>
                <span className="font-mono text-[11px] text-ink-3">
                  {team.playerCount} players · archived
                </span>
                {isHeadCoach && (
                  <button
                    onClick={() => unarchive(team)}
                    className="text-[12px] text-ink-3 hover:text-ink inline-flex items-center gap-1 font-semibold"
                  >
                    <ArchiveRestore className="w-3 h-3" /> Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {createOpen && <CreateTeamModal onClose={() => setCreateOpen(false)} />}
      {editing && <EditTeamModal team={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function TeamRow({
  team,
  teamCoaches,
  allCoaches,
  isHeadCoach,
  currentCoachId,
  onEdit,
  onArchive,
}: {
  team: Team;
  teamCoaches: TeamCoach[];
  allCoaches: TeamCoach[];
  isHeadCoach: boolean;
  currentCoachId: string | null;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  // Coaches not yet assigned to this team — for the "assign existing" picker.
  const unassignedToThisTeam = allCoaches.filter(
    (c) => c.teamId !== team.id && c.scope === "team",
  );

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-paper-deep text-ink-3 flex items-center justify-center font-mono text-[11px] font-bold shrink-0">
          {team.shortCode ?? team.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-[15px] font-semibold tracking-tight">
              {team.name}
            </span>
            <span className="font-mono text-[11px] text-ink-3">
              {team.playerCount} player{team.playerCount === 1 ? "" : "s"}
            </span>
            {teamCoaches.length === 0 && (
              <span className="px-1.5 py-0.5 rounded-xs bg-amber-soft text-amber text-[10px] font-bold uppercase tracking-[0.04em]">
                No coach assigned
              </span>
            )}
          </div>
          {/* Coaches on this team */}
          {teamCoaches.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {teamCoaches.map((c) => (
                <CoachRow
                  key={c.coachId}
                  coach={c}
                  teams={[]} // not used for team-scoped rows
                  isHeadCoach={isHeadCoach}
                  currentCoachId={currentCoachId}
                  showAssign
                  inline
                />
              ))}
            </div>
          )}
        </div>
        {isHeadCoach && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setAssignOpen((v) => !v)}
              className="p-1.5 text-ink-3 hover:text-ink rounded-sm hover:bg-paper"
              title="Assign coach"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 text-ink-3 hover:text-ink rounded-sm hover:bg-paper"
              title="Edit team"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onArchive}
              className="p-1.5 text-ink-3 hover:text-red rounded-sm hover:bg-paper"
              title="Archive team"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Inline assign-existing picker */}
      {assignOpen && unassignedToThisTeam.length > 0 && (
        <div className="mt-3 pl-12">
          <div className="bg-paper border border-hair rounded-md p-3">
            <div className="type-label mb-2">Move an existing coach to {team.name}</div>
            <div className="space-y-1">
              {unassignedToThisTeam.map((c) => (
                <MoveCoachButton
                  key={c.coachId}
                  coach={c}
                  toTeam={team}
                  onDone={() => setAssignOpen(false)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      {assignOpen && unassignedToThisTeam.length === 0 && (
        <div className="mt-3 pl-12">
          <div className="bg-paper border border-dashed border-hair rounded-md px-3 py-2 text-[12px] text-ink-3">
            All other team-scoped coaches are already on a team. Invite a new coach from the Coaches section.
          </div>
        </div>
      )}
    </div>
  );
}

function CoachRow({
  coach,
  teams,
  isHeadCoach,
  currentCoachId,
  showAssign,
  inline = false,
}: {
  coach: TeamCoach;
  teams: Team[];
  isHeadCoach: boolean;
  currentCoachId: string | null;
  showAssign: boolean;
  inline?: boolean;
}) {
  const router = useRouter();
  const [, startTx] = useTransition();
  const [open, setOpen] = useState(false);
  const isMe = coach.coachId === currentCoachId;

  const promoteOrDemote = () => {
    const nextRole = coach.role === "head_coach" ? "assistant_coach" : "head_coach";
    startTx(async () => {
      const r = await updateCoachRoleAction({
        coachId: coach.coachId,
        role: nextRole,
      });
      if (r.error) {
        toast.error("Couldn't change role", { description: r.error });
        return;
      }
      toast.success(`Now ${nextRole === "head_coach" ? "head coach" : "assistant"}`);
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm(`Remove ${coach.fullName ?? coach.email ?? "this coach"} from the program? Their account stays intact.`)) return;
    startTx(async () => {
      const r = await removeTeamCoachAction(coach.coachId);
      if (r.error) {
        toast.error("Couldn't remove", { description: r.error });
        return;
      }
      toast.success("Removed");
      router.refresh();
    });
  };

  const moveToProgram = () => {
    startTx(async () => {
      const r = await assignCoachToTeamAction({
        coachId: coach.coachId,
        teamId: null,
      });
      if (r.error) {
        toast.error("Couldn't promote", { description: r.error });
        return;
      }
      toast.success("Now program-wide");
      router.refresh();
    });
  };

  const moveToTeam = (teamId: string) => {
    startTx(async () => {
      const r = await assignCoachToTeamAction({
        coachId: coach.coachId,
        teamId,
      });
      if (r.error) {
        toast.error("Couldn't reassign", { description: r.error });
        return;
      }
      toast.success("Reassigned");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className={cn(
      "flex items-center gap-3",
      inline ? "px-2.5 py-1.5 bg-paper rounded-sm" : "px-4 py-3",
    )}>
      <div className="w-7 h-7 rounded-full bg-ink text-white flex items-center justify-center text-[10px] font-bold shrink-0">
        {(coach.fullName ?? coach.email ?? "??")
          .split(" ")
          .map((w) => w[0] ?? "")
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("font-semibold", inline ? "text-[12.5px]" : "text-[13.5px]")}>
            {coach.fullName ?? coach.email ?? "Unknown"}
          </span>
          {coach.role === "head_coach" && (
            <Crown className="w-3 h-3 text-amber" />
          )}
          {isMe && (
            <span className="px-1 py-0.5 rounded-xs bg-red-soft text-red text-[9px] font-bold uppercase tracking-[0.04em]">
              You
            </span>
          )}
          {coach.scope === "organization" && (
            <span className="px-1.5 py-0.5 rounded-xs bg-grass-dim text-grass text-[9.5px] font-bold uppercase tracking-[0.04em]">
              <ShieldCheck className="w-2.5 h-2.5 inline -mt-0.5" /> Org
            </span>
          )}
          {coach.scope === "program" && (
            <span className="px-1.5 py-0.5 rounded-xs bg-sky-soft text-sky text-[9.5px] font-bold uppercase tracking-[0.04em]">
              Program-wide
            </span>
          )}
        </div>
        {!inline && coach.email && (
          <div className="text-[11.5px] text-ink-3 font-mono mt-0.5 truncate">
            {coach.email} · {coach.role === "head_coach" ? "Head Coach" : "Assistant"}
          </div>
        )}
        {inline && (
          <div className="text-[10px] text-ink-3 font-mono">
            {coach.role === "head_coach" ? "Head Coach" : "Assistant"}
          </div>
        )}
      </div>
      {isHeadCoach && (
        <div className="relative shrink-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 text-ink-3 hover:text-ink rounded-sm hover:bg-paper text-[11px] font-semibold inline-flex items-center gap-1"
          >
            Manage <ChevronDown className="w-3 h-3" />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 z-10 w-56 bg-card border border-hair rounded-sm shadow-lg overflow-hidden">
              <button
                onClick={() => {
                  setOpen(false);
                  promoteOrDemote();
                }}
                className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-paper inline-flex items-center gap-2"
              >
                <Crown className="w-3 h-3" />
                {coach.role === "head_coach" ? "Demote to assistant" : "Promote to head coach"}
              </button>
              {showAssign && coach.scope === "team" && (
                <button
                  onClick={() => {
                    setOpen(false);
                    moveToProgram();
                  }}
                  className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-paper inline-flex items-center gap-2"
                >
                  <Users className="w-3 h-3" />
                  Make program-wide
                </button>
              )}
              {showAssign && coach.scope === "program" && teams.length > 0 && (
                <div className="border-t border-hair-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                    Assign to team
                  </div>
                  {teams.filter((t) => !t.archivedAt).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => moveToTeam(t.id)}
                      className="w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-paper"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              {!isMe && (
                <button
                  onClick={() => {
                    setOpen(false);
                    remove();
                  }}
                  className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-paper text-red inline-flex items-center gap-2 border-t border-hair-2"
                >
                  <UserMinus className="w-3 h-3" />
                  Remove from program
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MoveCoachButton({
  coach,
  toTeam,
  onDone,
}: {
  coach: TeamCoach;
  toTeam: Team;
  onDone: () => void;
}) {
  const router = useRouter();
  const [, startTx] = useTransition();
  return (
    <button
      onClick={() => {
        startTx(async () => {
          const r = await assignCoachToTeamAction({
            coachId: coach.coachId,
            teamId: toTeam.id,
          });
          if (r.error) {
            toast.error("Couldn't move", { description: r.error });
            return;
          }
          toast.success(`${coach.fullName ?? "Coach"} → ${toTeam.name}`);
          onDone();
          router.refresh();
        });
      }}
      className="w-full text-left px-2 py-1.5 text-[12px] rounded-xs hover:bg-paper-deep flex items-center gap-2"
    >
      <span className="font-semibold">{coach.fullName ?? coach.email ?? "Unknown"}</span>
      <span className="text-[10px] text-ink-3">
        {coach.role === "head_coach" ? "Head" : "Asst"}
      </span>
    </button>
  );
}

// ── Modals ───────────────────────────────────────────────────────

function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [, startTx] = useTransition();
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    startTx(async () => {
      const r = await createTeamAction({
        name,
        shortCode: shortCode.trim() || undefined,
      });
      if (r.error) {
        toast.error("Couldn't add team", { description: r.error });
        return;
      }
      toast.success(`${name} added`);
      onClose();
      router.refresh();
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-modal bg-ink/40 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-hair rounded-lg w-full max-w-[440px] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-[18px] font-semibold tracking-tight">
            Add a team
          </h3>
          <button onClick={onClose} className="p-1 text-ink-3 hover:text-ink">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12.5px] text-ink-3 mb-4">
          E.g. C-Team, Sophomore squad, JV-A. You can rename or archive any time.
        </p>
        <div className="space-y-4">
          <div>
            <label className="type-label block mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="C-Team"
              className="w-full px-3 py-2 bg-paper border border-hair rounded-sm text-[13.5px] focus:outline-none focus:border-red"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <div>
            <label className="type-label block mb-1">
              Short code <span className="text-ink-3 font-normal">(optional)</span>
            </label>
            <input
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="C"
              className="w-full px-3 py-2 bg-paper border border-hair rounded-sm text-[13.5px] font-mono focus:outline-none focus:border-red"
            />
            <p className="text-[10.5px] text-ink-3 mt-1">
              1–4 letters shown in tight UI spots. Defaults to first 2 letters of the name.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-[13px] text-ink-3 hover:text-ink rounded-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-4 py-2 bg-red text-white rounded-sm text-[13px] font-bold disabled:opacity-50"
          >
            Add team
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTeamModal({
  team,
  onClose,
}: {
  team: Team;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTx] = useTransition();
  const [name, setName] = useState(team.name);
  const [shortCode, setShortCode] = useState(team.shortCode ?? "");

  const submit = () => {
    if (!name.trim()) return;
    startTx(async () => {
      const r = await updateTeamAction({
        teamId: team.id,
        name: name !== team.name ? name : undefined,
        shortCode: shortCode !== (team.shortCode ?? "") ? shortCode : undefined,
      });
      if (r.error) {
        toast.error("Couldn't update", { description: r.error });
        return;
      }
      toast.success("Updated");
      onClose();
      router.refresh();
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-modal bg-ink/40 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-hair rounded-lg w-full max-w-[440px] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-[18px] font-semibold tracking-tight">
            Edit {team.name}
          </h3>
          <button onClick={onClose} className="p-1 text-ink-3 hover:text-ink">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="type-label block mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-paper border border-hair rounded-sm text-[13.5px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <div>
            <label className="type-label block mb-1">Short code</label>
            <input
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value.toUpperCase().slice(0, 4))}
              className="w-full px-3 py-2 bg-paper border border-hair rounded-sm text-[13.5px] font-mono"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-[13px] text-ink-3 hover:text-ink rounded-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 bg-red text-white rounded-sm text-[13px] font-bold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
