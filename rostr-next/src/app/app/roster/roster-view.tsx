"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Plus,
  Upload,
  Download,
  X,
  ExternalLink,
  Pencil,
  Trash2,
  Sparkles,
  FileText,
} from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { toast } from "sonner";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Checkbox } from "@/components/atoms/checkbox";
import { Chip } from "@/components/atoms/chip";
import { comingSoon } from "@/lib/coming-soon";
import { cn } from "@/lib/utils";
import { AddPlayerModal, type PlayerEditInit } from "@/components/organisms/add-player-modal";
import { ImportRosterModal } from "@/components/organisms/import-roster-modal";
import { ImportStatsModal } from "@/components/organisms/import-stats-modal";
import { PlayerSlideover } from "@/components/organisms/player-slideover";
import { LevelPicker } from "@/components/molecules/level-picker";
import { RowActions } from "@/components/molecules/row-actions";
import { deletePlayerAction, bulkSetPlayerLevelAction } from "./actions";
import { seedSampleRosterAction } from "./sample-actions";
import {
  type AvailabilityStatus,
  type ProfileStatus,
  type RosterLevel,
  type MockPlayer,
} from "@/lib/mock-data";

function shortToLongName(short: string): string {
  if (short === "V") return "Varsity";
  if (short === "JV") return "JV";
  if (short === "F") return "Freshman";
  return short;
}

/**
 * Roster view — client component.
 * Receives a players array + configured level list from the Server
 * Component page wrapper.
 */
export function RosterView({
  players,
  levels = ["Varsity", "JV", "Freshman"],
  battingByPlayer = {},
  measurablesByPlayer = {},
  pitchingByPlayer = {},
  programName = "Rostr",
}: {
  players: MockPlayer[];
  levels?: string[];
  battingByPlayer?: Record<
    string,
    { games: number; ba: number; obp: number; slg: number; ops: number; hr: number; rbi: number }
  >;
  /** Per-player measurables (combine + tryout data) for the slideover Metrics tab. */
  measurablesByPlayer?: Record<
    string,
    Array<{
      shortCode: string;
      stationName: string;
      unit: string | null;
      bestValue: number;
      scoreType: "lower_better" | "higher_better" | "rating";
      latestAt: string | null;
      verifiedByCoachName: string | null;
    }>
  >;
  /** Per-player pitching line for the slideover Metrics tab. */
  pitchingByPlayer?: Record<
    string,
    { games: number; era: number; whip: number; ip: number; k: number; bb: number }
  >;
  programName?: string;
}) {
  const router = useRouter();
  const [levelFilter, setLevelFilter] = useState<"all" | string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerEditInit | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importStatsOpen, setImportStatsOpen] = useState(false);
  const [slideoverPlayer, setSlideoverPlayer] = useState<MockPlayer | null>(null);
  const [, startSampleTransition] = useTransition();
  const [sampling, setSampling] = useState(false);
  // View mode toggle. Defaults to "table" but we render cards on
  // small viewports automatically too via Tailwind responsive
  // classes. Persisted to localStorage so the coach's preference
  // sticks between page loads.
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window === "undefined") return "table";
    return (localStorage.getItem("rostr.roster.viewMode") as "table" | "cards") ?? "table";
  });
  const switchViewMode = (mode: "table" | "cards") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("rostr.roster.viewMode", mode);
    }
  };

  const seedSample = () => {
    if (sampling) return;
    setSampling(true);
    startSampleTransition(async () => {
      const r = await seedSampleRosterAction();
      setSampling(false);
      if (r.error) {
        toast.error("Couldn't seed sample roster", { description: r.error });
        return;
      }
      toast.success(`Added ${r.inserted} sample players`, {
        description: "Explore the app, then wipe + import your real roster.",
      });
      router.refresh();
    });
  };
  const [filters] = useState([
    { key: "class", label: "Class: Any" },
    { key: "position", label: "Position: Any" },
    { key: "availability", label: "Availability: Any" },
  ]);

  const filtered = useMemo(() => {
    if (levelFilter === "all") return players;
    return players.filter((p) => {
      const name = p.levelName ?? shortToLongName(p.level);
      return name.toLowerCase() === levelFilter.toLowerCase();
    });
  }, [levelFilter, players]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lvl of levels) counts[lvl] = 0;
    for (const p of players) {
      const name = p.levelName ?? shortToLongName(p.level);
      if (counts[name] !== undefined) counts[name]++;
      else counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [players, levels]);

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };
  const allSelected = selected.size > 0 && selected.size === filtered.length;

  return (
    <>
      {/* PHASE 5 — removed Notifications bell + Export comingSoon. */}
      <TopBar
        breadcrumbs={[{ label: programName }, { label: "Roster" }]}
        actions={[
          { kind: "ghost", label: "Import roster", icon: <Upload className="w-[15px] h-[15px]" />, onClick: () => setImportOpen(true) },
          { kind: "ghost", label: "Import stats", icon: <Upload className="w-[15px] h-[15px]" />, onClick: () => setImportStatsOpen(true) },
          { kind: "primary", label: "Add player", icon: <Plus className="w-[15px] h-[15px]" />, onClick: () => setAddOpen(true) },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-app mx-auto">
          {/* Page head */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <h1 className="font-display text-display-md">Roster</h1>
              <p className="mt-1 text-ink-3 text-[14px]">
                {players.length === 0
                  ? "No players yet — import or add your first to get started."
                  : `${players.length} player${players.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          {/* Level tabs (dynamic from program.levels) */}
          <div className="flex gap-1 mb-4 p-1 bg-paper-deep rounded-md w-fit max-w-full overflow-x-auto flex-wrap">
            <LevelTab
              active={levelFilter === "all"}
              onClick={() => setLevelFilter("all")}
              label="All"
              count={players.length}
            />
            {levels.map((lvl) => (
              <LevelTab
                key={lvl}
                active={levelFilter === lvl}
                onClick={() => setLevelFilter(lvl)}
                label={lvl}
                count={levelCounts[lvl] ?? 0}
              />
            ))}
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 mb-4 items-center flex-wrap">
            {filters.map((f) => (
              <Chip key={f.key}>{f.label}</Chip>
            ))}
            <Chip>+ Filter</Chip>
            <div className="ml-auto flex bg-paper-deep p-[3px] rounded-sm">
              <ViewModeButton active={viewMode === "table"} onClick={() => switchViewMode("table")}>
                Table
              </ViewModeButton>
              <ViewModeButton active={viewMode === "cards"} onClick={() => switchViewMode("cards")}>
                Cards
              </ViewModeButton>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-hair rounded-md overflow-hidden">
            {/* Bulk toolbar */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2.5 flex-wrap bg-ink text-white px-4 py-2.5 text-[12.5px]">
                <b className="font-bold">{selected.size} selected</b>
                <span className="text-white/40">·</span>
                <span className="text-white/60">Move to:</span>
                {levels.map((lvl) => (
                  <BulkMoveButton
                    key={lvl}
                    label={lvl}
                    onClick={async () => {
                      // Store by exact level name (lowercased). The
                      // roster_assignments.assignment column is TEXT — any
                      // configured level name is valid.
                      const r = await bulkSetPlayerLevelAction(
                        Array.from(selected),
                        lvl.toLowerCase(),
                      );
                      if (r.error) toast.error("Bulk move failed", { description: r.error });
                      else {
                        toast.success(`Moved ${r.updated} to ${lvl}`);
                        setSelected(new Set());
                        router.refresh();
                      }
                    }}
                  />
                ))}
                <BulkMoveButton
                  label="Cut"
                  danger
                  onClick={async () => {
                    const r = await bulkSetPlayerLevelAction(Array.from(selected), "cut");
                    if (r.error) toast.error("Bulk cut failed", { description: r.error });
                    else {
                      toast.success(`Cut ${r.updated}`);
                      setSelected(new Set());
                      router.refresh();
                    }
                  }}
                />
                <span className="text-white/40">·</span>
                <BulkButton>Send message</BulkButton>
                <BulkButton>Invite to profile</BulkButton>
                <button
                  onClick={clearSelection}
                  className="ml-auto inline-flex items-center gap-1 text-[12px] text-white/70 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            )}

            {players.length === 0 && (
              // PHASE 1 — clearer primary action. The simplest first
              // step for a non-technical coach is "Add your first
              // player" by hand (no CSV needed). Bulk-import paths are
              // demoted to secondary. The "try with sample players"
              // option stays available as a tertiary explore-first
              // affordance.
              <div className="p-8 sm:p-10 text-center">
                <div className="inline-flex w-14 h-14 rounded-full bg-red-soft text-red items-center justify-center mb-3">
                  <Plus className="w-7 h-7" strokeWidth={2.25} />
                </div>
                <h2 className="font-display text-[20px] font-semibold tracking-tight">
                  Build your roster
                </h2>
                <p className="text-[13px] text-ink-3 mt-2 max-w-[420px] mx-auto leading-relaxed">
                  Add 5–10 players to get started. You can always
                  import the rest later.
                </p>
                <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2 max-w-[420px] mx-auto">
                  <button
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 h-11 bg-red text-white rounded-full text-[13.5px] font-bold shadow-[0_4px_14px_-4px_rgba(200,58,58,0.55)] active:scale-[0.96] transition-transform"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} /> Add your first player
                  </button>
                  <button
                    onClick={() => setImportOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 h-11 bg-paper hover:bg-paper-deep border border-hair text-ink rounded-full text-[13px] font-semibold active:scale-[0.97] transition-transform"
                  >
                    <Upload className="w-4 h-4" /> Import CSV
                  </button>
                </div>
                <button
                  onClick={() => setImportStatsOpen(true)}
                  className="mt-3 text-[12px] text-ink-3 hover:text-ink underline"
                >
                  Or import directly from GameChanger →
                </button>
                <div className="mt-6 pt-5 border-t border-hair-2 max-w-[420px] mx-auto">
                  <p className="text-[12px] text-ink-3 mb-2">
                    Just want to look around?
                  </p>
                  <button
                    onClick={seedSample}
                    disabled={sampling}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-paper-deep hover:bg-paper border border-dashed border-hair text-ink-2 hover:text-ink rounded-full text-[12.5px] font-semibold disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {sampling ? "Seeding…" : "Try with 15 sample players"}
                  </button>
                  <p className="text-[10.5px] text-ink-3 mt-2 leading-relaxed">
                    Wipe + reimport your real roster from Settings → Data when you&apos;re ready.
                  </p>
                </div>
              </div>
            )}
            {players.length > 0 && viewMode === "cards" && (
              <PlayerCardsGrid
                players={filtered}
                battingByPlayer={battingByPlayer}
                onSelect={(p) => setSlideoverPlayer(p)}
                selected={selected}
                toggleRow={toggleRow}
                levels={levels}
              />
            )}
            {players.length > 0 && viewMode === "table" && (
            <div>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] md:min-w-[720px]">
              <thead>
                <tr>
                  <Th width="32px">
                    <Checkbox
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </Th>
                  <Th width="52px">#</Th>
                  <Th>Player</Th>
                  <Th width="70px">Level</Th>
                  <Th width="80px" mobileHidden>Position</Th>
                  <Th width="70px" mobileHidden>Class</Th>
                  <Th width="70px" align="right" mobileHidden>BA</Th>
                  <Th width="70px" align="right" mobileHidden>ERA</Th>
                  <Th width="110px">Today</Th>
                  <Th width="120px" mobileHidden>Profile</Th>
                  <Th width="36px" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isSelected = selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSlideoverPlayer(p)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected ? "bg-red-soft" : "hover:bg-paper",
                      )}
                    >
                      <Td onClickStopPropagation>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(p.id)}
                          aria-label={`Select ${p.firstName}`}
                        />
                      </Td>
                      <Td mono>{p.jerseyNumber}</Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar size="md" color={p.avatarColor} initials={p.initials} />
                          <div>
                            <div className="font-semibold text-[13.5px] flex items-center gap-1.5">
                              {p.firstName} {p.lastName}
                              {p.hot && (
                                <span className="text-red text-[11px]" aria-label="hot">
                                  🔥
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-ink-3">
                              @{p.handle}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <LevelPicker
                          playerId={p.id}
                          playerName={`${p.firstName} ${p.lastName}`}
                          level={p.levelName ?? shortToLongName(p.level)}
                          levels={levels}
                        />
                      </Td>
                      <Td mono mobileHidden>{p.positions.join("/")}</Td>
                      <Td mono mobileHidden>{p.classYear}</Td>
                      <Td mono align="right" mobileHidden>
                        {renderRealBA(battingByPlayer[p.id]) ?? p.ba ?? <span className="text-ink-4">—</span>}
                      </Td>
                      <Td mono align="right" mobileHidden>
                        {p.era ?? <span className="text-ink-4">—</span>}
                      </Td>
                      <Td>
                        <AvailabilityLabel
                          status={p.availabilityStatus}
                          note={p.availabilityNote}
                        />
                      </Td>
                      <Td mobileHidden>
                        <ProfileLinkBadge status={p.profileStatus} />
                      </Td>
                      <Td onClickStopPropagation>
                        <div className="flex items-center gap-0.5 justify-end">
                          <Link
                            href={`/p/${p.handle}`}
                            target="_blank"
                            className="text-ink-3 hover:text-ink hover:bg-paper-deep rounded-xs p-1"
                            aria-label="View public profile"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          <RowActions
                            items={[
                              {
                                label: "Edit player",
                                icon: <Pencil className="w-3.5 h-3.5" />,
                                onSelect: () =>
                                  setEditing({
                                    id: p.id,
                                    firstName: p.firstName,
                                    lastName: p.lastName,
                                    grade:
                                      p.classYearShort === "Fr"
                                        ? 9
                                        : p.classYearShort === "So"
                                          ? 10
                                          : p.classYearShort === "Jr"
                                            ? 11
                                            : p.classYearShort === "Sr"
                                              ? 12
                                              : null,
                                    positions: p.positions,
                                    playerNumber: p.jerseyNumber || null,
                                  }),
                              },
                              {
                                label: "View public profile",
                                icon: <ExternalLink className="w-3.5 h-3.5" />,
                                onSelect: () => window.open(`/p/${p.handle}`, "_blank"),
                              },
                              // Player-reported review — flag-gated. Filtered
                              // out of the menu when the advanced flag is OFF
                              // so the row action is invisible on the live
                              // pilot. Coach-side read-only surface for
                              // verifying what the player typed for themselves.
                              ...(isFeatureEnabled(
                                "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES",
                              )
                                ? [
                                    {
                                      label: "Player-reported data",
                                      icon: <FileText className="w-3.5 h-3.5" />,
                                      onSelect: () =>
                                        router.push(
                                          `/app/roster/${p.id}/reported`,
                                        ),
                                    },
                                  ]
                                : []),
                              {
                                label: "Delete player",
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                danger: true,
                                onSelect: async () => {
                                  if (!confirm(`Delete ${p.firstName} ${p.lastName}? This can't be undone.`)) {
                                    return;
                                  }
                                  const r = await deletePlayerAction(p.id);
                                  if (r.error) {
                                    toast.error("Couldn't delete", { description: r.error });
                                  } else {
                                    toast.success(`Deleted ${p.firstName} ${p.lastName}`);
                                    router.refresh();
                                  }
                                },
                              },
                            ]}
                          />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-[14px] py-2.5 border-t border-hair bg-paper text-[12px] text-ink-3">
              <div>
                Showing <b className="text-ink">{filtered.length}</b> of{" "}
                <b className="text-ink">{players.length}</b> player{players.length === 1 ? "" : "s"}
              </div>
            </div>
            </div>
            )}
          </div>
        </div>
      </div>

      <AddPlayerModal open={addOpen} onOpenChange={setAddOpen} />
      <AddPlayerModal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        editing={editing}
      />
      <ImportRosterModal open={importOpen} onOpenChange={setImportOpen} />
      <ImportStatsModal open={importStatsOpen} onOpenChange={setImportStatsOpen} levels={levels} />
      <PlayerSlideover
        player={slideoverPlayer}
        players={filtered}
        stats={slideoverPlayer ? battingByPlayer[slideoverPlayer.id] ?? null : null}
        measurables={slideoverPlayer ? measurablesByPlayer[slideoverPlayer.id] ?? null : null}
        pitching={slideoverPlayer ? pitchingByPlayer[slideoverPlayer.id] ?? null : null}
        open={slideoverPlayer !== null}
        onOpenChange={(o) => !o && setSlideoverPlayer(null)}
        onEdit={(p) => {
          // If the slideover wants to navigate to another player (prev/next),
          // we receive the new player here. If id matches the current one, treat
          // as an "Edit" action and open the edit modal.
          if (p.id === slideoverPlayer?.id) {
            setSlideoverPlayer(null);
            setEditing({
              id: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              grade:
                p.classYearShort === "Fr"
                  ? 9
                  : p.classYearShort === "So"
                    ? 10
                    : p.classYearShort === "Jr"
                      ? 11
                      : p.classYearShort === "Sr"
                        ? 12
                        : null,
              positions: p.positions,
              playerNumber: p.jerseyNumber || null,
            });
          } else {
            setSlideoverPlayer(p);
          }
        }}
      />
    </>
  );
}

// ── Subcomponents ──────────────────────────────────────────────

function LevelTab({
  active,
  onClick,
  label,
  count,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-sm text-[13px] font-semibold transition-colors",
        active ? "bg-card text-ink shadow-card" : "text-ink-3 hover:text-ink",
      )}
    >
      {label}
      <span
        className={cn(
          "font-mono text-[11px] px-1.5 py-0.5 rounded-[4px]",
          active ? "bg-ink text-white" : "bg-paper-deep text-ink-2",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ViewModeButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 rounded-xs text-[12px] font-medium transition-colors",
        active ? "bg-card text-ink shadow-card" : "text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function BulkButton({ children }: { children: string }) {
  return (
    <button
      onClick={() => comingSoon(children, "Batch mutations wire up with real data next.")}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-sm text-[12px] font-medium"
    >
      {children}
    </button>
  );
}

function BulkMoveButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[12px] font-semibold transition-colors",
        danger
          ? "bg-red/80 hover:bg-red text-white"
          : "bg-white/10 hover:bg-white/20 text-white",
      )}
    >
      {label}
    </button>
  );
}

function Th({
  children,
  width,
  align = "left",
  mobileHidden,
}: {
  children?: React.ReactNode;
  width?: string;
  align?: "left" | "right";
  mobileHidden?: boolean;
}) {
  return (
    <th
      style={{ width, textAlign: align }}
      className={cn(
        "bg-paper px-[14px] py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 border-b border-hair sticky top-0",
        mobileHidden && "hidden md:table-cell",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  align = "left",
  onClickStopPropagation,
  mobileHidden,
}: {
  children?: React.ReactNode;
  mono?: boolean;
  align?: "left" | "right";
  onClickStopPropagation?: boolean;
  mobileHidden?: boolean;
}) {
  return (
    <td
      style={{ textAlign: align }}
      onClick={onClickStopPropagation ? (e) => e.stopPropagation() : undefined}
      className={cn(
        "px-[14px] py-3 border-b border-hair-2 align-middle",
        mono && "font-mono",
        mobileHidden && "hidden md:table-cell",
      )}
    >
      {children}
    </td>
  );
}

function AvailabilityLabel({
  status,
  note,
}: {
  status: AvailabilityStatus;
  note?: string;
}) {
  const map: Record<AvailabilityStatus, { color: string; dot: string; label: string }> = {
    ok: { color: "text-grass", dot: "bg-grass", label: "Available" },
    questionable: { color: "text-amber", dot: "bg-amber", label: note ?? "Questionable" },
    out: { color: "text-red", dot: "bg-red", label: note ?? "Out" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-semibold", s.color)}>
      <span className={cn("w-[7px] h-[7px] rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function ProfileLinkBadge({ status }: { status: ProfileStatus }) {
  const map: Record<ProfileStatus, { bg: string; color: string; label: string }> = {
    linked: { bg: "bg-grass-dim", color: "text-grass", label: "LINKED" },
    pending: { bg: "bg-amber-soft", color: "text-amber", label: "PENDING" },
    unlinked: { bg: "bg-paper-deep", color: "text-ink-3", label: "UNLINKED" },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10.5px] font-bold tracking-[0.03em]",
        s.bg,
        s.color,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", s.color.replace("text-", "bg-"))} />
      {s.label}
    </span>
  );
}

/**
 * renderRealBA — if the player has recorded at-bats, render their BA
 * with the baseball-convention leading-dot format (".372"). Returns
 * null so the caller can fall through to mock BA / em-dash when no
 * real events exist yet.
 */
function renderRealBA(
  line?: { games: number; ba: number },
): React.ReactNode | null {
  if (!line || line.games === 0) return null;
  const formatted = Number(line.ba).toFixed(3);
  const display = formatted.startsWith("0") ? formatted.slice(1) : formatted;
  return (
    <span className="text-ink font-semibold" title={`${line.games} games`}>
      {display}
    </span>
  );
}

/**
 * PlayerCardsGrid — alternative to the table layout. A responsive
 * 1-2-3 column grid of player cards. Designed for mobile-first feel
 * (each card is touch-target-sized) but works fine on desktop too.
 *
 * Each card surfaces what a coach actually scans for at a glance:
 * jersey, name, level pill, position/class, BA, availability badge.
 * Click anywhere on the card → opens the slideover (same behavior
 * as table rows). Checkbox in the corner is for bulk actions.
 */
function PlayerCardsGrid({
  players,
  battingByPlayer,
  onSelect,
  selected,
  toggleRow,
  levels,
}: {
  players: MockPlayer[];
  battingByPlayer: Record<
    string,
    { games: number; ba: number; obp: number; slg: number; ops: number; hr: number; rbi: number }
  >;
  onSelect: (p: MockPlayer) => void;
  selected: Set<string>;
  toggleRow: (id: string) => void;
  levels: string[];
}) {
  if (players.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[13px] text-ink-3">
        No players match these filters.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3">
      {players.map((p) => {
        const isSelected = selected.has(p.id);
        const stats = battingByPlayer[p.id];
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={cn(
              "group text-left bg-card border rounded-lg p-3 transition-all hover:border-red active:scale-[0.99]",
              isSelected ? "border-red bg-red-soft" : "border-hair",
            )}
          >
            <div className="flex items-start gap-2.5">
              <Avatar size="md" color={p.avatarColor} initials={p.initials} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display font-semibold text-[14.5px] tracking-tight truncate">
                    {p.firstName} {p.lastName}
                  </span>
                  {p.hot && <span className="text-[12px]" aria-label="hot">🔥</span>}
                </div>
                <div className="font-mono text-[11px] text-ink-3 mt-0.5 truncate">
                  #{p.jerseyNumber} · {p.positions.join("/")} · {p.classYearShort}
                </div>
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRow(p.id);
                }}
                role="button"
                tabIndex={-1}
                className="shrink-0 -m-1 p-1"
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleRow(p.id)}
                  aria-label={`Select ${p.firstName}`}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <div className="bg-paper rounded-sm px-1.5 py-1.5">
                <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.05em]">BA</div>
                <div className="font-mono text-[14px] font-semibold tracking-tight mt-0.5">
                  {renderRealBA(stats) ?? p.ba ?? <span className="text-ink-4">—</span>}
                </div>
              </div>
              <div className="bg-paper rounded-sm px-1.5 py-1.5">
                <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.05em]">OPS</div>
                <div className="font-mono text-[14px] font-semibold tracking-tight mt-0.5">
                  {stats?.ops ? formatAvgInline(stats.ops) : <span className="text-ink-4">—</span>}
                </div>
              </div>
              <div className="bg-paper rounded-sm px-1.5 py-1.5">
                <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.05em]">ERA</div>
                <div className="font-mono text-[14px] font-semibold tracking-tight mt-0.5">
                  {p.era ?? <span className="text-ink-4">—</span>}
                </div>
              </div>
            </div>

            <div
              className="mt-2.5 flex items-center justify-between gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <LevelPicker
                playerId={p.id}
                playerName={`${p.firstName} ${p.lastName}`}
                level={p.levelName ?? shortToLongName(p.level)}
                levels={levels}
              />
              <AvailabilityLabel status={p.availabilityStatus} note={p.availabilityNote} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Shared format helper used by the cards view's stat tiles. */
function formatAvgInline(n: number): string {
  return n.toFixed(3).replace(/^0/, "");
}
