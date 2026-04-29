"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  ExternalLink,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  AlertCircle,
  Link2,
  Copy,
  RefreshCw,
  CheckCircle2,
  QrCode,
  Printer,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { LevelPill } from "@/components/atoms/level-pill";
import { cn } from "@/lib/utils";
import {
  setPlayerAvailabilityAction,
  fetchPlayerNotesAction,
  createNoteAction,
  deleteNoteAction,
  deletePlayerAction,
  type PlayerNote,
} from "@/app/app/roster/actions";
import {
  fetchClaimTokenAction,
  regenerateClaimTokenAction,
} from "@/app/claim/[token]/actions";
import type { MockPlayer } from "@/lib/mock-data";
import { comingSoon } from "@/lib/coming-soon";
import { EditProfileMediaModal } from "@/components/organisms/edit-profile-media-modal";

/**
 * PlayerSlideover — 460px right-side panel.
 * COMPONENTS.md §Organisms/<PlayerSlideover>. Tabs: Overview,
 * Availability, Notes, Metrics. Opens over the roster table.
 */
const TABS = ["Overview", "Availability", "Notes", "Metrics", "Claim"] as const;
type Tab = (typeof TABS)[number];

export interface PlayerSlideoverStats {
  games: number;
  ba: number;
  obp: number;
  slg: number;
  ops: number;
  hr: number;
  rbi: number;
}

/**
 * One verified measurable for the Metrics tab. Mirrors the
 * `PlayerMeasurable` shape from /lib/services/tryouts.ts so callers
 * can pass either real (from tryout_scores) or mock data without
 * adapter logic.
 */
export interface PlayerSlideoverMeasurable {
  shortCode: string;
  stationName: string;
  unit: string | null;
  bestValue: number;
  scoreType: "lower_better" | "higher_better" | "rating";
  latestAt: string | null;
  verifiedByCoachName: string | null;
}

export function PlayerSlideover({
  player,
  players,
  stats,
  measurables,
  pitching,
  onEdit,
  onOpenChange,
  open,
}: {
  player: MockPlayer | null;
  players: MockPlayer[];
  stats?: PlayerSlideoverStats | null;
  /** Verified combine measurables — populates the Metrics tab. */
  measurables?: PlayerSlideoverMeasurable[] | null;
  /** Pitching line, when the player pitches. Shown alongside batting in Overview. */
  pitching?: { games: number; era: number; whip: number; ip: number; k: number; bb: number } | null;
  onEdit?: (player: MockPlayer) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [claim, setClaim] = useState<{ token: string; claimed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editMediaOpen, setEditMediaOpen] = useState(false);

  // Where are we in the list?
  const index = player ? players.findIndex((p) => p.id === player.id) : -1;
  const prevPlayer = index > 0 ? players[index - 1] : null;
  const nextPlayer = index >= 0 && index < players.length - 1 ? players[index + 1] : null;

  useEffect(() => {
    if (!player) return;
    setError(null);
    setTab("Overview");
    setClaim(null);
    setCopied(false);
    fetchPlayerNotesAction(player.id).then(({ notes }) => setNotes(notes));
  }, [player?.id]);

  // Lazy-load the claim token when the Claim tab first opens.
  useEffect(() => {
    if (tab !== "Claim" || !player || claim) return;
    fetchClaimTokenAction(player.id).then((r) => {
      if (!r.error && r.token) {
        setClaim({ token: r.token, claimed: Boolean(r.claimed) });
      }
    });
  }, [tab, player?.id, claim]);

  const claimUrl = claim
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/claim/${claim.token}`
    : "";

  const copyClaimLink = async () => {
    if (!claimUrl) return;
    try {
      await navigator.clipboard.writeText(claimUrl);
      setCopied(true);
      toast.success("Claim link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select + copy manually");
    }
  };

  const regenerateClaimLink = async () => {
    if (!player) return;
    if (!confirm("Generate a new claim link? The old one will stop working.")) return;
    const r = await regenerateClaimTokenAction(player.id);
    if (r.error) return toast.error("Couldn't regenerate", { description: r.error });
    if (r.newToken) {
      setClaim({ token: r.newToken, claimed: false });
      toast.success("New claim link generated");
    }
  };

  if (!player) return null;

  const goTo = (p: MockPlayer | null) => {
    if (!p) return;
    onOpenChange(true);
    // Force re-open with the new player — let parent track current
    onEdit?.(p);
  };

  const setAvailability = (status: "ok" | "questionable" | "out", note?: string | null) => {
    startTransition(async () => {
      const r = await setPlayerAvailabilityAction(player.id, status, note);
      if (r.error) toast.error("Couldn't update", { description: r.error });
      else {
        toast.success(`${player.firstName} → ${statusLabel(status)}`);
        router.refresh();
      }
    });
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setError(null);
    const content = newNote;
    setNewNote("");
    const r = await createNoteAction(player.id, content);
    if (r.error) {
      setError(r.error);
      setNewNote(content);
      return;
    }
    toast.success("Note added");
    const { notes: fresh } = await fetchPlayerNotesAction(player.id);
    setNotes(fresh);
  };

  const removeNote = async (id: string) => {
    const r = await deleteNoteAction(id);
    if (r.error) toast.error("Couldn't delete note", { description: r.error });
    else {
      toast.success("Note deleted");
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/40 z-[95] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 bottom-0 w-[460px] max-w-[92vw] bg-card z-[96]",
            "shadow-[-20px_0_60px_rgba(0,0,0,0.15)] flex flex-col",
            "data-[state=open]:animate-slide-in-right",
          )}
        >
          {/* Header with prev/next */}
          <div className="px-[22px] py-4 border-b border-hair flex items-center gap-2 shrink-0">
            <button
              onClick={() => goTo(prevPlayer)}
              disabled={!prevPlayer}
              aria-label="Previous player"
              className="p-1.5 rounded-xs text-ink-3 hover:text-ink hover:bg-paper disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => goTo(nextPlayer)}
              disabled={!nextPlayer}
              aria-label="Next player"
              className="p-1.5 rounded-xs text-ink-3 hover:text-ink hover:bg-paper disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-[11.5px] text-ink-3 font-mono">
              {index + 1} of {players.length}
            </span>
            <Dialog.Close asChild>
              <button className="ml-auto p-1.5 rounded-xs text-ink-3 hover:text-ink hover:bg-paper" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Hero */}
          <div className="px-[22px] py-5 border-b border-hair-2 shrink-0">
            <div className="flex items-center gap-4">
              <Avatar size="lg" color={player.avatarColor} initials={player.initials} />
              <div className="min-w-0 flex-1">
                <Dialog.Title className="font-display text-[22px] font-semibold tracking-tight leading-tight">
                  {player.firstName} {player.lastName}
                </Dialog.Title>
                <div className="mt-1 font-mono text-[12px] text-ink-3">
                  {player.jerseyNumber ? `#${player.jerseyNumber}` : "#—"} · {player.classYearShort} ·{" "}
                  {player.positions.length > 0 ? player.positions.join("/") : "—"}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <LevelPill level={player.levelName ?? player.level} />
                  <AvailabilityBadge status={player.availabilityStatus} note={player.availabilityNote} />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-[22px] border-b border-hair flex gap-0.5 shrink-0">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-3 text-[12.5px] font-semibold border-b-2 -mb-px transition-colors",
                  t === tab ? "text-ink border-red" : "text-ink-3 border-transparent hover:text-ink",
                )}
              >
                {t}
                {t === "Notes" && notes.length > 0 && (
                  <span className="ml-1 font-mono text-[10.5px] text-ink-4">{notes.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-[22px] py-5">
            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {tab === "Overview" && (
              <div className="space-y-4 text-[13px]">
                {/* Stats panel — season batting line when available */}
                {stats && stats.games > 0 ? (
                  <div className="bg-paper border border-hair-2 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="type-label">Season batting</div>
                      <span className="font-mono text-[10.5px] text-ink-3 ml-auto">
                        {stats.games} G
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <StatBig label="AVG" value={formatAvgInline(stats.ba)} highlight={stats.ba >= 0.3} />
                      <StatBig label="OBP" value={formatAvgInline(stats.obp)} />
                      <StatBig label="OPS" value={formatAvgInline(stats.ops)} highlight={stats.ops >= 0.8} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11.5px] text-ink-3 font-mono">
                      <div>SLG <b className="text-ink">{formatAvgInline(stats.slg)}</b></div>
                      <div>HR <b className="text-ink">{stats.hr}</b> · RBI <b className="text-ink">{stats.rbi}</b></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-paper border border-dashed border-hair-2 rounded-md p-3 text-[11.5px] text-ink-3 text-center">
                    No season stats yet — import from GameChanger or live-score a game.
                  </div>
                )}

                <Field k="Name" v={`${player.firstName} ${player.lastName}`} />
                <Field k="Jersey" v={player.jerseyNumber ? `#${player.jerseyNumber}` : "—"} />
                <Field k="Class" v={player.classYear} />
                <Field k="Position" v={player.positions.length > 0 ? player.positions.join(" / ") : "—"} />
                <Field
                  k="Team"
                  v={player.levelName ?? player.level}
                />
                <Field k="Handle" v={player.handle ? `@${player.handle}` : "—"} />
                {player.handle && (
                  <div className="flex items-center gap-3 pt-2">
                    <Link
                      href={`/p/${player.handle}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 text-[12.5px] text-red font-semibold hover:underline"
                    >
                      View public profile <ExternalLink className="w-3 h-3" />
                    </Link>
                    <span className="text-ink-4">·</span>
                    <button
                      onClick={() => setEditMediaOpen(true)}
                      className="text-[12.5px] text-ink-2 font-semibold hover:text-red"
                    >
                      Edit photos / commitment / post
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === "Availability" && (
              <div className="space-y-4">
                <p className="text-[12.5px] text-ink-3">
                  What's this player&apos;s status for the next practice and game? Updates show on
                  the Coach Hub + Roster immediately.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <AvailBtn
                    label="Available"
                    color="grass"
                    active={player.availabilityStatus === "ok"}
                    onClick={() => setAvailability("ok", null)}
                    disabled={isPending}
                  />
                  <AvailBtn
                    label="Questionable"
                    color="amber"
                    active={player.availabilityStatus === "questionable"}
                    onClick={() => {
                      const note = prompt("Reason? (optional)", player.availabilityNote ?? "");
                      if (note === null) return;
                      setAvailability("questionable", note || null);
                    }}
                    disabled={isPending}
                  />
                  <AvailBtn
                    label="Out"
                    color="red"
                    active={player.availabilityStatus === "out"}
                    onClick={() => {
                      const note = prompt("Reason?", player.availabilityNote ?? "");
                      if (note === null) return;
                      setAvailability("out", note || null);
                    }}
                    disabled={isPending}
                  />
                </div>
                {player.availabilityNote && player.availabilityStatus !== "ok" && (
                  <div className="px-3 py-2.5 bg-paper rounded-md text-[12.5px]">
                    <div className="type-label mb-1">Note</div>
                    {player.availabilityNote}
                  </div>
                )}
              </div>
            )}

            {tab === "Notes" && (
              <div className="space-y-3">
                <div className="flex gap-1.5">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNote();
                      }
                    }}
                    placeholder="Quick note… e.g. Great BP round today"
                    className="flex-1 bg-paper border border-hair rounded-xs px-2.5 py-2 text-[13px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft"
                  />
                  <button
                    onClick={addNote}
                    disabled={!newNote.trim()}
                    className="px-2.5 h-[36px] rounded-xs bg-ink text-white text-[12.5px] font-semibold hover:bg-red disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {notes.length === 0 ? (
                  <div className="py-8 text-center">
                    <MessageSquare className="w-6 h-6 text-ink-4 mx-auto" />
                    <div className="mt-2 text-[13px] font-semibold">No notes yet</div>
                    <div className="text-[11.5px] text-ink-3 mt-1 max-w-[260px] mx-auto">
                      Post-practice observations, evaluations, medical, disciplinary — all captured here.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div
                        key={n.id}
                        className="bg-paper border-l-[3px] border-l-red rounded-md px-3 py-2.5 text-[12.5px]"
                      >
                        <div className="text-ink-2 leading-relaxed whitespace-pre-wrap">{n.content}</div>
                        <div className="mt-1.5 flex items-center gap-2 text-[10.5px] font-mono text-ink-3">
                          <span>{n.coachName ?? "Coach"}</span>
                          <span>·</span>
                          <span>{formatNoteDate(n.createdAt)}</span>
                          <button
                            onClick={() => removeNote(n.id)}
                            className="ml-auto text-ink-4 hover:text-red"
                            aria-label="Delete note"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "Metrics" && (
              <div className="space-y-3">
                <div className="text-[11.5px] text-ink-3 leading-relaxed">
                  Verified measurables — captured from tryouts + games. Exit
                  velo, 60-yard, pop time, vert jump, fastball velocity.
                </div>
                {measurables && measurables.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {measurables.map((m) => (
                        <div key={m.shortCode} className="bg-paper rounded-md p-3">
                          <div className="font-mono text-[20px] font-semibold tracking-[-0.02em]">
                            {formatMeasurableValue(m)}
                            {m.unit && (
                              <span className="text-[11px] text-ink-3 ml-0.5 font-normal">
                                {m.unit}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-1">
                            {m.stationName}
                          </div>
                          {m.verifiedByCoachName && (
                            <div className="text-[10px] text-grass mt-0.5 font-semibold">
                              ✓ {m.verifiedByCoachName.split(" ")[0]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {pitching && pitching.games > 0 && (
                      <div className="mt-4 pt-3 border-t border-hair-2">
                        <div className="type-label mb-2">Pitching</div>
                        <div className="grid grid-cols-3 gap-2">
                          <StatBig label="ERA" value={pitching.era.toFixed(2)} highlight={pitching.era < 3} />
                          <StatBig label="WHIP" value={pitching.whip.toFixed(2)} highlight={pitching.whip < 1.2} />
                          <StatBig label="IP" value={pitching.ip.toFixed(1)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-[11.5px] text-ink-3 font-mono">
                          <div>K <b className="text-ink">{pitching.k}</b></div>
                          <div>BB <b className="text-ink">{pitching.bb}</b></div>
                          <div>G <b className="text-ink">{pitching.games}</b></div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-paper border border-dashed border-hair-2 rounded-md p-4 text-center text-[12px] text-ink-3">
                    No verified measurables yet. Run a tryout or use the
                    Combine workflow to capture them.
                  </div>
                )}
              </div>
            )}

            {tab === "Claim" && (
              <div className="space-y-4">
                <p className="text-[12.5px] text-ink-3 leading-relaxed">
                  Share this link with <b className="text-ink">{player.firstName}</b> so they
                  can claim their profile. Once claimed, they can sign in, see their schedule,
                  and update their own availability. College coaches see verified measurables.
                </p>

                {claim?.claimed ? (
                  <div className="flex items-start gap-2 p-3 rounded-sm bg-grass-dim text-grass text-[12.5px]">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Already claimed</div>
                      <div className="mt-1 text-[11.5px] opacity-90">
                        This profile is linked to a user account. Regenerate the link below to
                        rotate access if needed.
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="bg-paper rounded-md border border-hair px-3 py-2.5">
                  <div className="type-label mb-1">Claim link</div>
                  <div className="flex items-center gap-2 font-mono text-[11.5px] break-all text-ink-2">
                    <Link2 className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                    <span className="flex-1 min-w-0">{claim ? claimUrl : "Loading…"}</span>
                  </div>
                </div>

                {/* QR code for printable handouts */}
                {claim && (
                  <div className="bg-card border border-hair rounded-md p-4 flex items-center gap-4">
                    <div className="bg-white p-2 rounded-sm border border-hair-2 shrink-0">
                      <QRCodeSVG
                        value={claimUrl}
                        size={110}
                        bgColor="#ffffff"
                        fgColor="#0e1116"
                        level="M"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="type-label mb-1 flex items-center gap-1">
                        <QrCode className="w-3 h-3" /> Scan to claim
                      </div>
                      <div className="text-[12.5px] font-semibold">
                        {player.firstName} {player.lastName}
                      </div>
                      <div className="text-[11px] text-ink-3 mt-0.5">
                        Print this on a tryout handout — players scan from their phone and claim in 5 seconds.
                      </div>
                      <button
                        onClick={() => openQrPrintWindow(claimUrl, `${player.firstName} ${player.lastName}`, player.jerseyNumber)}
                        className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-red font-semibold hover:underline"
                      >
                        <Printer className="w-3 h-3" /> Print QR card
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={copyClaimLink}
                    disabled={!claim}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-[38px] bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold disabled:opacity-50 transition-colors"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy link
                      </>
                    )}
                  </button>
                  <button
                    onClick={regenerateClaimLink}
                    disabled={!claim}
                    className="inline-flex items-center gap-1.5 px-3 h-[38px] bg-paper hover:bg-paper-deep border border-hair text-ink-2 rounded-sm text-[12.5px] font-semibold disabled:opacity-50"
                    title="Generate a new claim link (old one stops working)"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="pt-3 border-t border-hair-2 text-[11.5px] text-ink-3 leading-relaxed">
                  <b className="text-ink-2">Pro tip:</b> print a full roster of QR cards by
                  opening the Roster&apos;s Export action (next sprint) — one sheet of 20,
                  cut-out cards, hand to every player at tryouts.
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-[22px] py-3.5 border-t border-hair flex gap-2 shrink-0">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => onEdit && onEdit(player)}
            >
              <Pencil className="w-[15px] h-[15px]" /> Edit
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() =>
                comingSoon("Message player", "Athlete-facing messaging lands with the claim flow.")
              }
            >
              <MessageSquare className="w-[15px] h-[15px]" /> Message
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={async () => {
                if (!confirm(`Delete ${player.firstName} ${player.lastName}?`)) return;
                const r = await deletePlayerAction(player.id);
                if (r.error) toast.error("Couldn't delete", { description: r.error });
                else {
                  toast.success(`Deleted ${player.firstName} ${player.lastName}`);
                  onOpenChange(false);
                  router.refresh();
                }
              }}
              className="text-red"
            >
              <Trash2 className="w-[15px] h-[15px]" />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      {player && (
        <EditProfileMediaModal
          open={editMediaOpen}
          onOpenChange={setEditMediaOpen}
          playerId={player.id}
          playerName={`${player.firstName} ${player.lastName}`}
          initial={{
            avatarUrl: null,
            headerUrl: null,
            highlightVideoUrl: null,
            commitmentStatus: null,
            commitmentSchool: null,
            commitmentYear: null,
            commitmentNote: null,
          }}
        />
      )}
    </Dialog.Root>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-4 py-2 border-b border-hair-2 last:border-b-0">
      <div className="w-[88px] text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 shrink-0">
        {k}
      </div>
      <div className="flex-1 font-semibold">{v}</div>
    </div>
  );
}

function StatBig({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={cn(
          "font-mono text-[22px] font-bold tracking-[-0.02em] leading-none",
          highlight && "text-red",
        )}
      >
        {value}
      </div>
      <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-1">
        {label}
      </div>
    </div>
  );
}

/**
 * formatMeasurableValue — render a measurable's bestValue per its
 * scoreType. Mirrors the formatter used on /p/[handle] so the
 * slideover and the public profile show identical numbers.
 */
function formatMeasurableValue(m: PlayerSlideoverMeasurable): string {
  if (m.scoreType === "rating") return m.bestValue.toFixed(1);
  if (m.unit === "s") return m.bestValue.toFixed(2);
  return m.bestValue.toFixed(1).replace(/\.0$/, "");
}

function formatAvgInline(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = Number(n).toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}

function AvailabilityBadge({
  status,
  note,
}: {
  status: "ok" | "questionable" | "out";
  note?: string;
}) {
  const styles: Record<typeof status, string> = {
    ok: "bg-grass-dim text-grass",
    questionable: "bg-amber-soft text-amber",
    out: "bg-red-soft text-red",
  };
  const label = { ok: "Available", questionable: "Questionable", out: "Out" }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-[0.04em]",
        styles[status],
      )}
      title={note ?? ""}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", status === "ok" ? "bg-grass" : status === "questionable" ? "bg-amber" : "bg-red")} />
      {note ? note : label}
    </span>
  );
}

function AvailBtn({
  label,
  color,
  active,
  onClick,
  disabled,
}: {
  label: string;
  color: "grass" | "amber" | "red";
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-1 p-3 rounded-md border-2 text-[12px] font-semibold transition-all",
        active
          ? color === "grass"
            ? "border-grass bg-grass-dim text-grass"
            : color === "amber"
              ? "border-amber bg-amber-soft text-amber"
              : "border-red bg-red-soft text-red"
          : "border-hair bg-card text-ink-2 hover:border-ink-3",
        disabled && "opacity-60",
      )}
    >
      <span className={cn("w-2 h-2 rounded-full",
        color === "grass" ? "bg-grass" : color === "amber" ? "bg-amber" : "bg-red",
      )} />
      {label}
    </button>
  );
}

function statusLabel(s: "ok" | "questionable" | "out") {
  return { ok: "Available", questionable: "Questionable", out: "Out" }[s];
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

/**
 * openQrPrintWindow — opens a print-sized new window with a
 * player-specific QR claim card. Uses Google Chart API for the QR
 * image so the popup doesn't need to bundle the qrcode library.
 *
 * Layout: one card per page, 4"x4" QR + name + jersey + instructions.
 * Designed for a 3x3 grid on letter paper after hand-cutting.
 */
function openQrPrintWindow(
  url: string,
  playerName: string,
  jersey: number | string | null,
) {
  const w = window.open("", "_blank", "width=640,height=800");
  if (!w) return;
  const jerseyStr = jersey ? `#${jersey}` : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
  w.document.write(`<!doctype html>
<html><head><title>Claim card · ${playerName}</title>
<style>
  @page { size: letter; margin: 0.5in; }
  body { font-family: system-ui, sans-serif; color: #0e1116; margin: 0; padding: 24px; background: #fff; }
  .card { border: 1.5px dashed #9ca3af; border-radius: 8px; padding: 24px; text-align: center; max-width: 440px; margin: 0 auto; }
  .brand { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #c83a3a; font-weight: 700; margin-bottom: 6px; }
  .name { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
  .jersey { font-size: 16px; color: #6b7280; font-family: ui-monospace, monospace; margin-top: 4px; }
  .qr { margin: 20px auto; }
  .qr img { width: 260px; height: 260px; }
  .instructions { font-size: 13px; color: #0e1116; margin-top: 8px; line-height: 1.45; }
  .url { margin-top: 10px; font-family: ui-monospace, monospace; font-size: 10px; color: #9ca3af; word-break: break-all; }
  .footer { margin-top: 14px; font-size: 11px; color: #6b7280; font-style: italic; }
  @media print { .no-print { display: none; } }
  .no-print { text-align: center; margin-top: 20px; }
  button { font-size: 14px; padding: 10px 20px; background: #c83a3a; color: #fff; border: 0; border-radius: 4px; font-weight: 600; cursor: pointer; }
</style>
</head><body onload="setTimeout(() => window.print(), 300)">
  <div class="card">
    <div class="brand">Rostr · Player Claim</div>
    <div class="name">${playerName}</div>
    <div class="jersey">${jerseyStr}</div>
    <div class="qr"><img src="${qrUrl}" alt="QR code" /></div>
    <div class="instructions">
      <b>Scan with your phone camera</b><br>to claim your Rostr profile.
    </div>
    <div class="url">${url}</div>
    <div class="footer">Claim once to see your schedule, stats, and career-verified measurables.</div>
  </div>
  <div class="no-print">
    <button onclick="window.print()">Print card</button>
  </div>
</body></html>`);
  w.document.close();
}
