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
  Lock,
  ListChecks,
  Eye,
  EyeOff,
  AtSign,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tapHaptic, thumpHaptic, errorHaptic } from "@/lib/haptic";
import { resolveVideoEmbed } from "@/lib/services/player-profile-types";
import type {
  PlayerAcademics,
  PlayerHighlight,
  PlayerProfileMedia,
  PlayerPrivacy,
  PlayerPriorStat,
  PlayerContactInfo,
  IntendedLevel,
} from "@/lib/services/player-profile-types";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { PlayerReportedBadge } from "@/components/atoms/data-source-badge";
import {
  updateAcademicsAction,
  updateMediaAction,
  addHighlightAction,
  removeHighlightAction,
  updatePrivacyAction,
  updatePriorStatsAction,
  updateContactInfoAction,
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
  /**
   * Privacy switches (advanced-profiles flag).
   * Defaults to all-OFF when flag is off / row is missing.
   */
  privacy: PlayerPrivacy;
  /**
   * Player-reported prior season stats (advanced + prior-stats sub-flag).
   * Defaults to [] when flag is off / row is missing.
   */
  priorStats: PlayerPriorStat[];
  /**
   * Player-typed contact + social handles (advanced flag, migration 35).
   * All fields default null. Visibility on /p/<handle> requires
   * profile_public AND show_contact_info to BOTH be on.
   */
  contactInfo: PlayerContactInfo;
}

/**
 * Empty row used when the player adds a new prior-season entry.
 * Keep field names matching `PlayerPriorStat` so submit can pass through.
 */
function blankPriorStat(): PlayerPriorStat {
  return {
    season: "",
    level: null,
    ba: null,
    ops: null,
    hr: null,
    rbi: null,
    pitching: null,
    context: null,
  };
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
  privacy: initialPrivacy,
  priorStats: initialPriorStats,
  contactInfo: initialContactInfo,
}: ProfileEditorProps) {
  // ── Feature flags (read once on mount — Next inlines NEXT_PUBLIC_*
  //    at build time, so these compile to literal booleans). ──────
  const advancedProfilesOn = isFeatureEnabled(
    "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES",
  );
  const priorStatsOn =
    advancedProfilesOn &&
    isFeatureEnabled("NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS");

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
  const [privacy, setPrivacy] = useState<PlayerPrivacy>(initialPrivacy);
  const [priorStats, setPriorStats] =
    useState<PlayerPriorStat[]>(initialPriorStats);
  const [contactInfo, setContactInfo] =
    useState<PlayerContactInfo>(initialContactInfo);

  const [pending, startTransition] = useTransition();

  // ── Contact info save ───────────────────────────────────────
  function saveContactInfo() {
    thumpHaptic();
    startTransition(async () => {
      const res = await updateContactInfoAction(contactInfo);
      if (res.error) {
        errorHaptic();
        toast.error(res.error);
      } else {
        toast.success("Contact info updated");
      }
    });
  }

  // ── Privacy save ─────────────────────────────────────────────
  function savePrivacy(next: PlayerPrivacy) {
    thumpHaptic();
    // Optimistic — flip locally, revert on error.
    const prev = privacy;
    setPrivacy(next);
    startTransition(async () => {
      const res = await updatePrivacyAction(next);
      if (res.error) {
        errorHaptic();
        toast.error(res.error);
        setPrivacy(prev);
      } else {
        toast.success("Privacy updated");
      }
    });
  }

  // ── Prior stats save ─────────────────────────────────────────
  function savePriorStats(next: PlayerPriorStat[]) {
    thumpHaptic();
    // Strip empty-season rows before submit — they fail Zod (`min(1)`)
    // and are noise in the saved array anyway.
    const cleaned = next.filter((r) => r.season.trim().length > 0);
    startTransition(async () => {
      const res = await updatePriorStatsAction(cleaned);
      if (res.error) {
        errorHaptic();
        toast.error(res.error);
      } else {
        toast.success("Prior seasons saved");
      }
    });
  }

  function updatePriorStat(
    index: number,
    patch: Partial<PlayerPriorStat>,
  ) {
    setPriorStats((cur) =>
      cur.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addPriorStat() {
    if (priorStats.length >= 10) {
      errorHaptic();
      toast.error("Up to 10 prior seasons");
      return;
    }
    tapHaptic(6);
    setPriorStats((cur) => [...cur, blankPriorStat()]);
  }

  function removePriorStat(index: number) {
    tapHaptic(8);
    setPriorStats((cur) => cur.filter((_, i) => i !== index));
  }

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
      // user gets immediate visual feedback. New clips default to
      // unverified (coach hasn't reviewed yet).
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
          verifiedByCoach: false,
          verifiedBy: null,
          verifiedAt: null,
          verifiedByName: null,
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
          description="YouTube, Hudl, Vimeo, TikTok, Instagram, or X links. Up to 6 clips render on your public profile. Coach-verified clips get a Verified badge; everything else is shown as Player reported."
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
              const locked = h.verifiedByCoach;
              return (
                <li
                  key={h.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-xl border bg-paper",
                    locked
                      ? "border-grass/30 bg-grass-dim/30"
                      : "border-hair",
                  )}
                >
                  <span
                    className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative",
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
                    {locked && (
                      <span
                        aria-hidden
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-grass text-white flex items-center justify-center ring-2 ring-paper"
                      >
                        <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[12.5px] font-semibold truncate">
                        {h.caption ?? embed?.provider ?? "Highlight"}
                      </span>
                      {locked && (
                        <span className="inline-flex items-center gap-0.5 rounded-full font-bold uppercase tracking-[0.06em] bg-grass-dim text-grass border border-grass/20 px-1.5 py-0 text-[9.5px] shrink-0">
                          <ShieldCheck className="w-2.5 h-2.5" strokeWidth={2.5} />
                          Verified
                        </span>
                      )}
                    </div>
                    {locked ? (
                      <div className="text-[10.5px] text-grass/90 truncate font-medium">
                        {h.verifiedByName
                          ? `Verified by ${h.verifiedByName}`
                          : "Coach-verified"}
                        {h.verifiedAt &&
                          ` · ${new Date(h.verifiedAt).toLocaleDateString()}`}
                      </div>
                    ) : (
                      <div className="text-[10.5px] text-ink-3 truncate">
                        {h.url}
                      </div>
                    )}
                  </div>
                  {locked ? (
                    <span
                      title="Coach-verified — ask your coach to unverify before deleting"
                      aria-label="Verified, delete disabled"
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-grass shrink-0",
                        "bg-grass-dim/60 cursor-not-allowed",
                      )}
                    >
                      <Lock className="w-4 h-4" strokeWidth={2.25} />
                    </span>
                  ) : (
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
                  )}
                </li>
              );
            })}
          </ul>
          {/* Add new */}
          <div className="space-y-2">
            <Field
              label="Video URL"
              placeholder="https://youtu.be/... or tiktok.com/@... or instagram.com/reel/..."
              value={newHighlight.url}
              onChange={(v) => setNewHighlight((s) => ({ ...s, url: v }))}
              hint="YouTube, Hudl, Vimeo, TikTok, Instagram, or X. Anything else opens as a link."
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

        {/* ── Privacy switches (advanced flag) ─────────────────────
            Rendered ONLY when NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES
            is on. Live pilot keeps the existing behavior (single
            profile_public toggle elsewhere) intact. */}
        {advancedProfilesOn && (
          <SectionCard
            icon={<Lock className="w-4 h-4" />}
            tone="bg-ink/5 text-ink"
            title="Profile visibility"
            description="You decide what's public. Default is everything off — flip a switch to make a section visible on your /p/ profile."
          >
            <div className="space-y-2">
              <PrivacySwitch
                label="Public profile"
                hint="Required for /p/ to render at all. When off, your profile returns 404 to anyone but you."
                icon={privacy.profilePublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                checked={privacy.profilePublic}
                disabled={pending}
                onChange={(v) =>
                  savePrivacy({ ...privacy, profilePublic: v })
                }
              />
              <PrivacySwitch
                label="Show academics"
                hint="Allow GPA, SAT, ACT, class rank, and intended college level on your public profile."
                icon={<GraduationCap className="w-4 h-4" />}
                checked={privacy.showAcademics}
                disabled={pending || !privacy.profilePublic}
                onChange={(v) =>
                  savePrivacy({ ...privacy, showAcademics: v })
                }
              />
              <PrivacySwitch
                label="Show contact info"
                hint="Allow recruiters to see contact channels (email, social handles). Off by default."
                icon={<ExternalLink className="w-4 h-4" />}
                checked={privacy.showContactInfo}
                disabled={pending || !privacy.profilePublic}
                onChange={(v) =>
                  savePrivacy({ ...privacy, showContactInfo: v })
                }
              />
            </div>
            {!privacy.profilePublic && (
              <p className="mt-3 text-[11px] text-ink-3 leading-snug bg-paper-deep border border-hair rounded-lg px-3 py-2">
                Profile is private. Sub-toggles re-enable when public is on.
              </p>
            )}
          </SectionCard>
        )}

        {/* ── Contact + socials (advanced flag, migration 35) ──────
            Visibility on the public profile is gated by profile_public
            AND show_contact_info from the privacy card above. So saving
            here is safe-by-default — nothing leaks until the player
            also flips the contact-info switch. */}
        {advancedProfilesOn && (
          <SectionCard
            icon={<AtSign className="w-4 h-4" />}
            tone="bg-sky-soft text-sky"
            title="Contact + socials"
            description="Optional. Recruiters use these to reach out. Hidden from your public profile until you turn on 'Show contact info' above."
            badge={<PlayerReportedBadge size="sm" />}
          >
            <div className="space-y-3">
              <Field
                label="Email"
                placeholder="you@example.com"
                value={contactInfo.email ?? ""}
                onChange={(v) =>
                  setContactInfo((s) => ({ ...s, email: v.trim() || null }))
                }
                inputMode="text"
                hint="Best email for recruiters."
                icon={<Mail className="w-3.5 h-3.5" />}
              />
              <Field
                label="Phone (optional)"
                placeholder="555-555-0100"
                value={contactInfo.phone ?? ""}
                onChange={(v) =>
                  setContactInfo((s) => ({ ...s, phone: v.trim() || null }))
                }
                hint="Free-form. Add a parent number if you'd rather."
                icon={<Phone className="w-3.5 h-3.5" />}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Instagram"
                  placeholder="@handle"
                  value={contactInfo.instagram ?? ""}
                  onChange={(v) =>
                    setContactInfo((s) => ({
                      ...s,
                      instagram: v.trim() || null,
                    }))
                  }
                />
                <Field
                  label="TikTok"
                  placeholder="@handle"
                  value={contactInfo.tiktok ?? ""}
                  onChange={(v) =>
                    setContactInfo((s) => ({ ...s, tiktok: v.trim() || null }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="X / Twitter"
                  placeholder="@handle"
                  value={contactInfo.x ?? ""}
                  onChange={(v) =>
                    setContactInfo((s) => ({ ...s, x: v.trim() || null }))
                  }
                />
                <Field
                  label="YouTube"
                  placeholder="@channel or URL"
                  value={contactInfo.youtube ?? ""}
                  onChange={(v) =>
                    setContactInfo((s) => ({
                      ...s,
                      youtube: v.trim() || null,
                    }))
                  }
                  inputMode="url"
                />
              </div>
              <Field
                label="Personal site (optional)"
                placeholder="https://your-recruiting-site.com"
                value={contactInfo.website ?? ""}
                onChange={(v) =>
                  setContactInfo((s) => ({ ...s, website: v.trim() || null }))
                }
                inputMode="url"
                icon={<Globe className="w-3.5 h-3.5" />}
              />
            </div>
            <SaveButton
              onClick={saveContactInfo}
              pending={pending}
              label="Save contact info"
            />
            {!privacy.showContactInfo && (
              <p className="mt-3 text-[11px] text-ink-3 leading-snug bg-paper-deep border border-hair rounded-lg px-3 py-2">
                Saved, but hidden — flip <span className="font-semibold">Show contact info</span> on the visibility card above to publish.
              </p>
            )}
          </SectionCard>
        )}

        {/* ── Prior seasons (advanced + sub-flag) ──────────────────
            Player-typed history. Always rendered with a "Player
            reported" badge so recruiters can't confuse it with
            verified Rostr stats. */}
        {priorStatsOn && (
          <SectionCard
            icon={<ListChecks className="w-4 h-4" />}
            tone="bg-amber-soft text-amber"
            title="Prior seasons"
            description="Stats from before Rostr — your travel team, freshman year, summer ball. Always shown with a 'Player reported' label, never mixed with verified game stats."
            badge={<PlayerReportedBadge size="sm" />}
          >
            <ul className="space-y-3">
              {priorStats.length === 0 && (
                <li className="text-[12.5px] text-ink-3 italic px-1">
                  No prior seasons yet. Tap below to add one.
                </li>
              )}
              {priorStats.map((row, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-hair bg-paper p-3 sm:p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Field
                        label="Season"
                        placeholder="2024 / Sophomore"
                        value={row.season}
                        onChange={(v) => updatePriorStat(i, { season: v })}
                      />
                      <Field
                        label="Level"
                        placeholder="Varsity / Travel"
                        value={row.level ?? ""}
                        onChange={(v) =>
                          updatePriorStat(i, { level: v.trim() || null })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePriorStat(i)}
                      aria-label="Remove prior season"
                      disabled={pending}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-ink-3 shrink-0 self-end mb-1",
                        "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                        "hover:bg-red-soft hover:text-red active:scale-[0.88]",
                      )}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Field
                      label="BA"
                      placeholder=".380"
                      value={row.ba ?? ""}
                      onChange={(v) =>
                        updatePriorStat(i, { ba: v.trim() || null })
                      }
                      inputMode="decimal"
                    />
                    <Field
                      label="OPS"
                      placeholder=".950"
                      value={row.ops ?? ""}
                      onChange={(v) =>
                        updatePriorStat(i, { ops: v.trim() || null })
                      }
                      inputMode="decimal"
                    />
                    <Field
                      label="HR"
                      placeholder="6"
                      value={row.hr ?? ""}
                      onChange={(v) =>
                        updatePriorStat(i, { hr: v.trim() || null })
                      }
                      inputMode="numeric"
                    />
                    <Field
                      label="RBI"
                      placeholder="32"
                      value={row.rbi ?? ""}
                      onChange={(v) =>
                        updatePriorStat(i, { rbi: v.trim() || null })
                      }
                      inputMode="numeric"
                    />
                  </div>
                  <Field
                    label="Pitching (optional)"
                    placeholder="3-1, 2.10 ERA, 38 K in 27 IP"
                    value={row.pitching ?? ""}
                    onChange={(v) =>
                      updatePriorStat(i, { pitching: v.trim() || null })
                    }
                  />
                  <Field
                    label="Notes (optional)"
                    placeholder="Conference all-star, league rank, awards…"
                    value={row.context ?? ""}
                    onChange={(v) =>
                      updatePriorStat(i, { context: v.trim() || null })
                    }
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addPriorStat}
              disabled={pending || priorStats.length >= 10}
              className={cn(
                "mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-hair bg-paper text-ink font-bold text-[13.5px] h-11",
                "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                "hover:border-ink-3 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
              )}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Add prior season
            </button>
            <SaveButton
              onClick={() => savePriorStats(priorStats)}
              pending={pending}
              label="Save prior seasons"
            />
          </SectionCard>
        )}
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
  badge,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  description?: string;
  /** Optional inline badge — currently used for "Player reported" on prior stats. */
  badge?: React.ReactNode;
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-[16px] font-bold tracking-tight">{title}</h2>
            {badge}
          </div>
          {description && (
            <p className="text-[11.5px] text-ink-3 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * iOS-style toggle switch row. Tapping the whole row flips the switch
 * (bigger touch target than the pill alone). Disabled state fades but
 * still tooltips the reason via the parent's hint.
 */
function PrivacySwitch({
  label,
  hint,
  icon,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        tapHaptic(8);
        onChange(!checked);
      }}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-xl border bg-paper text-left",
        "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100",
        checked ? "border-grass/40 bg-grass-dim/40" : "border-hair",
      )}
    >
      <span
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          checked ? "bg-grass text-white" : "bg-hair-2 text-ink-3",
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display text-[13.5px] font-bold tracking-tight">
          {label}
        </div>
        {hint && (
          <p className="text-[11px] text-ink-3 mt-0.5 leading-snug">{hint}</p>
        )}
      </div>
      <span
        aria-hidden
        className={cn(
          "relative w-10 h-6 rounded-full shrink-0 mt-1 transition-colors duration-[140ms]",
          checked ? "bg-grass" : "bg-hair-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  inputMode,
  icon,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric" | "url";
  /**
   * Optional small icon shown inside the label row. Used by the
   * Contact + socials section to mark email / phone / website fields.
   */
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1.5">
        {icon && <span className="text-ink-3">{icon}</span>}
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
