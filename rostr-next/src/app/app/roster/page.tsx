"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Plus,
  Upload,
  MoreHorizontal,
  Download,
  X,
  ExternalLink,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Checkbox } from "@/components/atoms/checkbox";
import { Chip } from "@/components/atoms/chip";
import { LevelPill } from "@/components/atoms/level-pill";
import { cn } from "@/lib/utils";
import {
  MOCK_PLAYERS,
  type AvailabilityStatus,
  type ProfileStatus,
  type RosterLevel,
} from "@/lib/mock-data";

/**
 * /app/roster — Roster list.
 * Pixel target: handoff/designs/03_Roster_Import.html (table view).
 * Import wizard + player slide-over are stubbed for a later sprint.
 */
export default function RosterPage() {
  const router = useRouter();
  const [levelFilter, setLevelFilter] = useState<"all" | RosterLevel>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters] = useState([
    { key: "class", label: "Class: Any" },
    { key: "position", label: "Position: Any" },
    { key: "availability", label: "Availability: Any" },
  ]);

  const filtered = useMemo(() => {
    if (levelFilter === "all") return MOCK_PLAYERS;
    return MOCK_PLAYERS.filter((p) => p.level === levelFilter);
  }, [levelFilter]);

  const levelCounts = useMemo(() => {
    const base = { V: 0, JV: 0, F: 0 };
    for (const p of MOCK_PLAYERS) base[p.level]++;
    return base;
  }, []);

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
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Roster" }]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" /> },
          { kind: "ghost", label: "Export", icon: <Download className="w-[15px] h-[15px]" /> },
          { kind: "ghost", label: "Import", icon: <Upload className="w-[15px] h-[15px]" /> },
          { kind: "primary", label: "Add player", icon: <Plus className="w-[15px] h-[15px]" /> },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-7 pb-12">
        <div className="max-w-layout-app mx-auto">
          {/* Page head */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <h1 className="font-display text-display-md">Roster</h1>
              <p className="mt-1 text-ink-3 text-[14px]">
                {MOCK_PLAYERS.length} players · Spring &apos;26 season · 3 invites pending
              </p>
            </div>
          </div>

          {/* Level tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-paper-deep rounded-md w-fit">
            <LevelTab
              active={levelFilter === "all"}
              onClick={() => setLevelFilter("all")}
              label="All"
              count={MOCK_PLAYERS.length}
            />
            <LevelTab
              active={levelFilter === "V"}
              onClick={() => setLevelFilter("V")}
              label="Varsity"
              count={levelCounts.V}
            />
            <LevelTab
              active={levelFilter === "JV"}
              onClick={() => setLevelFilter("JV")}
              label="JV"
              count={levelCounts.JV}
            />
            <LevelTab
              active={levelFilter === "F"}
              onClick={() => setLevelFilter("F")}
              label="Freshman"
              count={levelCounts.F}
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 mb-4 items-center flex-wrap">
            {filters.map((f) => (
              <Chip key={f.key}>{f.label}</Chip>
            ))}
            <Chip>+ Filter</Chip>
            <div className="ml-auto flex bg-paper-deep p-[3px] rounded-sm">
              <ViewModeButton active>Table</ViewModeButton>
              <ViewModeButton>Cards</ViewModeButton>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-hair rounded-md overflow-hidden">
            {/* Bulk toolbar */}
            {selected.size > 0 && (
              <div className="flex items-center gap-3 bg-ink text-white px-4 py-2.5 text-[12.5px]">
                <b className="font-bold">{selected.size} selected</b>
                <BulkButton>Move to JV</BulkButton>
                <BulkButton>Send message</BulkButton>
                <BulkButton>Invite to profile</BulkButton>
                <BulkButton>Mark unavailable</BulkButton>
                <button
                  onClick={clearSelection}
                  className="ml-auto inline-flex items-center gap-1 text-[12px] text-white/70 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            )}

            <table className="w-full border-collapse text-[13px]">
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
                  <Th width="80px">Position</Th>
                  <Th width="70px">Class</Th>
                  <Th width="70px" align="right">BA</Th>
                  <Th width="70px" align="right">ERA</Th>
                  <Th width="110px">Today</Th>
                  <Th width="120px">Profile</Th>
                  <Th width="36px" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isSelected = selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/p/${p.handle}`)}
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
                        <LevelPill level={p.level} />
                      </Td>
                      <Td mono>{p.positions.join("/")}</Td>
                      <Td mono>{p.classYear}</Td>
                      <Td mono align="right">
                        {p.ba ?? <span className="text-ink-4">—</span>}
                      </Td>
                      <Td mono align="right">
                        {p.era ?? <span className="text-ink-4">—</span>}
                      </Td>
                      <Td>
                        <AvailabilityLabel
                          status={p.availabilityStatus}
                          note={p.availabilityNote}
                        />
                      </Td>
                      <Td>
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
                          <button className="text-ink-3 hover:text-ink hover:bg-paper-deep rounded-xs p-1">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="flex items-center justify-between px-[14px] py-2.5 border-t border-hair bg-paper text-[12px] text-ink-3">
              <div>
                Showing <b className="text-ink">{filtered.length}</b> of{" "}
                <b className="text-ink">{MOCK_PLAYERS.length}</b> players
              </div>
              <div className="font-mono text-[11.5px]">
                Last synced 12 min ago · GameChanger
              </div>
            </div>
          </div>
        </div>
      </div>
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
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        "px-2.5 py-1.5 rounded-xs text-[12px] font-medium transition-colors",
        active ? "bg-card text-ink shadow-card" : "text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function BulkButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-sm text-[12px] font-medium">
      {children}
    </button>
  );
}

function Th({
  children,
  width,
  align = "left",
}: {
  children?: React.ReactNode;
  width?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{ width, textAlign: align }}
      className="bg-paper px-[14px] py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 border-b border-hair sticky top-0"
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
}: {
  children?: React.ReactNode;
  mono?: boolean;
  align?: "left" | "right";
  onClickStopPropagation?: boolean;
}) {
  return (
    <td
      style={{ textAlign: align }}
      onClick={onClickStopPropagation ? (e) => e.stopPropagation() : undefined}
      className={cn(
        "px-[14px] py-3 border-b border-hair-2 align-middle",
        mono && "font-mono",
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
