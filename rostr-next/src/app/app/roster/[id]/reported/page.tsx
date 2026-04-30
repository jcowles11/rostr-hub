import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GraduationCap, Trophy, ListChecks, Link2, Video } from "lucide-react";
import { requireFlag } from "@/lib/feature-flags";
import { getCurrentCoach } from "@/lib/services/coach";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchPlayerAcademics,
  fetchPlayerContactInfo,
  fetchPlayerHighlights,
  fetchPlayerPriorStats,
  fetchPlayerPrivacy,
  resolveVideoEmbed,
} from "@/lib/services/player-profile";
import { PlayerReportedBadge } from "@/components/atoms/data-source-badge";
import { VerifyHighlightButton } from "./verify-highlight-button";

/**
 * /app/roster/[id]/reported — coach-side read-only review of every
 * field a player typed for themselves on /me/profile.
 *
 * Why this exists:
 *   - The advanced player profile module accepts a lot of self-typed
 *     data (academics, prior seasons, contact + socials, highlight
 *     URLs). Recruiters see all of it on /p/[handle] — coaches need a
 *     way to see what's there too, in case a parent asks "is this
 *     accurate?" or a college coach asks for confirmation.
 *
 * What this DOESN'T do:
 *   - No verify / unverify action UI yet. The verified_by_coach column
 *     exists (migration 35) but the action that flips it lives in the
 *     next iteration once we've decided the verification UX (per-clip,
 *     bulk, "I vouch for this clip" with a confirmation step, etc.).
 *
 * Flag gate:
 *   - NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES. When OFF, this route
 *     returns 404 — the page does not exist on the live pilot.
 *
 * Auth gate:
 *   - getCurrentCoach() must return a coach.
 *   - The player.id must belong to that coach's program. We don't trust
 *     the URL — RLS is the second gate, but we 404 (not 403) so we
 *     don't leak the existence of player IDs in other programs.
 */
export const metadata = {
  title: "Player-reported data · Rostr",
  robots: { index: false, follow: false },
};

export default async function PlayerReportedReviewPage({
  params,
}: {
  params: { id: string };
}) {
  // Flag gate first — 404 when the advanced module is off in production.
  requireFlag("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES");

  const coach = await getCurrentCoach();
  if (!coach) redirect("/login?next=" + encodeURIComponent(`/app/roster/${params.id}/reported`));

  const supabase = createSupabaseServerClient();
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select(
      "id, first_name, last_name, profile_slug, program_id, grade, positions, player_number, profile_public",
    )
    .eq("id", params.id)
    .maybeSingle();

  // 404 if missing OR not in this coach's program. RLS would also block
  // the read, but this gives a stable shape for the auth check.
  if (pErr || !player) notFound();
  if (player.program_id !== coach.program_id) notFound();

  // Hydrate every player-reported surface in parallel. Same fetchers
  // as the public profile, so no behavior drift.
  const [academics, priorStats, contactInfo, highlights, privacy] =
    await Promise.all([
      fetchPlayerAcademics(player.id),
      fetchPlayerPriorStats(player.id),
      fetchPlayerContactInfo(player.id),
      fetchPlayerHighlights(player.id),
      fetchPlayerPrivacy(player.id),
    ]);

  const fullName = `${player.first_name} ${player.last_name}`.trim();

  // Build a contact field list once so the empty-state check is reliable.
  const contactRows: Array<[string, string | null]> = [
    ["Email", contactInfo.email],
    ["Phone", contactInfo.phone],
    ["Instagram", contactInfo.instagram],
    ["TikTok", contactInfo.tiktok],
    ["X / Twitter", contactInfo.x ?? contactInfo.twitter],
    ["YouTube", contactInfo.youtube],
    ["Website", contactInfo.website],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string | null]>;

  const priorRows = priorStats.filter((r) => r.season && r.season.trim());

  const hasAnyReported =
    Boolean(
      academics &&
        (academics.gpa ||
          academics.satScore != null ||
          academics.actScore != null ||
          academics.intendedLevel ||
          academics.bio),
    ) ||
    priorRows.length > 0 ||
    contactRows.length > 0 ||
    highlights.length > 0;

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="sticky top-0 z-topbar h-12 px-3 flex items-center gap-2 bg-paper/85 backdrop-blur-xl backdrop-saturate-150 border-b border-hair">
        <Link
          href="/app/roster"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-hair-2 active:scale-[0.92] transition"
        >
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.25} />
        </Link>
        <div className="flex-1 min-w-0 font-display text-[15px] font-bold tracking-tight truncate">
          Player-reported data
        </div>
      </header>

      <div className="max-w-[760px] mx-auto px-4 sm:px-6 pt-5 pb-24">
        {/* Identity header */}
        <section className="bg-card border border-hair rounded-2xl px-5 py-4 mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-[18px] font-semibold tracking-tight truncate">
              {fullName}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-3 truncate">
              {player.positions?.join("/") || "—"}
              {player.grade ? ` · Grade ${player.grade}` : ""}
              {player.player_number ? ` · #${player.player_number}` : ""}
            </div>
          </div>
          {player.profile_slug && player.profile_public && (
            <Link
              href={`/p/${player.profile_slug}`}
              className="text-[12px] font-semibold text-red px-3 h-9 inline-flex items-center rounded-full bg-red-soft hover:bg-red/10 transition"
            >
              View public →
            </Link>
          )}
        </section>

        {/* Visibility banner — shows the player's privacy switches so
            the coach knows what's actually public on /p/[handle]. */}
        <section className="bg-paper-deep border border-hair rounded-2xl px-4 py-3 mb-5 text-[12.5px] text-ink-2 leading-relaxed">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-[12.5px] font-bold uppercase tracking-[0.06em] text-ink-3">
              Public visibility
            </span>
            <PlayerReportedBadge size="sm" />
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-1 mt-1.5">
            <VisRow label="Profile public" on={privacy.profilePublic} />
            <VisRow label="Show academics" on={privacy.showAcademics} />
            <VisRow label="Show contact info" on={privacy.showContactInfo} />
          </ul>
          <p className="mt-2 text-[11px] text-ink-3 leading-snug">
            All fields below were typed by the player. Coach review is for
            visibility only — no edit / verify actions yet.
          </p>
        </section>

        {!hasAnyReported && (
          <div className="bg-card border border-dashed border-hair rounded-2xl p-8 text-center">
            <h3 className="font-display text-[16px] font-semibold tracking-tight">
              Nothing reported yet
            </h3>
            <p className="text-[12.5px] text-ink-3 mt-2 max-w-[360px] mx-auto leading-relaxed">
              {fullName} hasn&apos;t filled in academics, prior seasons, contact info,
              or highlight links from /me/profile.
            </p>
          </div>
        )}

        {/* Academics */}
        {academics &&
          (academics.gpa ||
            academics.satScore != null ||
            academics.actScore != null ||
            academics.intendedLevel ||
            academics.bio) && (
            <ReviewCard
              icon={<GraduationCap className="w-4 h-4 text-amber" />}
              title="Academics"
            >
              {academics.bio && (
                <p className="px-4 py-3 text-[12.5px] leading-relaxed text-ink-2 border-b border-hair-2">
                  {academics.bio}
                </p>
              )}
              <ReviewRow label="GPA" value={academics.gpa ?? "—"} />
              <ReviewRow
                label="SAT"
                value={academics.satScore != null ? String(academics.satScore) : "—"}
              />
              <ReviewRow
                label="ACT"
                value={academics.actScore != null ? String(academics.actScore) : "—"}
              />
              <ReviewRow
                label="Class rank"
                value={
                  academics.classRankNumerator != null &&
                  academics.classRankDenominator != null
                    ? `${academics.classRankNumerator} of ${academics.classRankDenominator}`
                    : "—"
                }
              />
              <ReviewRow label="Target level" value={academics.intendedLevel ?? "—"} />
            </ReviewCard>
          )}

        {/* Prior seasons */}
        {priorRows.length > 0 && (
          <ReviewCard
            icon={<ListChecks className="w-4 h-4 text-amber" />}
            title="Prior seasons"
          >
            {priorRows.map((row, i) => {
              const battingBits: string[] = [];
              if (row.ba) battingBits.push(`${row.ba} BA`);
              if (row.ops) battingBits.push(`${row.ops} OPS`);
              if (row.hr) battingBits.push(`${row.hr} HR`);
              if (row.rbi) battingBits.push(`${row.rbi} RBI`);
              return (
                <div
                  key={i}
                  className="px-4 py-3 border-b border-hair-2 last:border-b-0"
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <div className="font-display text-[13.5px] font-semibold">
                      {row.season}
                    </div>
                    {row.level && (
                      <span className="text-[11.5px] text-ink-3">{row.level}</span>
                    )}
                  </div>
                  {battingBits.length > 0 && (
                    <div className="mt-1 text-[12px] text-ink-2 font-mono tabular-nums">
                      {battingBits.join(" · ")}
                    </div>
                  )}
                  {row.pitching && (
                    <div className="mt-1 text-[12px] text-ink-2">
                      <span className="text-ink-3 font-mono text-[10.5px] uppercase tracking-[0.06em] mr-1.5">
                        Pitching
                      </span>
                      {row.pitching}
                    </div>
                  )}
                  {row.context && (
                    <div className="mt-1 text-[11.5px] text-ink-3 italic">
                      {row.context}
                    </div>
                  )}
                </div>
              );
            })}
          </ReviewCard>
        )}

        {/* Contact info */}
        {contactRows.length > 0 && (
          <ReviewCard
            icon={<Link2 className="w-4 h-4 text-ink-3" />}
            title="Contact + socials"
          >
            {contactRows.map(([label, value]) => (
              <ReviewRow key={label} label={label} value={value ?? "—"} />
            ))}
          </ReviewCard>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <ReviewCard
            icon={<Trophy className="w-4 h-4 text-red" />}
            title="Highlight links"
          >
            {highlights.map((h) => {
              const embed = resolveVideoEmbed(h.url);
              const provider = embed?.provider ?? "unknown";
              return (
                <div
                  key={h.id}
                  className="px-4 py-3 border-b border-hair-2 last:border-b-0"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Video className="w-3.5 h-3.5 text-ink-3" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                      {provider}
                    </span>
                    {!h.verifiedByCoach && <PlayerReportedBadge size="sm" />}
                    {/* Verify button is the primary action — when already
                        verified the component renders a static Verified
                        pill instead. */}
                    <span className="ml-auto">
                      <VerifyHighlightButton
                        highlightId={h.id}
                        caption={h.caption}
                        url={h.url}
                        alreadyVerified={h.verifiedByCoach}
                      />
                    </span>
                  </div>
                  {h.caption && (
                    <div className="mt-1 text-[13px] font-semibold">{h.caption}</div>
                  )}
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-[11.5px] text-red truncate hover:underline"
                  >
                    {h.url}
                  </a>
                  {h.verifiedByCoach && h.verifiedAt && (
                    <div className="mt-1 text-[10.5px] text-ink-3 font-mono">
                      Verified {new Date(h.verifiedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </ReviewCard>
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────

function ReviewCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-hair rounded-2xl mb-4 overflow-hidden">
      <header className="px-4 py-3 border-b border-hair-2 flex items-center gap-2 flex-wrap">
        {icon}
        <h2 className="font-display text-[14px] font-bold tracking-tight">{title}</h2>
        <span className="ml-auto">
          <PlayerReportedBadge size="sm" />
        </span>
      </header>
      <div>{children}</div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5 border-b border-hair-2 last:border-b-0 text-[13px] gap-3">
      <span className="text-ink-3 font-medium shrink-0">{label}</span>
      <span className="font-mono text-[12.5px] text-right truncate">{value}</span>
    </div>
  );
}

function VisRow({ label, on }: { label: string; on: boolean }) {
  return (
    <li className="flex items-center gap-1.5 text-[12px]">
      <span
        className={
          "w-2 h-2 rounded-full " + (on ? "bg-grass" : "bg-hair-2 border border-hair")
        }
        aria-hidden
      />
      <span className={on ? "text-ink-2" : "text-ink-3"}>{label}</span>
      <span className="ml-auto text-[10.5px] font-mono uppercase tracking-[0.06em] text-ink-3">
        {on ? "On" : "Off"}
      </span>
    </li>
  );
}
