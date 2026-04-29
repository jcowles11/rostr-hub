"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  GraduationCap,
  Trophy,
  Video,
  Plus,
  X,
  Check,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tapHaptic, thumpHaptic, errorHaptic } from "@/lib/haptic";
import { resolveVideoEmbed } from "@/lib/services/player-profile-types";
import type {
  PlayerAcademics,
  PlayerHighlight,
  PlayerProfileMedia,
  IntendedLevel,
} from "@/lib/services/player-profile-types";
import {
  updateAcademicsAction,
  updateMediaAction,
  addHighlightAction,
  removeHighlightAction,
} from "./actions";

/**
 * ProfileEditor — LinkedIn-style profile editor for the player.
 *
 * Mobile-first: sections stack vertically, big tap targets, iOS spring
 * feedback on every interaction. Sticky save button at the bottom of
 * each card so you don't have to scroll back to commit.
 *
 * The shape mirrors what a recruiter sees on /p/[handle] so editing
 * here directly maps to "what shows on my profile" — no hidden fields.
 */
interface ProfileEditorProps {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    slug: string | null;
    grade: number | null;
    positions: string[];
    jerseyNumber: number | null;
  };
  academics: PlayerAcademics;
  media: PlayerProfileMedia;
  highlights: PlayerHighlight[];
}

const INTENDED_LEVELS: { value: IntendedLevel; label: string; description: string }[] = [
  { value: "D1", label: "D1", description: "NCAA Division I — top tier" },
  { value: "D2", label: "D2", description: "NCAA Division II" },
  { value: "D3", label: "D3", description: "NCAA Division III — academic-focused" },
  { value: "NAIA", label: "NAIA", description: "National Association of Intercollegiate Athletics" },
  { value: "Juco", label: "Juco", description: "Junior college / two-year programs" },
  { value: "Open", label: "Open", description: "Anywhere I can play" },
  { value: "Other", label: "Other", description: "Prep school, post-grad, etc." },
];

export function ProfileEditor({
  player,
  academics: initialAcademics,
  media: initialMedia,
  highlights: initialHighlights,
}: ProfileEditorProps) {
  // ── State (one per section so saves are scoped) ──────────────
  const [media, setMedia] = useState({
    avatarUrl: initialMedia.avatarUrl ?? "",
    headerUrl: initialMedia.headerUrl ?? "",
    schoolLogoUrl: initialAcademics.schoolLogoUrl ?? "",
  });
  const [academics, setAcademics] = useState({
    gpa: initialAcademics.gpa ?? "",
    satScore: initialAcademics.satScore?.toString() ?? "",
    actScore: initialAcademics.actScore?.toString() ?? "",
    classRankNumerator: initialAcademics.classRankNumerator?.toString() ?? "",
    classRankDenominator: initialAcademics.classRankDenominator?.toString() ?? "",
    intendedLevel: (initialAcademics.intendedLevel ?? null) as IntendedLevel | null,
    bio: initialAcademics.bio ?? "",
  });
  const [highlights, setHighlights] = useState<PlayerHighlight[]>(initialHighlights);
  const [newHighlight, setNewHighlight] = useState({ url: "", caption: "" });

  const [pending, startTransition] = useTransition();

  // ── Initials for the avatar fallback ─────────────────────────
  const initials = `${player.firstName[0] ?? "?"}${player.lastName[0] ?? "?"}`.toUpperCase();

  function saveMedia() {
    thumpHaptic();
    startTransition(async () => {
      const res = await updateMediaAction({
        avatarUrl: media.avatarUrl,
        headerUrl: media.headerUrl,
        schoolLogoUrl: media.schoolLogoUrl,
      });
      if (res.error) {
        errorHaptic();
        toast.error(res.error);
      } else {
        toast.success("Photos updated");
      }
    });
  }

  function saveAcademics() {
    thumpHaptic();
    // Coerce empty strings → null, valid numbers → numbers, invalid → error.
    const sat = academics.satScore.trim() ? Number(academics.satScore) : null;
    const act = academics.actScore.trim() ? Number(academics.actScore) : null;
    const rankNum = academics.classRankNumerator.trim()
      ? Number(academics.classRankNumerator)
      : null;
    const rankDen = academics.classRankDenominator.trim()
      ? Number(academics.classRankDenominator)
      : null;

    if (sat !== null && (Number.isNaN(sat) || sat < 400 || sat > 1600)) {
      errorHaptic();
      toast.error("SAT score must be 400–1600");
      return;
    }
    if (act !== null && (Number.isNaN(act) || act < 1 || act > 36)) {
      errorHaptic();
      toast.error("ACT score must be 1–36");
      return;
    }
    if (rankNum !== null && rankDen !== null && rankNum > rankDen) {
      errorHaptic();
      toast.error("Class rank can't exceed class size");
      return;
    }

    startTransition(async () => {
      const res = await updateAcademicsAction({
        gpa: academics.gpa.trim() || null,
        satScore: sat,
        actScore: act,
        classRankNumerator: rankNum,
        classRankDenominator: rankDen,
        intendedLevel: academics.intendedLevel,
        bio: academics.bio.trim() || null,
      });
      if (res.error) {
        errorHaptic();
        toast.error(res.error);
      } else {
        toast.success("Academics updated");
      }
    });
  }

  function addHighlight() {
    if (!newHighlight.url.trim()) return;
    thumpHaptic();
    startTransition(async () => {
      const res = await addHighlightAction({
        url: newHighlight.url.trim(),
        caption: newHighlight.caption.trim() || null,
      });
      if (res.error) {
        errorHaptic();
        toast.error(res.error);
        return;
      }
      // Optimistic add — page revalidate happens server-side, but the
      // user gets immediate visual feedback.
      setHighlights((cur) => [
        ...cur,
        {
          id: res.id ?? crypto.randomUUID(),
          playerId: player.id,
          url: newHighlight.url.trim(),
          caption: newHighlight.caption.trim() || null,
          thumbnailUrl: null,
          sortOrder: cur.length,
          createdAt: new Date().toISOString(),
        },
      ]);
      setNewHighlight({ url: "", caption: "" });
      toast.success("Highlight added");
    });
  }

  function removeHighlight(id: string) {
    tapHaptic(8);
    startTransition(async () => {
      const res = await removeHighlightAction(id);
      if (res.error) {
        errorHaptic();
        toast.error(res.error);
        return;
      }
      setHighlights((cur) => cur.filter((h) => h.id !== id));
      toast.success("Highlight removed");
    });
  }

  return (
    <div className="min-h-screen bg-paper pb-12">
      {/* Sticky iOS-style top bar */}
      <header
        className={cn(
          "sticky top-0 z-topbar h-12 px-3 flex items-center gap-2",
          "bg-paper/85 backdrop-blur-xl backdrop-saturate-150",
          "border-b border-hair",
        )}
      >
        <Link
          href="/me"
          onPointerDown={() => tapHaptic(6)}
          className={cn(
            "w-9 h-9 inline-flex items-center justify-center rounded-full",
            "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "hover:bg-hair-2 active:scale-[0.88]",
          )}
        >
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.25} />
        </Link>
        <div className="flex-1 min-w-0 font-display text-[15px] font-bold tracking-tight truncate">
          Edit profile
        </div>
        {player.slug && (
          <Link
            href={`/p/${player.slug}`}
            onPointerDown={() => tapHaptic(6)}
            className={cn(
              "inline-flex items-center gap-1 text-[12px] font-semibold text-red px-2 h-9 rounded-full",
              "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              "hover:bg-red-soft active:scale-[0.92]",
            )}
          >
            View public <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </header>

      <div className="max-w-[640px] mx-auto px-4 sm:px-6 pt-5 pb-24">
        {/* ── Identity hero ──────────────────────────────────── */}
        <section className="bg-card border border-hair rounded-2xl overflow-hidden mb-5">
          <div className="relative h-32 bg-gradient-to-br from-ink to-[#1a1f28]">
            {media.headerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.headerUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute -bottom-9 left-5 w-[72px] h-[72px] rounded-full ring-4 ring-card overflow-hidden bg-dirt flex items-center justify-center text-white font-bold text-[26px] tracking-tight">
              {media.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>
          <div className="px-5 pt-12 pb-4">
            <div className="font-display text-[20px] font-semibold tracking-tight">
              {player.firstName} {player.lastName}
            </div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">
              {player.positions.join("/") || "Position TBD"}
              {player.grade ? ` · Grade ${player.grade}` : ""}
              {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
            </div>
          </div>
        </section>

        {/* ── Photos ─────────────────────────────────────────── */}
        <SectionCard
          icon={<Camera className="w-4 h-4" />}
          tone="bg-sky-soft text-sky"
          title="Photos"
          description="Profile picture, header image, and school logo. Paste any public image URL — Imgur, Cloudinary, etc."
        >
          <div className="space-y-3">
            <Field
              label="Profile picture URL"
              placeholder="https://..."
              value={media.avatarUrl}
              onChange={(v) => setMedia((m) => ({ ...m, avatarUrl: v }))}
              hint="Square works best — circle crop applied automatically."
            />
            <Field
              label="Header image URL"
              placeholder="https://..."
              value={media.headerUrl}
              onChange={(v) => setMedia((m) => ({ ...m, headerUrl: v }))}
              hint="Wide format (1500×500-ish). Action shot, batting cage, field, etc."
            />
            <Field
              label="School logo URL"
              placeholder="https://..."
              value={media.schoolLogoUrl}
              onChange={(v) => setMedia((m) => ({ ...m, schoolLogoUrl: v }))}
              hint="Your high school's logo. PNG with transparent background renders cleanest."
            />
          </div>
          <SaveButton onClick={saveMedia} pending={pending} label="Save photos" />
        </SectionCard>

        {/* ── Bio ────────────────────────────────────────────── */}
        <SectionCard
          icon={<GraduationCap className="w-4 h-4" />}
          tone="bg-grass-dim text-grass"
          title="About me"
          description="Short blurb that appears at the top of your public profile. Anything you'd want a college coach to read first."
        >
          <textarea
            value={academics.bio}
            onChange={(e) => setAcademics((a) => ({ ...a, bio: e.target.value }))}
            placeholder="Two-way infielder, 4-year varsity, leadoff hitter…"
            rows={4}
            maxLength={500}
            className={cn(
              "w-full rounded-xl border border-hair bg-paper px-3 py-2.5 text-[14px]",
              "focus:outline-none focus:border-red focus:ring-2 focus:ring-red-soft",
              "resize-none",
            )}
          />
          <div className="mt-1 text-[11px] text-ink-3 text-right tabular-nums">
            {academics.bio.length} / 500
          </div>
          {/* Saved by the academics section's save button. */}
        </SectionCard>

        {/* ── Academics ──────────────────────────────────────── */}
        <SectionCard
          icon={<GraduationCap className="w-4 h-4" />}
          tone="bg-amber-soft text-amber"
          title="Academics"
          description="All optional. Recruiters value any of these — you decide what to share. We can't see what you don't enter."
        >
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="GPA"
              placeholder="3.85"
              value={academics.gpa}
              onChange={(v) => setAcademics((a) => ({ ...a, gpa: v }))}
              inputMode="decimal"
            />
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="SAT"
                placeholder="1320"
                value={academics.satScore}
                onChange={(v) => setAcademics((a) => ({ ...a, satScore: v }))}
                inputMode="numeric"
              />
              <Field
                label="ACT"
                placeholder="28"
                value={academics.actScore}
                onChange={(v) => setAcademics((a) => ({ ...a, actScore: v }))}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1.5">
              Class rank (optional)
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={academics.classRankNumerator}
                onChange={(e) =>
                  setAcademics((a) => ({ ...a, classRankNumerator: e.target.value }))
                }
                placeholder="5"
                className={cn(
                  "w-20 rounded-xl border border-hair bg-paper px-3 py-2 text-[14px] text-center tabular-nums",
                  "focus:outline-none focus:border-red focus:ring-2 focus:ring-red-soft",
                )}
              />
              <span className="text-[12.5px] text-ink-3">of</span>
              <input
                type="text"
                inputMode="numeric"
                value={academics.classRankDenominator}
                onChange={(e) =>
                  setAcademics((a) => ({ ...a, classRankDenominator: e.target.value }))
                }
                placeholder="240"
                className={cn(
                  "w-24 rounded-xl border border-hair bg-paper px-3 py-2 text-[14px] text-center tabular-nums",
                  "focus:outline-none focus:border-red focus:ring-2 focus:ring-red-soft",
                )}
              />
            </div>
          </div>
          <SaveButton onClick={saveAcademics} pending={pending} label="Save academics" />
        </SectionCard>

        {/* ── Intended level ─────────────────────────────────── */}
        <SectionCard
          icon={<Trophy className="w-4 h-4" />}
          tone="bg-red-soft text-red"
          title="Intended college level"
          description="What level are you targeting? Helps recruiters at the right tier find you."
        >
          <div className="grid grid-cols-2 gap-2">
            {INTENDED_LEVELS.map((level) => {
              const active = academics.intendedLevel === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => {
                    tapHaptic(6);
                    setAcademics((a) => ({
                      ...a,
                      intendedLevel: active ? null : level.value,
                    }));
                  }}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left",
                    "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    "active:scale-[0.97]",
                    active
                      ? "bg-red text-white border-red shadow-[0_2px_10px_-2px_rgba(200,58,58,0.4)]"
                      : "bg-paper border-hair hover:border-ink-3",
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-display text-[14px] font-bold tracking-tight">
                      {level.label}
                    </span>
                    {active && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                  </div>
                  <span
                    className={cn(
                      "text-[10.5px] leading-snug",
                      active ? "text-white/80" : "text-ink-3",
                    )}
                  >
                    {level.description}
                  </span>
                </button>
              );
            })}
          </div>
          <SaveButton onClick={saveAcademics} pending={pending} label="Save intended level" />
        </SectionCard>

        {/* ── Highlights ─────────────────────────────────────── */}
        <SectionCard
          icon={<Video className="w-4 h-4" />}
          tone="bg-paper-deep text-ink"
          title="Highlight videos"
          description="YouTube, Hudl, or Vimeo links. Up to 6 clips render embedded on your public profile."
        >
          {/* List of current highlights */}
          <ul className="space-y-2 mb-4">
            {highlights.length === 0 && (
              <li className="text-[12.5px] text-ink-3 italic px-1">
                No highlights yet.
              </li>
            )}
            {highlights.map((h) => {
              const embed = resolveVideoEmbed(h.url);
              return (
                <li
                  key={h.id}
                  className="flex items-center gap-3 p-2 rounded-xl border border-hair bg-paper"
                >
                  <span
                    className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                      embed?.thumbnailUrl ? "bg-ink" : "bg-hair-2 text-ink-3",
                    )}
                  >
                    {embed?.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={embed.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold truncate">
                      {h.caption ?? embed?.provider ?? "Highlight"}
                    </div>
                    <div className="text-[10.5px] text-ink-3 truncate">{h.url}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHighlight(h.id)}
                    aria-label="Remove highlight"
                    disabled={pending}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-ink-3",
                      "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                      "hover:bg-red-soft hover:text-red active:scale-[0.88]",
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Add new */}
          <div className="space-y-2">
            <Field
              label="Video URL"
              placeholder="https://youtu.be/..."
              value={newHighlight.url}
              onChange={(v) => setNewHighlight((s) => ({ ...s, url: v }))}
              hint="Paste a YouTube, Hudl, or Vimeo link."
            />
            <Field
              label="Caption (optional)"
              placeholder="Senior year HR vs. North"
              value={newHighlight.caption}
              onChange={(v) => setNewHighlight((s) => ({ ...s, caption: v }))}
            />
            <button
              type="button"
              onClick={addHighlight}
              disabled={pending || !newHighlight.url.trim()}
              className={cn(
                "mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-red text-white font-bold text-[14px] h-11",
                "shadow-[0_4px_14px_-4px_rgba(200,58,58,0.5)]",
                "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                "active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
              )}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Add highlight
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────

function SectionCard({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-hair rounded-2xl p-4 sm:p-5 mb-5">
      <div className="flex items-start gap-3 mb-3">
        <span
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            tone,
          )}
        >
          {icon}
        </span>
        <div>
          <h2 className="font-display text-[16px] font-bold tracking-tight">{title}</h2>
          {description && (
            <p className="text-[11.5px] text-ink-3 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric" | "url";
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        inputMode={inputMode ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-hair bg-paper px-3 py-2.5 text-[14px]",
          "focus:outline-none focus:border-red focus:ring-2 focus:ring-red-soft",
        )}
      />
      {hint && <p className="mt-1 text-[10.5px] text-ink-3 leading-snug">{hint}</p>}
    </div>
  );
}

function SaveButton({
  onClick,
  pending,
  label,
}: {
  onClick: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink text-white font-bold text-[13.5px] h-11",
        "shadow-[0_4px_14px_-4px_rgba(0,0,0,0.3)]",
        "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
      )}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
