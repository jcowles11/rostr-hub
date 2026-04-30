import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Link2,
  Trophy,
  Star,
  CheckCircle2,
  GraduationCap,
  Eye,
} from "lucide-react";
import { PublicNav } from "@/components/organisms/public-nav";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import {
  MOCK_PLAYERS,
  MOCK_BATTING_BY_PLAYER,
  MOCK_PITCHING_BY_PLAYER,
  MOCK_BIO_BY_PLAYER,
  MOCK_MEASURABLES_BY_PLAYER,
  MOCK_RECRUITING_BY_PLAYER,
  MOCK_ACADEMIC_BY_PLAYER,
  type MockPlayer,
  type MockBio,
  type MockRecruiting,
  type MockAcademic,
} from "@/lib/mock-data";
import { fetchPlayerBySlug } from "@/lib/services/players";
import { fetchPlayerMeasurables, type PlayerMeasurable } from "@/lib/services/tryouts";
import {
  fetchPlayerSeasonBatting,
  fetchPlayerCareerBatting,
  formatAvg,
  type SeasonBattingLine,
  type PlayerBattingLine,
} from "@/lib/services/batting-stats";
import {
  fetchPlayerSeasonPitching,
  fetchPlayerCareerPitching,
  type SeasonPitchingLine,
  type PlayerPitchingLine,
} from "@/lib/services/pitching-stats";
import { formatIP, formatERA, formatWHIP } from "@/lib/format";
import {
  fetchPlayerProfileMedia,
  fetchPlayerAnnouncements,
  fetchPlayerAcademics,
  fetchPlayerHighlights,
  fetchPlayerPrivacy,
  fetchPlayerPriorStats,
  fetchPlayerContactInfo,
  resolveVideoEmbed,
  emptyContactInfo,
  type PlayerProfileMedia,
  type PlayerAnnouncement,
  type PlayerAcademics,
  type PlayerHighlight,
  type PlayerPrivacy,
  type PlayerPriorStat,
  type PlayerContactInfo,
} from "@/lib/services/player-profile";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  VerifiedBadge,
  PlayerReportedBadge,
} from "@/components/atoms/data-source-badge";
import {
  getCurrentRecruiter,
  fetchLists,
  fetchPlayerListMembership,
  fetchPlayerViewStats,
} from "@/lib/services/recruiter";
import { fetchRecruiterQuota } from "@/lib/services/messaging";
import { findSimilarPlayers } from "@/lib/services/similar-players";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlayerProfileTabs, PlayerProfileActions, type PlayerProfileTab } from "./interactive";
import { RecruiterOverlay, RecruiterViewTracker } from "./recruiter-overlay";
import { SimilarPlayersSection } from "./similar-players";

/**
 * /p/[handle] — Public player profile.
 * Pixel target: handoff/designs/04_Player_Profile.html.
 * Spec: handoff/SCREENS.md §4.
 *
 * NOTE: Final spec puts public profiles at /<handle>. We use /p/<handle>
 * for now to avoid root catch-all collisions with /app, /signup, etc.
 * Migrate via redirect when handle reservations are implemented.
 */

export default async function PlayerProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  // Try real DB lookup first by profile_slug.
  const real = await fetchPlayerBySlug(params.handle);
  const player: MockPlayer = real
    ? (real as unknown as MockPlayer)
    : (MOCK_PLAYERS.find((p) => p.handle === params.handle) ?? MOCK_PLAYERS[0]);
  if (!player) notFound();

  // Real tryout measurables — flow from tryout_scores → player_best_measurables
  // view. For mock fallback (demo profile), pull per-player position-
  // appropriate measurables so the Combine card + Verification chain
  // render with realistic, differentiated numbers (pitchers get FB
  // velo, catchers get pop time, infielders get IF velo, etc.) instead
  // of falling back to identical hardcoded mock values.
  const measurables = real
    ? await fetchPlayerMeasurables(real.id)
    : MOCK_MEASURABLES_BY_PLAYER[player.id] ?? [];
  const mockBio = !real ? MOCK_BIO_BY_PLAYER[player.id] ?? null : null;
  const mockRecruiting = !real ? MOCK_RECRUITING_BY_PLAYER[player.id] ?? null : null;
  const mockAcademic = !real ? MOCK_ACADEMIC_BY_PLAYER[player.id] ?? null : null;

  // Real batting + pitching stats from the game_events log.
  // For mock fallback (demo profile), pull plausible numbers from the
  // pre-computed MOCK_BATTING/PITCHING maps so the cards render with
  // realistic data instead of empty states. Career line uses the same
  // numbers (single-season demo).
  const mockBatting = !real ? MOCK_BATTING_BY_PLAYER[player.id] ?? null : null;
  const mockPitching = !real ? MOCK_PITCHING_BY_PLAYER[player.id] ?? null : null;
  const [
    seasonLine,
    careerLine,
    pitchingSeason,
    pitchingCareer,
    profileMedia,
    announcements,
    realAcademics,
    realHighlights,
    realPrivacy,
    realPriorStats,
    realContactInfo,
  ] = real
    ? await Promise.all([
        fetchPlayerSeasonBatting(real.id),
        fetchPlayerCareerBatting(real.id),
        fetchPlayerSeasonPitching(real.id),
        fetchPlayerCareerPitching(real.id),
        fetchPlayerProfileMedia(real.id),
        fetchPlayerAnnouncements(real.id, 10),
        fetchPlayerAcademics(real.id),
        fetchPlayerHighlights(real.id),
        // Privacy + prior stats: migration 34. When the advanced-profiles
        // flag is OFF, these are fetched but ignored downstream so the
        // public profile keeps its current behavior. Defense-in-depth at
        // the render call site, not the fetch.
        fetchPlayerPrivacy(real.id),
        fetchPlayerPriorStats(real.id),
        // Contact info (migration 35) — gated by show_contact_info AND
        // the advanced flag at render time. Fetcher returns empty
        // object when migration 35 isn't applied.
        fetchPlayerContactInfo(real.id),
      ])
    : [
        mockBatting as unknown as SeasonBattingLine | null,
        mockBatting as unknown as PlayerBattingLine | null,
        mockPitching as unknown as SeasonPitchingLine | null,
        mockPitching as unknown as PlayerPitchingLine | null,
        null,
        [],
        null as PlayerAcademics | null,
        [] as PlayerHighlight[],
        // Default privacy: all-off so demo profiles never accidentally
        // expose academics/contact under the new gates.
        { profilePublic: false, showAcademics: false, showContactInfo: false } as PlayerPrivacy,
        [] as PlayerPriorStat[],
        emptyContactInfo(),
      ];

  // Recruiter overlay context — if the viewer is a recruiter, show
  // save-to-list + note taking tools. Also track the view for analytics.
  const recruiter = await getCurrentRecruiter();
  const recruiterLists = recruiter ? await fetchLists(recruiter.id) : [];
  const memberListIds =
    recruiter && real ? await fetchPlayerListMembership(recruiter.id, real.id) : [];
  const viewStats = real ? await fetchPlayerViewStats(real.id) : null;

  // Similar players — only compute for recruiters viewing a real (not mock)
  // profile, since it's a recruiter-specific signal.
  const similarPlayers =
    recruiter && real ? await findSimilarPlayers(real.id, 5) : [];

  // Recruiter outreach state: quota + whether we've already reached out.
  const quota = recruiter ? await fetchRecruiterQuota(recruiter.id) : null;
  let outreachExists = false;
  if (recruiter && real) {
    const supabase = createSupabaseServerClient();
    const { data: existing } = await supabase
      .from("message_threads")
      .select("id")
      .eq("kind", "recruiter_outreach")
      .eq("recruiter_id", recruiter.id)
      .eq("target_player_id", real.id)
      .in("outreach_status", ["pending", "accepted"])
      .maybeSingle();
    outreachExists = Boolean(existing);
  }

  // Trust signal: when this URL didn't match a real player and we
  // fell back to a mock profile, label it loudly so visitors don't
  // mistake fictional Lincoln HS players for someone real.
  const isMockFallback = !real;

  return (
    <div className="bg-paper min-h-screen">
      {recruiter && real && <RecruiterViewTracker playerId={real.id} />}
      <PublicNav />
      {isMockFallback && <MockProfileBanner />}
      {/* px-3 on smallest phones (was px-4) — buys 8px back per row,
          which on a 360px iPhone SE is 2.2% more horizontal real estate
          for content. */}
      <div className="max-w-layout-marketing mx-auto px-3 sm:px-6 lg:px-7">
        <Hero player={player} headerUrl={profileMedia?.headerUrl ?? null} />
        <Identity
          player={player}
          isRealProfile={Boolean(real)}
          avatarUrl={profileMedia?.avatarUrl ?? null}
          commitmentStatus={profileMedia?.commitmentStatus ?? null}
          commitmentSchool={profileMedia?.commitmentSchool ?? null}
          commitmentYear={profileMedia?.commitmentYear ?? null}
          mockBio={mockBio}
        />
        {recruiter && real && quota && (
          <RecruiterOverlay
            recruiter={recruiter}
            playerId={real.id}
            playerName={`${real.firstName} ${real.lastName}`}
            lists={recruiterLists}
            memberListIds={memberListIds}
            viewStats={viewStats}
            quota={quota}
            outreachExists={outreachExists}
          />
        )}
        <PlayerProfileTabs
          tabs={buildTabs({
            isRealProfile: Boolean(real),
            hasBatting: Boolean(seasonLine && seasonLine.games > 0),
            hasPitching: Boolean(pitchingSeason && pitchingSeason.games > 0),
            hasMeasurables: measurables.length > 0,
            hasVideo: Boolean(profileMedia?.highlightVideoUrl),
            hasAnnouncements: Boolean(real) && announcements.length > 0,
          })}
        />
        <Layout
          player={player}
          measurables={measurables}
          seasonLine={seasonLine}
          careerLine={careerLine}
          pitchingSeason={pitchingSeason}
          pitchingCareer={pitchingCareer}
          isRealProfile={Boolean(real)}
          profileMedia={profileMedia}
          announcements={announcements}
          mockBio={mockBio}
          mockRecruiting={mockRecruiting}
          mockAcademic={mockAcademic}
          realAcademics={realAcademics}
          realHighlights={realHighlights}
          realPrivacy={realPrivacy}
          realPriorStats={realPriorStats}
          realContactInfo={realContactInfo}
        />
        {recruiter && similarPlayers.length > 0 && (
          <SimilarPlayersSection
            anchorName={`${player.firstName} ${player.lastName}`}
            players={similarPlayers}
          />
        )}
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────

function Hero({
  player,
  headerUrl,
}: {
  player: (typeof MOCK_PLAYERS)[number];
  headerUrl: string | null;
}) {
  // Removed aspectRatio — on mobile a 3.6:1 ratio plus min-h-[260px]
  // was producing a 260px-tall hero that ate half the visible viewport.
  // Use min-height per breakpoint instead so the hero scales with the
  // device: shorter on phones, the original height on tablets+.
  const bgStyle: React.CSSProperties = headerUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(10,13,18,.3), rgba(10,13,18,.7)), url("${headerUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage: [
          "radial-gradient(circle at 70% 30%, rgba(200,58,58,.4), transparent 55%)",
          "radial-gradient(circle at 20% 80%, rgba(58,110,168,.25), transparent 60%)",
          "linear-gradient(135deg, #14181f, #0a0d12)",
        ].join(", "),
      };
  return (
    <div
      className="relative mt-4 sm:mt-6 rounded-xl overflow-hidden bg-ink text-white min-h-[160px] sm:min-h-[260px]"
      style={bgStyle}
    >
      {/* grid overlay — only on the gradient hero, not a photo hero */}
      {!headerUrl && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      )}
      {/* faux diamond — only on the gradient hero */}
      {!headerUrl && (
      <svg
        className="absolute right-12 top-0 bottom-0 h-[85%] my-auto"
        viewBox="0 0 300 200"
        aria-hidden
      >
        <path d="M 150 180 L 30 60 L 150 -60 L 270 60 Z" fill="rgba(47,125,79,.2)" />
        <circle cx="150" cy="80" r="42" fill="rgba(179,122,76,.2)" />
        <rect x="146" y="176" width="8" height="8" fill="rgba(255,255,255,.4)" transform="rotate(45 150 180)" />
        <rect x="266" y="56" width="8" height="8" fill="rgba(255,255,255,.4)" transform="rotate(45 270 60)" />
        <rect x="146" y="-64" width="8" height="8" fill="rgba(255,255,255,.4)" transform="rotate(45 150 -60)" />
        <rect x="26" y="56" width="8" height="8" fill="rgba(255,255,255,.4)" transform="rotate(45 30 60)" />
      </svg>
      )}
      <div className="absolute top-3 left-3 sm:top-5 sm:left-5 flex gap-1.5 sm:gap-2 flex-wrap max-w-[calc(100%-1.5rem)]">
        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white/10 text-white rounded-xs text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.08em] backdrop-blur">
          ⚾ Baseball
        </span>
        {player.hot && (
          <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-red text-white rounded-xs text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.08em]">
            🔥 7-game hit streak
          </span>
        )}
      </div>
    </div>
  );
}

// ── Identity ──────────────────────────────────────────────────

function Identity({
  player,
  isRealProfile,
  avatarUrl,
  commitmentStatus,
  commitmentSchool,
  commitmentYear,
  mockBio,
}: {
  player: (typeof MOCK_PLAYERS)[number];
  isRealProfile: boolean;
  avatarUrl: string | null;
  commitmentStatus: "uncommitted" | "committed" | "decommitted" | "decided" | null;
  commitmentSchool: string | null;
  commitmentYear: number | null;
  mockBio: MockBio | null;
}) {
  const levelLabel = player.levelName ?? (player.level === "V" ? "Varsity" : player.level === "JV" ? "JV" : "Freshman");
  return (
    /* Mobile (default): single-column. Avatar overlaps the bottom of
       the hero, name + meta + actions stack below. LinkedIn iOS pattern.
       sm+ goes back to the full-width row used by desktop. */
    <div className="relative z-[2] -mt-10 sm:-mt-14 px-1 sm:px-2 flex flex-col sm:flex-row sm:items-start sm:gap-6">
      <div className="shrink-0">
        <div
          className={cn(
            "rounded-xl border-[5px] border-card flex items-center justify-center font-display font-semibold text-white shadow-elev overflow-hidden bg-ink",
            // Smaller on mobile so it doesn't dominate the column.
            "w-20 h-20 text-[28px] sm:w-32 sm:h-32 sm:text-[44px]",
          )}
          style={
            avatarUrl
              ? {
                  backgroundImage: `url("${avatarUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  backgroundImage: "linear-gradient(135deg, #c83a3a, #0e1116)",
                }
          }
        >
          {!avatarUrl && player.initials}
        </div>
      </div>
      <div className="flex-1 pt-3 sm:pt-16 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {player.gradYear ? (
            <div className="text-[10.5px] sm:text-[11px] font-bold text-red tracking-[0.12em] uppercase">
              Class of {player.gradYear}
            </div>
          ) : null}
          {commitmentStatus === "committed" && commitmentSchool && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.06em]">
              ✓ Committed · {commitmentSchool}
              {commitmentYear ? ` '${String(commitmentYear).slice(-2)}` : ""}
            </span>
          )}
          {commitmentStatus === "decided" && commitmentSchool && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-sky-soft text-sky text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.06em]">
              Next stop · {commitmentSchool}
            </span>
          )}
          {commitmentStatus === "decommitted" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-amber-soft text-amber text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.06em]">
              Decommitted · open to offers
            </span>
          )}
        </div>
        <h1 className="font-display text-[26px] sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.05] mt-1">
          {player.firstName} {player.lastName}
          {player.jerseyNumber ? (
            <>
              {" "}
              <span className="font-mono text-ink-3 text-[18px] sm:text-[24px] align-middle">
                #{player.jerseyNumber}
              </span>
            </>
          ) : null}
        </h1>
        <div className="flex flex-wrap gap-x-2 gap-y-1 sm:gap-x-3.5 sm:gap-y-1.5 mt-1.5 sm:mt-2 text-[12.5px] sm:text-[14px] text-ink-2">
          {player.positions.length > 0 && (
            <span>
              <b className="font-semibold text-ink">{player.positions.join("/")}</b>
            </span>
          )}
          {isRealProfile ? (
            // Real profile: only show data we actually have. Level is
            // the only biographical field we currently persist for
            // imported players.
            levelLabel ? (
              <>
                {player.positions.length > 0 && <span>·</span>}
                <span>
                  <b className="font-semibold text-ink">{levelLabel}</b>
                </span>
              </>
            ) : null
          ) : (
            // Demo profile: per-player bio for marketing realism — every
            // mock player has a different height/weight/handedness so
            // the demo doesn't look like 15 copies of the same kid.
            <>
              <span>·</span>
              <span>
                <b className="font-semibold text-ink">Lincoln HS</b>
                <span className="hidden sm:inline"> · Varsity</span>
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">Austin, TX</span>
              <span>·</span>
              <span>
                <b className="font-semibold text-ink">{mockBio?.height ?? "6'0\""}</b>{" "}
                · {mockBio?.weight ?? 175} · {mockBio?.bats ?? "R"}/{mockBio?.throws ?? "R"}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.04em]">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            </>
          )}
        </div>
        {/* Actions: full-width row below identity on mobile, original
            inline button group on sm+. Wrapping the existing component
            in a sm:hidden / hidden sm:block pair keeps the desktop
            behavior identical while giving phones a proper button row. */}
        <div className="sm:hidden mt-3">
          <PlayerProfileActions handle={player.handle} name={`${player.firstName} ${player.lastName}`} />
        </div>
      </div>
      <div className="hidden sm:block">
        <PlayerProfileActions handle={player.handle} name={`${player.firstName} ${player.lastName}`} />
      </div>
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────

function Layout({
  player,
  measurables,
  seasonLine,
  careerLine,
  pitchingSeason,
  pitchingCareer,
  isRealProfile,
  profileMedia,
  announcements,
  mockBio,
  mockRecruiting,
  mockAcademic,
  realAcademics,
  realHighlights,
  realPrivacy,
  realPriorStats,
  realContactInfo,
}: {
  player: (typeof MOCK_PLAYERS)[number];
  measurables: PlayerMeasurable[];
  seasonLine: SeasonBattingLine | null;
  careerLine: PlayerBattingLine | null;
  pitchingSeason: SeasonPitchingLine | null;
  pitchingCareer: PlayerPitchingLine | null;
  isRealProfile: boolean;
  profileMedia: PlayerProfileMedia | null;
  announcements: PlayerAnnouncement[];
  mockBio: MockBio | null;
  mockRecruiting: MockRecruiting | null;
  mockAcademic: MockAcademic | null;
  realAcademics: PlayerAcademics | null;
  realHighlights: PlayerHighlight[];
  realPrivacy: PlayerPrivacy;
  realPriorStats: PlayerPriorStat[];
  realContactInfo: PlayerContactInfo;
}) {
  const hasBatting = Boolean(seasonLine && seasonLine.games > 0);
  const hasPitching = Boolean(pitchingSeason && pitchingSeason.games > 0);
  const hasMeasurables = measurables.length > 0;
  const hasVideo = Boolean(profileMedia?.highlightVideoUrl);
  const hasAnnouncements = announcements.length > 0;
  // Gate ALL mock-only sections on whether this is a demo profile.
  // A real signed-up coach importing their roster should NEVER see
  // fake highlights / fake college offers / fake academics on a real
  // player's profile — that was demo eye-candy for the marketing page.
  const showMockSections = !isRealProfile;

  // ── Feature flag gates (advanced player profiles) ──────────────
  // When the advanced-profiles flag is OFF, behave EXACTLY as before:
  //   - academics card renders if any value present
  //   - no prior-stats card
  //   - no privacy gating
  // When ON, respect player's privacy switches and surface the new
  // prior-seasons card under a Player-reported badge.
  const advancedProfilesOn = isFeatureEnabled(
    "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES",
  );
  const priorStatsFlagOn =
    advancedProfilesOn &&
    isFeatureEnabled("NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS");

  // Decide if the academics block can render. Off-flag = current
  // behavior (always render when there's data). On-flag = respect
  // showAcademics — default false means hidden until the player opts in.
  const academicsAllowed = advancedProfilesOn
    ? isRealProfile
      ? realPrivacy.showAcademics
      : true // demo profiles ignore the gate
    : true;

  // Prior stats render: both flags ON, real profile, has rows.
  const priorStatsToShow = (realPriorStats ?? []).filter(
    (r) => r.season && r.season.trim().length > 0,
  );
  const showPriorStats =
    priorStatsFlagOn && isRealProfile && priorStatsToShow.length > 0;

  // Contact-info card: only on real profiles, only when ALL of:
  //   1. advanced-profiles flag ON
  //   2. profile_public = true (existing gate from /p/[handle] lookup)
  //   3. show_contact_info = true (player explicit opt-in)
  //   4. at least one contact field is populated
  const contactFields: Array<[string, string | null]> = advancedProfilesOn
    ? (
        [
          ["Email", realContactInfo.email],
          ["Phone", realContactInfo.phone],
          ["Instagram", realContactInfo.instagram],
          ["TikTok", realContactInfo.tiktok],
          ["X / Twitter", realContactInfo.x ?? realContactInfo.twitter],
          ["YouTube", realContactInfo.youtube],
          ["Website", realContactInfo.website],
        ] as Array<[string, string | null]>
      ).filter(([, v]) => Boolean(v))
    : [];
  const showContactCard =
    advancedProfilesOn &&
    isRealProfile &&
    realPrivacy.showContactInfo &&
    contactFields.length > 0;
  return (
    /* Tighter mobile spacing all around: gap-4 (was 5), my-5 (was 7),
       and pb-28 to clear the bottom nav (~56px + safe-area-inset). */
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 lg:gap-7 my-5 lg:my-7 pb-28 lg:pb-20">
      <div className="flex flex-col gap-5 min-w-0">
        <section id="overview" className="scroll-mt-28">
          <StatHero
            measurables={measurables}
            seasonLine={seasonLine}
            pitchingSeason={pitchingSeason}
            isRealProfile={isRealProfile}
          />
        </section>
        {/* Announcement feed — pinned-then-recent, shown on real profiles */}
        {isRealProfile && hasAnnouncements && (
          <section id="activity" className="scroll-mt-28">
            <AnnouncementFeed announcements={announcements} playerName={player.firstName} />
          </section>
        )}
        {/* Highlight video embed */}
        {hasVideo && (
          <section id="video" className="scroll-mt-28">
            <HighlightVideoCard url={profileMedia!.highlightVideoUrl!} />
          </section>
        )}
        {(hasBatting || hasPitching) && (
          <section id="stats" className="scroll-mt-28 flex flex-col gap-5">
            {hasBatting ? (
              <BattingCard seasonLine={seasonLine!} careerLine={careerLine} />
            ) : null}
            {hasPitching ? (
              <PitchingCard seasonLine={pitchingSeason!} careerLine={pitchingCareer} />
            ) : null}
          </section>
        )}
        {/* Mock fallback career chart — only on demo profiles, AND only if no real stats */}
        {showMockSections && !hasBatting && !hasPitching && (
          <section id="stats" className="scroll-mt-28 flex flex-col gap-5">
            <CareerChart />
            <Career player={player} seasonLine={seasonLine} pitchingSeason={pitchingSeason} />
          </section>
        )}
        {/* Demo-only: standalone Teams section anchor when there's also a stats section above */}
        {showMockSections && (hasBatting || hasPitching) && (
          <section id="teams" className="scroll-mt-28">
            <Career player={player} seasonLine={seasonLine} pitchingSeason={pitchingSeason} />
          </section>
        )}
        {/* Empty state when a real profile has no stats or measurables yet */}
        {isRealProfile && !hasBatting && !hasPitching && !hasMeasurables && (
          <div className="bg-card border border-dashed border-hair rounded-lg p-8 text-center">
            <h3 className="font-display text-[18px] font-semibold tracking-tight">
              No stats yet
            </h3>
            <p className="text-[13px] text-ink-3 mt-2 max-w-[380px] mx-auto leading-relaxed">
              Once the coach imports season stats from GameChanger — or scores
              a game live in Rostr — {player.firstName}&apos;s batting and pitching
              lines will appear here.
            </p>
          </div>
        )}
        {/* Real highlights for claimed profiles — multiple ordered clips
            from /me/profile editor. Falls back to the mock card on demo.
            When the advanced flag is ON each clip is badged Verified
            (coach reviewed) or Player reported (default). */}
        {isRealProfile && realHighlights.length > 0 && (
          <section id="highlights" className="scroll-mt-28">
            <RealHighlightsCard
              highlights={realHighlights}
              showSourceBadges={advancedProfilesOn}
            />
          </section>
        )}
        {showMockSections && (
          <section id="highlights" className="scroll-mt-28">
            <Highlights />
          </section>
        )}
        {(hasMeasurables || showMockSections) && (
          <section id="combine" className="scroll-mt-28">
            <Combine measurables={measurables} mockBio={mockBio} />
          </section>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <ShareCard handle={player.handle} />
        {showMockSections && (
          <section id="recruiting" className="scroll-mt-28">
            <RecruitingCard recruiting={mockRecruiting} />
          </section>
        )}
        {/* Academics: real values for claimed profiles, mock for demo.
            Render even if values are sparse — recruiters value any
            data point ("GPA 3.85, intended D2") more than they value
            a hidden card. We omit empty rows inside the card itself.
            Advanced-profiles flag ON additionally requires the player's
            showAcademics switch (default false), so private-by-default. */}
        {isRealProfile &&
          realAcademics &&
          academicsAllowed &&
          hasAnyRealAcademics(realAcademics) && (
            <section id="academic" className="scroll-mt-28">
              <RealAcademicsCard
                academics={realAcademics}
                showVerifiedBadge={advancedProfilesOn}
              />
            </section>
          )}
        {showMockSections && (
          <section id="academic" className="scroll-mt-28">
            <AcademicsCard academic={mockAcademic} />
          </section>
        )}
        {/* Prior seasons (player-reported, flag-gated) — sub-flag of
            advanced profiles. Always rendered with a Player-reported
            badge so recruiters never confuse it with verified stats. */}
        {showPriorStats && (
          <section id="prior-seasons" className="scroll-mt-28">
            <PriorSeasonsCard rows={priorStatsToShow} />
          </section>
        )}
        {/* Contact + socials (advanced flag, migration 35).
            Defense-in-depth: profile_public was already enforced upstream
            by fetchPlayerBySlug; show_contact_info gates whether the
            card renders even on a public profile. */}
        {showContactCard && (
          <section id="contact" className="scroll-mt-28">
            <ContactInfoCard fields={contactFields} />
          </section>
        )}
        {hasMeasurables && (
          <section id="verification" className="scroll-mt-28">
            <CoachVerification measurables={measurables} />
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * buildTabs — decide which tabs to show based on what the page actually
 * has content for. Real profiles with no stats imported yet get a much
 * shorter tab list (Overview + Combine empty state). Demo profiles get
 * the full marketing-flavored set.
 */
function buildTabs(args: {
  isRealProfile: boolean;
  hasBatting: boolean;
  hasPitching: boolean;
  hasMeasurables: boolean;
  hasVideo: boolean;
  hasAnnouncements: boolean;
}): PlayerProfileTab[] {
  const tabs: PlayerProfileTab[] = [{ name: "Overview", anchor: "overview" }];
  if (args.hasAnnouncements) tabs.push({ name: "Activity", anchor: "activity" });
  if (args.hasVideo) tabs.push({ name: "Video", anchor: "video" });
  if (args.hasBatting || args.hasPitching || !args.isRealProfile) {
    tabs.push({ name: "Stats", anchor: "stats" });
  }
  if (!args.isRealProfile) {
    tabs.push({ name: "Highlights", anchor: "highlights", count: "18" });
    tabs.push({ name: "Teams", anchor: "teams", count: "4" });
  }
  if (args.hasMeasurables || !args.isRealProfile) {
    tabs.push({ name: "Combine", anchor: "combine" });
  }
  if (!args.isRealProfile) {
    tabs.push({ name: "Recruiting", anchor: "recruiting" });
    tabs.push({ name: "Academic", anchor: "academic" });
  }
  if (args.hasMeasurables) {
    tabs.push({ name: "Verification", anchor: "verification" });
  }
  return tabs;
}

// ── Stat Hero (4-cell) ───────────────────────────────────────

function StatHero({
  measurables,
  seasonLine,
  pitchingSeason,
  isRealProfile,
}: {
  measurables: PlayerMeasurable[];
  seasonLine: SeasonBattingLine | null;
  pitchingSeason: SeasonPitchingLine | null;
  isRealProfile: boolean;
}) {
  type Cell = {
    label: string;
    value: string;
    unit: string;
    sub: string; // context line under the number (no fake trends)
    highlight?: boolean; // green-tint the value when it's a standout
  };

  const cells: Cell[] = [];

  // Real measurables
  for (const m of measurables.slice(0, 2)) {
    cells.push({
      label: m.stationName,
      value: formatMeasurable(m),
      unit: m.unit ?? "",
      sub: m.verifiedByCoachName
        ? `Verified by ${m.verifiedByCoachName}`
        : "Verified",
      highlight: true,
    });
  }

  // Real season batting
  if (seasonLine && seasonLine.games > 0) {
    cells.push({
      label: `AVG · ${seasonLine.seasonYear}`,
      value: formatAvg(seasonLine.ba),
      unit: "",
      sub: `${seasonLine.games}G · ${seasonLine.h}H · ${seasonLine.hr}HR · ${seasonLine.rbi}RBI`,
      highlight: seasonLine.ba >= 0.3,
    });
    cells.push({
      label: "OPS",
      value: formatAvg(seasonLine.ops),
      unit: "",
      sub: `${seasonLine.ab}AB · ${seasonLine.bb}BB · ${seasonLine.k}K`,
      highlight: seasonLine.ops >= 0.8,
    });
  }

  // Real season pitching
  if (pitchingSeason && pitchingSeason.games > 0) {
    cells.push({
      label: "ERA",
      value: formatERA(pitchingSeason.era),
      unit: "",
      sub: `${formatIP(pitchingSeason.ip)} IP · ${pitchingSeason.k}K · ${pitchingSeason.bb}BB`,
      highlight: pitchingSeason.era > 0 && pitchingSeason.era < 3.0,
    });
    cells.push({
      label: "WHIP",
      value: formatWHIP(pitchingSeason.whip),
      unit: "",
      sub: `${pitchingSeason.games}G · ${pitchingSeason.h}H · ${pitchingSeason.r}R`,
      highlight: pitchingSeason.whip > 0 && pitchingSeason.whip < 1.2,
    });
  }

  // Demo fallback — only on demo/mock profiles, never on real.
  if (!isRealProfile && cells.length < 4) {
    const demoFill: Cell[] = [
      { label: "Exit velo", value: "94", unit: "mph", sub: "+3.2 vs 90d ago", highlight: true },
      { label: "60 yd", value: "6.74", unit: "s", sub: "−0.18 vs 1yr ago", highlight: true },
      { label: "BA · 2026", value: ".372", unit: "", sub: "+.054 vs Jr year", highlight: true },
      { label: "OPS", value: ".979", unit: "", sub: "+.112 vs Jr year", highlight: true },
    ];
    while (cells.length < 4 && demoFill.length > 0) cells.push(demoFill.shift()!);
  }

  // Real profile with fewer than 4 cells: show only what we have. No filler.
  const displayCells = cells.slice(0, 4);

  // If a real profile has NO stats AND no measurables, skip the hero
  // entirely — the empty state below covers it.
  if (isRealProfile && displayCells.length === 0) return null;

  return (
    <div
      className={cn(
        "grid bg-card border border-hair rounded-lg overflow-hidden",
        displayCells.length === 1 && "grid-cols-1",
        displayCells.length === 2 && "grid-cols-1 sm:grid-cols-2",
        displayCells.length === 3 && "grid-cols-1 sm:grid-cols-3",
        displayCells.length >= 4 && "grid-cols-2 md:grid-cols-4",
      )}
    >
      {displayCells.map((c, i) => (
        <div
          key={i}
          className={cn(
            "px-5 py-[22px]",
            i < displayCells.length - 1 && "sm:border-r border-hair-2",
          )}
        >
          <div className="type-label">{c.label}</div>
          <div
            className={cn(
              "font-mono text-[32px] font-semibold tracking-[-0.03em] mt-1.5 leading-none",
              c.highlight && "text-red",
            )}
          >
            {c.value}
            {c.unit && (
              <span className="text-[14px] text-ink-3 font-medium ml-0.5">{c.unit}</span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-ink-3 leading-snug">
            {c.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Career Chart ────────────────────────────────────────────

// ── Announcement Feed ─────────────────────────────────────────────
// LinkedIn/X-style feed of posts on a player's profile. Commitment
// announcements, milestones, updates. Pinned items (like the
// commitment post) float to the top.

const KIND_META: Record<
  PlayerAnnouncement["kind"],
  { label: string; color: string; bg: string }
> = {
  commitment: { label: "Committed", color: "text-grass", bg: "bg-grass-dim" },
  milestone: { label: "Milestone", color: "text-red", bg: "bg-red-soft" },
  achievement: { label: "Achievement", color: "text-gold", bg: "bg-amber-soft" },
  offer: { label: "Offer", color: "text-sky", bg: "bg-sky-soft" },
  video: { label: "Video", color: "text-red", bg: "bg-red-soft" },
  update: { label: "Update", color: "text-ink-2", bg: "bg-paper-deep" },
};

function AnnouncementFeed({
  announcements,
  playerName,
}: {
  announcements: PlayerAnnouncement[];
  playerName: string;
}) {
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          {playerName}&apos;s feed
        </h3>
        <span className="text-[11.5px] text-ink-3 ml-2">
          Commitments, milestones, updates
        </span>
      </div>
      <div className="divide-y divide-hair-2">
        {announcements.map((a) => {
          const meta = KIND_META[a.kind];
          return (
            <div key={a.id} className="p-5">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-[0.06em]",
                    meta.bg,
                    meta.color,
                  )}
                >
                  {meta.label}
                </span>
                {a.pinned && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-xs bg-ink text-white text-[9.5px] font-bold uppercase tracking-[0.06em]">
                    📌 Pinned
                  </span>
                )}
                <span className="text-[11px] text-ink-3 ml-auto font-mono">
                  {new Date(a.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="font-display text-[18px] font-semibold tracking-tight leading-snug">
                {a.title}
              </div>
              {a.body && (
                <p className="text-[13px] text-ink-2 mt-2 leading-relaxed whitespace-pre-wrap">
                  {a.body}
                </p>
              )}
              {a.imageUrl && (
                <img
                  src={a.imageUrl}
                  alt=""
                  className="mt-3 rounded-md border border-hair-2 max-h-[360px] w-full object-cover"
                />
              )}
              {a.linkUrl && (
                <a
                  href={a.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-red hover:underline"
                >
                  Read more →
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Highlight video card ─────────────────────────────────────────
// Resolves a YouTube/Hudl/Vimeo URL into the right iframe embed.

function HighlightVideoCard({ url }: { url: string }) {
  const embed = resolveVideoEmbed(url);
  if (!embed || !embed.embedUrl) {
    return (
      <div className="bg-card border border-hair rounded-lg p-5">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">
            Highlight reel
          </h3>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-red hover:underline"
        >
          Watch on {new URL(url).hostname.replace(/^www\./, "")} →
        </a>
      </div>
    );
  }
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Highlight reel
        </h3>
        <span className="text-[11.5px] text-ink-3 uppercase tracking-[0.06em] font-bold ml-2">
          {embed.provider}
        </span>
      </div>
      <div className="aspect-video w-full bg-ink">
        <iframe
          src={embed.embedUrl}
          title="Highlight video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    </div>
  );
}

function CareerChart() {
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="p-5">
        <div className="flex items-baseline gap-2.5 mb-3.5">
          <div className="text-[14px] font-semibold">Exit velocity · career</div>
          <div className="ml-auto flex gap-1">
            {["60yd", "EV", "Pop", "BA"].map((t) => (
              <button
                key={t}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-xs transition-colors",
                  t === "EV"
                    ? "bg-paper text-ink"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 680 180" className="w-full h-[180px]">
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1="0" y1={y} x2="680" y2={y} stroke="#efeadf" />
          ))}
          {[
            [4, 36, "95"], [4, 76, "85"], [4, 116, "75"], [4, 156, "65"],
          ].map(([x, y, t], i) => (
            <text
              key={i}
              x={x as number}
              y={y as number}
              fontFamily="JetBrains Mono"
              fontSize="9"
              fill="#9ca3af"
            >
              {t}
            </text>
          ))}
          <polyline
            points="30,130 120,118 220,102 320,84 420,64 520,46 620,34"
            fill="none"
            stroke="#c83a3a"
            strokeWidth="2.5"
          />
          <polygon
            points="30,130 120,118 220,102 320,84 420,64 520,46 620,34 620,180 30,180"
            fill="rgba(200,58,58,.08)"
          />
          {[[30, 130], [120, 118], [220, 102], [320, 84], [420, 64], [520, 46]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="4" fill="#c83a3a" />
          ))}
          <circle cx="620" cy="34" r="5" fill="#c83a3a" stroke="#fff" strokeWidth="2" />
          <text
            x="620"
            y="22"
            fontFamily="JetBrains Mono"
            fontSize="10"
            fontWeight="600"
            fill="#0e1116"
            textAnchor="middle"
          >
            94
          </text>
        </svg>
        <div className="font-mono flex justify-between text-[10px] text-ink-4 mt-1 px-2">
          <span>Fr Fall &apos;22</span>
          <span>Fr &apos;23</span>
          <span>So &apos;23</span>
          <span>So &apos;24</span>
          <span>Jr &apos;24</span>
          <span>Jr &apos;25</span>
          <span>Sr · now</span>
        </div>
      </div>
    </div>
  );
}

// ── Career (timeline) ────────────────────────────────────────

// ── Real batting stats card (season + career) ─────────────────
function BattingCard({
  seasonLine,
  careerLine,
}: {
  seasonLine: SeasonBattingLine;
  careerLine: PlayerBattingLine | null;
}) {
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Batting line
        </h3>
        <span className="text-[11.5px] text-ink-3 ml-2">
          Derived live from every at-bat in Rostr
        </span>
        <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-grass-dim text-grass text-[9.5px] font-bold uppercase tracking-[0.04em]">
          <CheckCircle2 className="w-3 h-3" /> Verified
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-hair-2">
        <StatColumn title={`Season ${seasonLine.seasonYear}`} line={seasonLine} />
        {careerLine ? (
          <StatColumn title="Career" line={careerLine} />
        ) : (
          <div className="p-5 text-[12.5px] text-ink-3">Career aggregates as more games are played.</div>
        )}
      </div>
    </div>
  );
}

// ── Real pitching stats card (season + career) ────────────────
function PitchingCard({
  seasonLine,
  careerLine,
}: {
  seasonLine: SeasonPitchingLine;
  careerLine: PlayerPitchingLine | null;
}) {
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Pitching line
        </h3>
        <span className="text-[11.5px] text-ink-3 ml-2">
          Derived live from every at-bat in Rostr
        </span>
        <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-grass-dim text-grass text-[9.5px] font-bold uppercase tracking-[0.04em]">
          <CheckCircle2 className="w-3 h-3" /> Verified
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-hair-2">
        <PitchingColumn title={`Season ${seasonLine.seasonYear}`} line={seasonLine} />
        {careerLine ? (
          <PitchingColumn title="Career" line={careerLine} />
        ) : (
          <div className="p-5 text-[12.5px] text-ink-3">Career totals build up with each outing.</div>
        )}
      </div>
    </div>
  );
}

function PitchingColumn({
  title,
  line,
}: {
  title: string;
  line: SeasonPitchingLine | PlayerPitchingLine;
}) {
  return (
    <div className="p-5">
      <div className="type-label mb-3">{title}</div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <BigStat label="ERA" value={formatERA(line.era)} highlight={line.era > 0 && line.era < 3.0} />
        <BigStat label="WHIP" value={formatWHIP(line.whip)} highlight={line.whip > 0 && line.whip < 1.2} />
        <BigStat label="K/9" value={line.k9 > 0 ? line.k9.toFixed(1) : "—"} highlight={line.k9 >= 10} />
      </div>
      <div className="grid grid-cols-4 gap-2 text-[12px]">
        <MiniStat label="G" v={String(line.games)} />
        <MiniStat label="IP" v={formatIP(line.ip)} />
        <MiniStat label="K" v={String(line.k)} />
        <MiniStat label="BB" v={String(line.bb)} />
        <MiniStat label="H" v={String(line.h)} />
        <MiniStat label="HR" v={String(line.hr)} />
        <MiniStat label="R" v={String(line.r)} />
        <MiniStat label="BF" v={String(line.bf)} />
      </div>
    </div>
  );
}

function StatColumn({
  title,
  line,
}: {
  title: string;
  line: SeasonBattingLine | PlayerBattingLine;
}) {
  return (
    <div className="p-5">
      <div className="type-label mb-3">{title}</div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <BigStat label="AVG" value={formatAvg(line.ba)} highlight={line.ba >= 0.3} />
        <BigStat label="OBP" value={formatAvg(line.obp)} />
        <BigStat label="SLG" value={formatAvg(line.slg)} />
      </div>
      <div className="grid grid-cols-4 gap-2 text-[12px]">
        <MiniStat label="G" v={String(line.games)} />
        <MiniStat label="AB" v={String(line.ab)} />
        <MiniStat label="H" v={String(line.h)} />
        <MiniStat label="HR" v={String(line.hr)} />
        <MiniStat label="RBI" v={String(line.rbi)} />
        <MiniStat label="BB" v={String(line.bb)} />
        <MiniStat label="K" v={String(line.k)} />
        <MiniStat label="OPS" v={formatAvg(line.ops)} />
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "font-mono text-[28px] font-bold tracking-[-0.03em] leading-none",
          highlight && "text-red",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-1">
        {label}
      </div>
    </div>
  );
}

function MiniStat({ label, v }: { label: string; v: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[14px] font-semibold">{v}</div>
      <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-0.5">
        {label}
      </div>
    </div>
  );
}

function Career({
  player,
  seasonLine,
  pitchingSeason,
}: {
  player: MockPlayer;
  seasonLine: SeasonBattingLine | null;
  pitchingSeason: SeasonPitchingLine | null;
}) {
  // Per-player career timeline. Anchors on the player's CURRENT-season
  // numbers (from seasonLine + pitchingSeason) and synthesizes prior
  // seasons by walking back the timeline year by year. Each prior year
  // shaves off a small slice of production so the arc looks like real
  // development (sophomore → junior → senior peak), with the current
  // year's BA / OPS exactly matching the StatHero + BattingCard above.
  const seasons = buildCareerSeasons(player, seasonLine, pitchingSeason);
  const badgeStyles: Record<"v" | "jv" | "club", string> = {
    v: "bg-red-soft text-red",
    jv: "bg-paper-deep text-ink-2",
    club: "bg-grass-dim text-grass",
  };

  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Career</h3>
        <span className="text-[12px] text-ink-3 ml-2">{seasons.length} seasons · HS{seasons.some((s) => s.badgeKind === "club") ? " + club" : ""}</span>
      </div>
      <div>
        {seasons.map((s, i) => (
          <div key={i} className="px-[22px] py-5 border-b border-hair-2 last:border-b-0">
            <div className="flex items-baseline gap-2.5 mb-3.5 flex-wrap">
              <span className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                {s.year}
              </span>
              <span className={cn("px-2 py-0.5 rounded-xs text-[10.5px] font-bold tracking-[0.04em]", badgeStyles[s.badgeKind])}>
                {s.badge}
              </span>
              <span className="text-ink-3 text-[12.5px] ml-auto">{s.team}</span>
            </div>
            <div className="grid grid-cols-5 gap-2.5 text-[12px]">
              {s.stats.map(([label, value], j) => (
                <div key={j}>
                  <div className="font-mono text-[17px] font-semibold">{value}</div>
                  <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {s.note && (
              <div className="mt-3 px-3 py-2.5 bg-paper rounded-md text-[12.5px] text-ink-2 border-l-[3px] border-l-red leading-relaxed">
                {s.note.split("**").map((part, j) =>
                  j % 2 === 1 ? <b key={j} className="text-ink font-semibold">{part}</b> : part,
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * buildCareerSeasons — synthesize prior seasons from the player's
 * current line so the Career timeline numbers stay consistent with
 * the StatHero + BattingCard above. Walks back from the player's
 * `gradYear` and `classYearShort`, decaying BA/OBP/SLG slightly each
 * year (development arc) and shrinking AB count for sophomore /
 * freshman seasons.
 *
 * Pure derivation, no random — same player → same career every render.
 */
interface CareerSeason {
  year: string;
  badge: string;
  badgeKind: "v" | "jv" | "club";
  team: string;
  stats: Array<[string, string]>;
  note?: string;
}

function buildCareerSeasons(
  player: MockPlayer,
  seasonLine: SeasonBattingLine | null,
  pitchingSeason: SeasonPitchingLine | null,
): CareerSeason[] {
  const fmtAvg = (n: number) => n.toFixed(3).replace(/^0/, "");
  const fmtEra = (n: number) => n.toFixed(2);
  const seasons: CareerSeason[] = [];
  const yearLabels: Record<string, string> = {
    Sr: "Senior",
    Jr: "Junior",
    So: "Sophomore",
    Fr: "Freshman",
  };
  const classOrder: Array<MockPlayer["classYearShort"]> = ["Sr", "Jr", "So", "Fr"];
  const currentClassIdx = classOrder.indexOf(player.classYearShort);

  // School-season year for each class level. A class-of-2028 player's
  // senior season is 2028, their junior season is 2027, etc. — so the
  // year for class-index i is `gradYear - i`. Iterating from the
  // current class index walks the player's actual completed seasons.
  const seasonYearFor = (classIdx: number): number => player.gradYear - classIdx;

  // Build hitter career chain (if the player has batting numbers).
  if (seasonLine && seasonLine.games > 0) {
    const baCurrent = seasonLine.ba;
    const obpCurrent = seasonLine.obp;
    const slgCurrent = seasonLine.slg;
    // Walk back from current class year toward freshman.
    for (let i = currentClassIdx; i < classOrder.length; i++) {
      const stepsBack = i - currentClassIdx; // 0 = current, 1 = prior, ...
      const cls = classOrder[i];
      const yr = seasonYearFor(i);
      // Decay: each step back loses ~25 BA points + scaled OBP/SLG.
      const decay = stepsBack * 0.025;
      const baThen = Math.max(0.18, baCurrent - decay);
      const obpThen = Math.max(0.22, obpCurrent - decay * 0.85);
      const slgThen = Math.max(0.24, slgCurrent - decay * 1.1);
      const games = stepsBack === 0 ? Math.max(seasonLine.games, 18) : 28 - stepsBack * 4;
      const ab = Math.round(games * 3.6);
      const sb = Math.max(2, Math.round(seasonLine.games * 0.3 - stepsBack * 3));
      const rbi = Math.max(4, Math.round(seasonLine.rbi - stepsBack * 6));
      const isVarsity = stepsBack <= 1 || cls === "Sr" || cls === "Jr";
      seasons.push({
        year: `${yearLabels[cls]} · ${yr}`,
        badge: isVarsity ? "VARSITY" : "JV",
        badgeKind: isVarsity ? "v" : "jv",
        team: stepsBack === 0
          ? `Lincoln HS · ${games} G (in progress)`
          : `Lincoln HS · ${games} G`,
        stats: [
          ["BA", fmtAvg(baThen)],
          ["OBP", fmtAvg(obpThen)],
          ["SLG", fmtAvg(slgThen)],
          ["SB", String(sb)],
          ["RBI", String(rbi)],
        ],
        note: stepsBack === 0
          ? (baCurrent >= 0.32
              ? "Current run. **All-Conference frontrunner**."
              : baCurrent >= 0.28
                ? "Steady senior year. Big role in the lineup."
                : "Development year. Putting in extra reps before each game.")
          : undefined,
      });
    }
    // Add a club summer between current and prior year (only for HS upperclassmen).
    if (currentClassIdx <= 1 && seasons.length >= 2) {
      const clubBA = Math.min(0.395, baCurrent + 0.015);
      seasons.splice(1, 0, {
        year: `Summer '${String(seasonYearFor(currentClassIdx) - 1).slice(-2)}`,
        badge: "CLUB · 17U",
        badgeKind: "club",
        team: "Texas Storm Baseball · PG showcases",
        stats: [
          ["BA", fmtAvg(clubBA)],
          ["EV HIGH", String(Math.round(83 + baCurrent * 30))],
          ["60YD", (7.0 - (baCurrent - 0.25) * 1.4).toFixed(2)],
          ["TOURN", "4"],
          ["CAMPS", "2"],
        ],
      });
    }
    return seasons;
  }

  // Pitcher-only path: build career from ERA.
  if (pitchingSeason && pitchingSeason.games > 0) {
    const eraCurrent = pitchingSeason.era;
    const whipCurrent = pitchingSeason.whip;
    for (let i = currentClassIdx; i < classOrder.length; i++) {
      const stepsBack = i - currentClassIdx;
      const cls = classOrder[i];
      const yr = seasonYearFor(i);
      // ERA gets WORSE going back (less command); WHIP follows.
      const eraThen = eraCurrent + stepsBack * 0.55;
      const whipThen = whipCurrent + stepsBack * 0.10;
      const ip = Math.max(8, Math.round((stepsBack === 0 ? pitchingSeason.ip : 30 - stepsBack * 8)));
      const k = Math.round((pitchingSeason.k9 * ip) / 9);
      const games = stepsBack === 0 ? pitchingSeason.games : Math.max(2, 10 - stepsBack * 2);
      const isVarsity = stepsBack <= 1;
      seasons.push({
        year: `${yearLabels[cls]} · ${yr}`,
        badge: isVarsity ? "VARSITY" : "JV",
        badgeKind: isVarsity ? "v" : "jv",
        team: stepsBack === 0
          ? `Lincoln HS · ${games} G (in progress)`
          : `Lincoln HS · ${games} G`,
        stats: [
          ["ERA", fmtEra(eraThen)],
          ["WHIP", whipThen.toFixed(2)],
          ["IP", ip.toFixed(1)],
          ["K", String(k)],
          ["G", String(games)],
        ],
        note: stepsBack === 0
          ? (eraCurrent < 3.0
              ? "Current ace. **Sub-3.00 ERA** with command."
              : eraCurrent < 4.0
                ? "Reliable starter. Senior leadership role."
                : "Working through a few rough outings — pitch mix improving.")
          : undefined,
      });
    }
    return seasons;
  }

  // Fallback: shouldn't be hit because Career only renders when
  // showMockSections is true and demo players always have stats.
  return [
    {
      year: `${yearLabels[player.classYearShort]} · ${player.gradYear}`,
      badge: "VARSITY",
      badgeKind: "v",
      team: `Lincoln HS · ${player.classYearShort} year`,
      stats: [],
    },
  ];
}

// ── Highlights ──────────────────────────────────────────────

function Highlights() {
  const highlights = [
    { title: "Triple vs Eastside · 4/19", meta: "0:24 · 12.4k views", new: true, gradient: "from-[#1a1e26] to-[#0e1116]" },
    { title: "Diving catch · CF gap", meta: "0:18 · 8.2k views", gradient: "from-[#1d2430] to-[#0e1116]" },
    { title: "Walk-off vs Westfield", meta: "0:31 · 21.1k views", gradient: "from-[#301a1a] to-[#0e1116]" },
    { title: "BP round · July showcase", meta: "1:04 · 4.8k views", gradient: "from-[#1a2a1f] to-[#0e1116]" },
    { title: "6.74 60yd · PG South", meta: "0:12 · 3.3k views", gradient: "from-[#1a2230] to-[#0e1116]" },
    { title: "Runner out at home", meta: "0:22 · 6.5k views", gradient: "from-[#2a2218] to-[#0e1116]" },
  ];
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Highlights</h3>
        <span className="text-[12px] text-ink-3 ml-2">Latest 6 of 18</span>
        <button className="ml-auto text-[12px] text-ink-3 hover:text-ink">View all →</button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2.5">
          {highlights.map((h, i) => (
            <div
              key={i}
              className={cn(
                "relative aspect-[9/16] rounded-md overflow-hidden cursor-pointer bg-gradient-to-br",
                h.gradient,
              )}
            >
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(200,58,58,.2), transparent 45%), radial-gradient(circle at 50% 45%, rgba(255,255,255,.08), transparent 55%)",
                }}
              />
              {h.new && (
                <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-red text-white rounded-[4px] text-[9px] font-bold uppercase tracking-[0.06em]">
                  NEW
                </span>
              )}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-ink flex items-center justify-center text-[12px]">
                ▶
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white bg-gradient-to-t from-black/90 to-transparent">
                <div className="text-[11.5px] font-semibold leading-tight">{h.title}</div>
                <div className="font-mono text-[9.5px] text-white/70 mt-0.5">{h.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Combine & measurables ───────────────────────────────────

function Combine({
  measurables,
  mockBio,
}: {
  measurables: PlayerMeasurable[];
  mockBio: MockBio | null;
}) {
  // Real tryout-derived measurables first, then fill out the grid with
  // mock "bio" fields (height/weight/bats) that aren't tryout-measured.
  interface MetricCell {
    v: string;
    u: string;
    l: string;
    d?: string;
    verified?: boolean;
  }
  const realMetrics: MetricCell[] = measurables.map((m) => ({
    v: formatMeasurable(m),
    u: m.unit ?? "",
    l: m.stationName,
    d: m.verifiedByCoachName ? `verified · ${m.verifiedByCoachName.split(" ")[0]}` : "verified",
    verified: true,
  }));
  // Per-player bio when available (demo profiles), generic fallback otherwise.
  const bio: MetricCell[] = [
    { v: mockBio?.height ?? "6'0\"", u: "", l: "Height" },
    { v: String(mockBio?.weight ?? 175), u: "", l: "Weight" },
    {
      v: `${mockBio?.bats ?? "R"}/${mockBio?.throws ?? "R"}`,
      u: "",
      l: "Bats/Throws",
    },
  ];
  const metrics: MetricCell[] = realMetrics.length > 0 ? [...realMetrics, ...bio] : bio;
  const latestCoach = measurables.find((m) => m.verifiedByCoachName)?.verifiedByCoachName;
  const latestDate = measurables
    .map((m) => (m.latestAt ? new Date(m.latestAt) : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-hair-2 flex-wrap">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Combine &amp; measurables
        </h3>
        <span className="text-[12px] text-ink-3 ml-2">
          {realMetrics.length > 0 ? (
            <>
              verified by {latestCoach ?? "coach"}
              {latestDate ? ` · ${latestDate.toLocaleDateString()}` : ""}
            </>
          ) : (
            <>no verified measurables yet</>
          )}
        </span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {metrics.map((m, i) => (
            <div key={i} className="p-3.5 bg-paper rounded-md">
              <div className="font-mono text-[22px] font-semibold tracking-[-0.02em]">
                {m.v}
                {m.u && <span className="text-[11px] text-ink-3 ml-0.5 font-normal">{m.u}</span>}
              </div>
              <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-1">{m.l}</div>
              {m.d && (
                <div className={cn(
                  "text-[10px] mt-0.5 font-semibold",
                  m.verified ? "text-grass inline-flex items-center gap-1" : "text-grass",
                )}>
                  {m.verified && <CheckCircle2 className="w-2.5 h-2.5" />}
                  {m.d}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Side column ─────────────────────────────────────────────

function ShareCard({ handle }: { handle: string }) {
  return (
    <div className="relative overflow-hidden bg-ink text-white rounded-lg p-[18px]">
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(200,58,58,.3), transparent 65%)",
        }}
      />
      <div className="relative">
        <h4 className="font-display text-[16px] font-semibold tracking-tight">Share your profile</h4>
        <p className="text-[12.5px] text-white/70 mt-1 leading-relaxed">
          College coaches, scouts, recruiters — send your whole career in one link.
        </p>
        <div className="mt-3 px-3 py-2.5 bg-white/[0.08] rounded-md font-mono text-[11.5px] flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-white/50 shrink-0" />
          <span className="text-white/55">rostr.app/</span>
          <b className="text-red">{handle}</b>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <button className="flex-1 py-2.5 bg-red text-white rounded-sm text-[12px] font-semibold">
            Copy link
          </button>
          <button className="flex-1 py-2.5 bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm text-[12px] font-semibold">
            📸 Story
          </button>
          <button className="px-3 py-2.5 bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm text-[12px] font-semibold">
            ⇪
          </button>
        </div>
      </div>
    </div>
  );
}

function RecruitingCard({ recruiting }: { recruiting: MockRecruiting | null }) {
  // Per-player school list + view count when on a demo profile.
  // Sophomores with quiet numbers see 2-3 schools watching; seniors
  // with high BA / low ERA see a packed Power-5 board. Every demo
  // player has a different list.
  const r: MockRecruiting = recruiting ?? {
    viewsLast30: 7,
    schools: [
      { initials: "TX", color: "sky", name: "Texas State", meta: "saved · 3d ago", interested: true },
      { initials: "BU", color: "grass", name: "Baylor", meta: "viewed · 6d ago" },
      { initials: "OU", color: "amber", name: "Oklahoma", meta: "viewed · 12d ago" },
      { initials: "AR", color: "dirt", name: "Arkansas", meta: "viewed · 18d ago" },
    ],
  };
  const colorClass: Record<MockRecruiting["schools"][number]["color"], string> = {
    sky: "bg-sky",
    grass: "bg-grass",
    amber: "bg-amber",
    dirt: "bg-dirt",
    red: "bg-red",
    ink: "bg-ink",
  };
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Recruiting interest</h3>
      </div>
      <div className="p-4 space-y-2">
        <div className="bg-paper-deep border border-dashed border-hair rounded-md p-3.5 text-center">
          <div className="font-mono text-[20px] font-semibold text-red">{r.viewsLast30}</div>
          <div className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.05em] mt-0.5">
            college coaches viewed · 30d
          </div>
        </div>
        {r.schools.length > 0 ? (
          <div className="space-y-2 mt-3.5">
            {r.schools.map((i, idx) => (
              <div key={idx} className="px-3 py-2.5 bg-paper rounded-md flex items-center gap-2.5 text-[12px]">
                <div className={cn("w-[26px] h-[26px] rounded-xs flex items-center justify-center text-white text-[10px] font-bold", colorClass[i.color])}>
                  {i.initials}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{i.name}</div>
                  <div className="font-mono text-[10px] text-ink-3">{i.meta}</div>
                </div>
                {i.interested && <span className="text-red text-[11px] font-semibold">Interested</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-ink-3 mt-3 text-center px-3 py-4 leading-relaxed">
            Still under the radar. As stats land + the season rolls,
            recruiters will start tracking.
          </div>
        )}
      </div>
    </div>
  );
}

function AcademicsCard({ academic }: { academic: MockAcademic | null }) {
  // Per-player academic profile when on a demo profile. Falls back to
  // the original Jordan-Kim numbers when no per-player data is given,
  // which only happens if MOCK_ACADEMIC_BY_PLAYER doesn't have a row.
  const a: MockAcademic = academic ?? {
    gpa: "3.78",
    sat: 1320,
    classRank: "32 / 412",
    major: "Business",
    targetDiv: "D1 / D2",
  };
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-ink-3" />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Academic</h3>
      </div>
      <div>
        {[
          ["GPA", a.gpa],
          ["SAT", String(a.sat)],
          ["Class rank", a.classRank],
          ["Major (intended)", a.major],
          ["Target div", a.targetDiv],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between items-center px-4 py-2.5 border-b border-hair-2 last:border-b-0 text-[13px]">
            <span className="text-ink-3 font-medium">{label}</span>
            <span className="font-mono font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachVerification({ measurables }: { measurables: PlayerMeasurable[] }) {
  // Group real verifications by coach so we don't list the same coach once per
  // station. Falls back to mock chain when we have no real data yet.
  const byCoach = new Map<string, { name: string; stations: string[]; latestAt: Date | null }>();
  for (const m of measurables) {
    if (!m.verifiedByCoachName) continue;
    const existing = byCoach.get(m.verifiedByCoachName);
    const d = m.latestAt ? new Date(m.latestAt) : null;
    if (existing) {
      existing.stations.push(m.stationName);
      if (d && (!existing.latestAt || d > existing.latestAt)) existing.latestAt = d;
    } else {
      byCoach.set(m.verifiedByCoachName, {
        name: m.verifiedByCoachName,
        stations: [m.stationName],
        latestAt: d,
      });
    }
  }

  const realChain = Array.from(byCoach.values())
    .sort((a, b) => (b.latestAt?.getTime() ?? 0) - (a.latestAt?.getTime() ?? 0))
    .map((c) => ({
      initials: c.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      name: `Coach ${c.name}`,
      role: "Tryout evaluator",
      what: `verified ${c.stations.slice(0, 3).join(", ")}${c.stations.length > 3 ? "…" : ""}`,
      when: c.latestAt ? c.latestAt.toLocaleDateString() : "",
    }));

  const mockChain = [
    { initials: "JR", name: "Coach Joe Ruiz", role: "Head Coach · Lincoln HS", what: "verified combine measurables", when: "Apr 2, 2026" },
    { initials: "DM", name: "Coach Dan Morales", role: "Head Coach · Texas Storm 17U", what: "verified summer game stats", when: "Aug 14, 2025" },
    { initials: "AR", name: "Anthony Reyes", role: "PG South Showcase Eval", what: "verified 60yd time + EV", when: "Jul 22, 2025" },
  ];

  const chain = realChain.length > 0 ? realChain : mockChain;

  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-ink-3" />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Verification chain</h3>
      </div>
      <div>
        {chain.map((v, i) => (
          <div key={i} className="px-[18px] py-3.5 border-b border-hair-2 last:border-b-0 flex gap-2.5 items-start">
            <Avatar size="md" color="ink" initials={v.initials} />
            <div className="flex-1 text-[13px] leading-relaxed">
              <div>
                <b className="font-semibold">{v.name}</b>{" "}
                <span className="text-ink-3">— {v.what}</span>
              </div>
              <div className="font-mono text-[10.5px] text-ink-3 mt-0.5">
                {v.role}
                {v.when ? ` · ${v.when}` : ""}
              </div>
            </div>
            <Star className="w-3.5 h-3.5 text-grass shrink-0 mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMeasurable(m: PlayerMeasurable): string {
  if (m.scoreType === "rating") return m.bestValue.toFixed(1);
  if (m.unit === "s") return m.bestValue.toFixed(2);
  return m.bestValue.toFixed(1).replace(/\.0$/, "");
}

/**
 * MockProfileBanner — shown on /p/[handle] when the URL didn't match
 * a real player and we fell back to a fictional Lincoln HS profile.
 *
 * Privacy purpose: ensures visitors poking at random handles (or
 * UUID-enumerating) cannot mistake fictional players for someone
 * real. Pairs with the dedicated /demo tour for a guided experience.
 */
function MockProfileBanner() {
  return (
    <div className="bg-amber-soft border-b-2 border-amber">
      <div className="max-w-layout-marketing mx-auto px-4 sm:px-6 lg:px-7 py-2 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-amber text-white text-[10px] font-bold uppercase tracking-[0.08em]">
          <Eye className="w-3 h-3" />
          Demo data
        </span>
        <span className="text-[12.5px] text-ink-2 leading-snug flex-1 min-w-[200px]">
          This is a fictional sample profile. No real player data shown.{" "}
          <Link
            href="/demo"
            className="font-semibold text-red hover:underline"
          >
            See the full demo tour →
          </Link>
        </span>
      </div>
    </div>
  );
}

// ── Real player profile additions (migration 30) ────────────────────

/** Decide whether to render the academics card. We hide it when every
 *  field is null — coaches don't need an empty card on the page. */
function hasAnyRealAcademics(a: PlayerAcademics): boolean {
  return Boolean(
    a.gpa ||
      a.satScore != null ||
      a.actScore != null ||
      (a.classRankNumerator != null && a.classRankDenominator != null) ||
      a.intendedLevel ||
      a.bio,
  );
}

/**
 * Real academics card — renders only the fields the player chose to
 * share. Mirrors the visual rhythm of the mock AcademicsCard so the
 * profile feels consistent regardless of demo vs. real.
 *
 * `showVerifiedBadge` is set by the advanced-profiles flag. When ON,
 * we badge this card as "Player reported" — academics live in the
 * player-typed bucket (GPA / SAT / ACT are inputs, not verified by
 * Rostr's scoring engine). The label is critical: a recruiter looking
 * at a player profile must see at a glance which fields are claimed
 * vs. measured.
 */
function RealAcademicsCard({
  academics,
  showVerifiedBadge,
}: {
  academics: PlayerAcademics;
  showVerifiedBadge?: boolean;
}) {
  const rows: Array<[string, string]> = [];
  if (academics.gpa) rows.push(["GPA", academics.gpa]);
  if (academics.satScore != null) rows.push(["SAT", String(academics.satScore)]);
  if (academics.actScore != null) rows.push(["ACT", String(academics.actScore)]);
  if (academics.classRankNumerator != null && academics.classRankDenominator != null) {
    rows.push([
      "Class rank",
      `${academics.classRankNumerator} of ${academics.classRankDenominator}`,
    ]);
  }
  if (academics.intendedLevel) rows.push(["Target level", academics.intendedLevel]);

  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2 flex-wrap">
        <GraduationCap className="w-4 h-4 text-ink-3" />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Academic
        </h3>
        {showVerifiedBadge && (
          <span className="ml-auto">
            <PlayerReportedBadge size="sm" />
          </span>
        )}
      </div>
      {academics.bio && (
        <div className="px-5 py-3.5 border-b border-hair-2 text-[13px] leading-relaxed text-ink-2">
          {academics.bio}
        </div>
      )}
      {rows.length > 0 ? (
        <div>
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between items-center px-4 py-2.5 border-b border-hair-2 last:border-b-0 text-[13px]"
            >
              <span className="text-ink-3 font-medium">{label}</span>
              <span className="font-mono font-semibold">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-5 text-[12px] text-ink-3 italic">
          Player-entered academic info will appear here.
        </div>
      )}
    </div>
  );
}

/**
 * Real highlights card — embedded video grid for claimed profiles.
 * Renders a grid of 1–3 columns depending on how many clips the player
 * has uploaded (up to 6 max from the editor). Each tile auto-plays the
 * preview thumbnail and clicks through to the full provider page.
 */
function RealHighlightsCard({
  highlights,
  showSourceBadges,
}: {
  highlights: PlayerHighlight[];
  /**
   * When ON (advanced-profiles flag), each clip card shows either
   * VerifiedBadge or PlayerReportedBadge. OFF preserves the existing
   * unbadged layout.
   */
  showSourceBadges?: boolean;
}) {
  // First clip gets the full-width "hero" treatment with embed; subsequent
  // clips render as smaller cards. iOS Photos / LinkedIn pattern.
  const [hero, ...rest] = highlights;
  if (!hero) return null;
  const heroEmbed = resolveVideoEmbed(hero.url);
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2 flex-wrap">
        <Trophy className="w-4 h-4 text-red" />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Highlights
        </h3>
        {showSourceBadges &&
          (hero.verifiedByCoach ? (
            <VerifiedBadge
              size="sm"
              source={hero.verifiedByName ?? "Coach Verified"}
            />
          ) : (
            <PlayerReportedBadge size="sm" />
          ))}
        <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
          {highlights.length}
        </span>
      </div>
      {/* Hero embed */}
      <div className="bg-ink">
        {heroEmbed?.embedUrl ? (
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={heroEmbed.embedUrl}
              title={hero.caption ?? "Highlight"}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          // Providers we can't iframe (TikTok / Instagram / X / unknown).
          // Render a labelled "Open on <provider>" tile rather than a
          // broken embed.
          <a
            href={hero.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-5 py-8 text-center text-white/85 underline text-[13px]"
          >
            Open on {providerLabel(heroEmbed?.provider)} →
          </a>
        )}
      </div>
      {hero.caption && (
        <div className="px-5 py-2.5 text-[12.5px] text-ink-2">{hero.caption}</div>
      )}

      {rest.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-paper-deep border-t border-hair-2">
          {rest.map((h) => {
            const e = resolveVideoEmbed(h.url);
            return (
              <a
                key={h.id}
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-md overflow-hidden bg-ink relative"
              >
                <div
                  className="w-full bg-cover bg-center"
                  style={{
                    aspectRatio: "16 / 9",
                    backgroundImage: e?.thumbnailUrl
                      ? `url("${e.thumbnailUrl}")`
                      : "linear-gradient(135deg, #14181f, #0a0d12)",
                  }}
                />
                {showSourceBadges && (
                  <div className="absolute top-1.5 left-1.5">
                    {h.verifiedByCoach ? (
                      <VerifiedBadge size="sm" />
                    ) : (
                      <PlayerReportedBadge size="sm" />
                    )}
                  </div>
                )}
                {h.caption && (
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10.5px] text-white bg-black/60 truncate">
                    {h.caption}
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Prior seasons card — player-typed history from before Rostr or
 * outside-of-program play (travel, summer ball, etc.). Always rendered
 * with a Player-reported badge so a recruiter can never confuse this
 * with verified Rostr-tracked stats.
 *
 * Flag-gated by NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES +
 * NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS at the call site.
 *
 * Layout: stack of season rows, each one collapsible-feel (compact
 * mobile, expanded desktop). Optional fields hide when empty so the
 * row doesn't waste vertical space on missing values.
 */
function PriorSeasonsCard({ rows }: { rows: PlayerPriorStat[] }) {
  // Migration 37 added per-row verification. The card-level header
  // badge now reflects the WHOLE card's state: if every row is
  // verified, badge the header Verified; if mixed, show "Mixed";
  // if all unverified, the original Player Reported. Per-row badges
  // give the recruiter the unambiguous read.
  const verifiedCount = rows.filter((r) => r.verifiedByCoach).length;
  const allVerified = verifiedCount === rows.length && rows.length > 0;
  const someVerified = verifiedCount > 0 && !allVerified;
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2 flex-wrap">
        <ListChecksIcon />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Prior seasons
        </h3>
        <span className="ml-auto">
          {allVerified ? (
            <VerifiedBadge size="sm" source="Coach Verified" />
          ) : someVerified ? (
            <span
              className="inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.06em] bg-amber-soft text-amber border border-amber/25 px-2 py-0.5 text-[10.5px]"
              title={`${verifiedCount} of ${rows.length} rows coach-verified`}
            >
              {verifiedCount}/{rows.length} verified
            </span>
          ) : (
            <PlayerReportedBadge size="sm" />
          )}
        </span>
      </div>
      <div>
        {rows.map((row, i) => {
          // Build the inline stat-line text from any populated batting fields.
          const battingBits: string[] = [];
          if (row.ba) battingBits.push(`${row.ba} BA`);
          if (row.ops) battingBits.push(`${row.ops} OPS`);
          if (row.hr) battingBits.push(`${row.hr} HR`);
          if (row.rbi) battingBits.push(`${row.rbi} RBI`);
          const verified = Boolean(row.verifiedByCoach);
          return (
            <div
              key={row.id ?? i}
              className={cn(
                "px-5 py-3.5 border-b border-hair-2 last:border-b-0",
                verified && "bg-grass-dim/15",
              )}
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                  <div className="font-display text-[14px] font-semibold tracking-tight">
                    {row.season}
                  </div>
                  {row.level && (
                    <span className="text-[11.5px] text-ink-3 font-medium">
                      {row.level}
                    </span>
                  )}
                </div>
                {verified ? (
                  <VerifiedBadge
                    size="sm"
                    source={row.verifiedByName ?? "Coach Verified"}
                  />
                ) : (
                  <PlayerReportedBadge size="sm" />
                )}
              </div>
              {battingBits.length > 0 && (
                <div className="mt-1 text-[12.5px] text-ink-2 font-mono tabular-nums">
                  {battingBits.join(" · ")}
                </div>
              )}
              {row.pitching && (
                <div className="mt-1 text-[12.5px] text-ink-2">
                  <span className="text-ink-3 font-mono text-[10.5px] uppercase tracking-[0.06em] mr-1.5">
                    Pitching
                  </span>
                  {row.pitching}
                </div>
              )}
              {row.context && (
                <div className="mt-1 text-[11.5px] text-ink-3 leading-snug italic">
                  {row.context}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-2.5 bg-paper-deep border-t border-hair-2 text-[10.5px] text-ink-3 leading-snug">
        {allVerified
          ? "Each row reviewed and vouched for by a coach in the program."
          : someVerified
            ? "Verified rows reviewed by a coach. Player-reported rows are self-typed."
            : "Reported by the player. Not independently verified."}
      </div>
    </div>
  );
}

/**
 * Inline list-checks icon. Avoids importing another lucide icon at
 * the top of the file just for one card header.
 */
function ListChecksIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-amber"
      aria-hidden
    >
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  );
}

/**
 * Map a `VideoEmbed["provider"]` to a human label for the "Open on …"
 * fallback link. We center on the provider name so the player + viewer
 * both know exactly where the click lands.
 */
function providerLabel(provider: string | undefined): string {
  switch (provider) {
    case "youtube":
      return "YouTube";
    case "hudl":
      return "Hudl";
    case "vimeo":
      return "Vimeo";
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "x":
      return "X";
    default:
      return "site";
  }
}

/**
 * Public contact + socials card. Always rendered with the
 * PlayerReportedBadge atom — these handles are typed by the player and
 * never independently verified.
 *
 * Inputs are flexible: a row can be "@handle" or a full URL or a phone
 * number. We render the value as plain text (no auto-linking yet) so a
 * malformed URL doesn't break the card. Future iteration can normalize
 * to clickable links once the data shape stabilizes.
 */
function ContactInfoCard({
  fields,
}: {
  fields: Array<[string, string | null]>;
}) {
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-5 py-4 border-b border-hair-2 flex items-center gap-2 flex-wrap">
        <Link2 className="w-4 h-4 text-ink-3" />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Contact
        </h3>
        <span className="ml-auto">
          <PlayerReportedBadge size="sm" />
        </span>
      </div>
      <div>
        {fields.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between items-center px-4 py-2.5 border-b border-hair-2 last:border-b-0 text-[13px] gap-3"
          >
            <span className="text-ink-3 font-medium shrink-0">{label}</span>
            <span className="font-mono text-[12.5px] truncate text-right">
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 bg-paper-deep border-t border-hair-2 text-[10.5px] text-ink-3 leading-snug">
        Player-supplied. Verify before reaching out.
      </div>
    </div>
  );
}
