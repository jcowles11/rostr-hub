import { HubView } from "@/app/app/hub-view";
import {
  MOCK_PLAYERS,
  MOCK_TEAM,
  MOCK_COACH,
  MOCK_SPOTLIGHT,
  getMockWeek,
} from "@/lib/mock-data";

// Always render against the actual current date so the demo schedule
// never goes stale. No SSG caching — this page must be dynamic.
export const dynamic = "force-dynamic";

/**
 * /demo — interactive Coach Hub with fictional Lincoln HS data.
 *
 * Renders the same HubView client component the real /app uses, just
 * with mock props instead of Supabase reads. A coach who lands here
 * sees the actual product — not screenshots — and can click into
 * Roster / Practice / Schedule / Games via the sidebar.
 *
 * Mutations (modals, server actions) will toast errors because there's
 * no auth context — that's intentional friction pushing toward signup.
 */
export const metadata = {
  title: "Demo · Rostr",
  description:
    "Walk through the real Coach Hub with fictional team data. No signup required.",
  robots: { index: false, follow: false },
};

export default function DemoHubPage() {
  const weekItems = getMockWeek();
  // The next-game card on the Hub uses an "Apr 24"-style label. Compute
  // the actual upcoming-Friday date (matches the schedule + games pages
  // so a click from the Hub doesn't bounce to a different week).
  const now = new Date();
  const friDate = (() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
    return d;
  })();
  const nextGameDate = friDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  // Build a small synthetic activity feed so the demo Hub doesn't show
  // "no activity yet" — uses real player names + plausible coach actions.
  return (
    <HubView
      greetingName={MOCK_COACH.name.split(" ")[1] ?? MOCK_COACH.name}
      programName={MOCK_TEAM.name}
      nextGame={{
        id: "demo-g1",
        opponent: "Central Hawks",
        dateLabel: nextGameDate,
        timeLabel: "5:00 PM",
        location: "Lincoln HS · Main",
      }}
      weekItems={weekItems}
      availabilityPlayers={MOCK_PLAYERS}
      playerCount={MOCK_PLAYERS.length}
      activity={[
        { id: "a1", kind: "score",          at: new Date(Date.now() - 1 * 3600e3).toISOString(),  icon: "📈", iconColor: "grass", content: "<b>Marcus Johnson</b> hit safely for the 7th straight game.", meta: "1h ago" },
        { id: "a2", kind: "roster_change",  at: new Date(Date.now() - 3 * 3600e3).toISOString(),  icon: "🩹", iconColor: "amber", content: "<b>Noah Patel</b> moved to <b>questionable</b> — wrist tweak (Anita Patel).", meta: "3h ago" },
        { id: "a3", kind: "note",           at: new Date(Date.now() - 22 * 3600e3).toISOString(), icon: "📒", iconColor: "ink",   content: "<b>Coach Rivera</b> updated <b>Tuesday's practice plan</b> — moved infield to 4:15.", meta: "Yesterday" },
        { id: "a4", kind: "game_scheduled", at: new Date(Date.now() - 26 * 3600e3).toISOString(), icon: "🏟", iconColor: "sky",   content: "Game prep checklist for <b>Friday vs Central Hawks</b> · 4 of 6 done.", meta: "Yesterday" },
        { id: "a5", kind: "note",           at: new Date(Date.now() - 60 * 3600e3).toISOString(), icon: "🎓", iconColor: "red",   content: "<b>TCU recruiter</b> opened <b>Jordan Kim</b>'s profile.", meta: "2d ago" },
      ]}
      spotlight={{
        playerId: "p1",
        handle: MOCK_SPOTLIGHT.handle,
        firstName: "Marcus",
        lastName: "Johnson",
        initials: MOCK_SPOTLIGHT.initials,
        jerseyNumber: 21,
        classYear: "Sr",
        positions: ["CF"],
        reason: MOCK_SPOTLIGHT.reason,
        stats: MOCK_SPOTLIGHT.stats,
      }}
      inboxThreads={[
        { threadId: "t1", viewerRole: "coach", kind: "dm", subject: "Noah — doctor's note", programId: null, recruiterId: null, targetPlayerId: null, outreachStatus: null, lastMessageAt: new Date(Date.now() - 2 * 3600e3).toISOString(), unreadCount: 1, muted: false, preview: "Hi coach — Noah's wrist needs another rest day. Doc says no BP til Wed…", lastSenderUserId: null, counterparty: { userId: null, displayName: "Anita Patel", subLabel: "Parent", avatarColor: "dirt" } },
        { threadId: "t2", viewerRole: "coach", kind: "dm", subject: "Tomorrow's infield time", programId: null, recruiterId: null, targetPlayerId: null, outreachStatus: null, lastMessageAt: new Date(Date.now() - 18 * 3600e3).toISOString(), unreadCount: 1, muted: false, preview: "Can we move infield time to 4:15 tomorrow?", lastSenderUserId: null, counterparty: { userId: null, displayName: "Coach Rivera (asst)", subLabel: "Assistant coach", avatarColor: "grass" } },
        { threadId: "t3", viewerRole: "coach", kind: "recruiter_outreach", subject: "Following up on Jordan Kim", programId: null, recruiterId: null, targetPlayerId: null, outreachStatus: "pending", lastMessageAt: new Date(Date.now() - 48 * 3600e3).toISOString(), unreadCount: 0, muted: false, preview: "Following up on Jordan Kim — could we set up a call this week?", lastSenderUserId: null, counterparty: { userId: null, displayName: "Recruiter · TCU", subLabel: "College recruiter", avatarColor: "sky" } },
      ]}
      record={{
        wins: 8,
        losses: 3,
        ties: 0,
        gamesCompleted: 11,
        runsFor: 64,
        runsAgainst: 38,
        byLevel: [
          { teamLevel: "Varsity", wins: 8, losses: 3, ties: 0, gamesCompleted: 11, runsFor: 64, runsAgainst: 38 },
        ],
      }}
    />
  );
}
