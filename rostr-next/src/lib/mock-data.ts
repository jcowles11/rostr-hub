/**
 * Mock data for the pre-data-layer UI build.
 * Shapes track the Prisma schema so swapping in real data later is trivial.
 */
import type { AvatarColor } from "@/components/atoms/avatar";

export type AvailabilityStatus = "ok" | "questionable" | "out";
export type RosterLevel = "V" | "JV" | "F";
export type ProfileStatus = "linked" | "pending" | "unlinked";

export interface MockPlayer {
  id: string;
  jerseyNumber: number;
  firstName: string;
  lastName: string;
  handle: string;
  initials: string;
  avatarColor: AvatarColor;
  classYear: string; // "'26 Sr", "'27 Jr", etc.
  classYearShort: string; // "Sr", "Jr"
  gradYear: number; // 2026
  positions: string[];
  level: RosterLevel;
  /** Full configured level name (e.g. "Varsity", "Sophomore"). */
  levelName?: string;
  ba?: string;
  era?: string;
  availabilityStatus: AvailabilityStatus;
  availabilityNote?: string;
  profileStatus: ProfileStatus;
  hot?: boolean; // fire emoji marker on Coach Hub
  stat?: string; // hub-only sparkle display
  statEmphasis?: "neutral" | "attention";
}

export const MOCK_TEAM = {
  name: "Lincoln HS",
  sport: "Baseball",
  level: "Varsity",
  season: "Spring '26",
  playerCount: 15,
};

export const MOCK_COACH = {
  name: "Coach Martinez",
  role: "Head Coach",
  initials: "CM",
};

/**
 * Demo team is a single Varsity squad — 15 players, the realistic
 * lower bound for a HS varsity baseball roster. JV/Freshman/Sophomore
 * teams aren't shown in the demo. Position mix follows a typical tight
 * 6A roster: 4 pitchers, 1 catcher (Tre), 7 infielders (incl. corner +
 * middle), 4 outfielders, 1 P/DH two-way. Class spread: 6 Sr / 6 Jr /
 * 3 So — peak production from the upperclassmen, sophomores still
 * developing.
 */
export const MOCK_PLAYERS: MockPlayer[] = [
  {
    id: "p1", jerseyNumber: 21, firstName: "Marcus", lastName: "Johnson",
    handle: "marcusjohnson21", initials: "MJ", avatarColor: "ink",
    classYear: "'26 Sr", classYearShort: "Sr", gradYear: 2026,
    positions: ["CF"], level: "V", ba: ".372",
    availabilityStatus: "ok", profileStatus: "linked", hot: true,
    stat: ".372 BA", statEmphasis: "neutral",
  },
  {
    id: "p2", jerseyNumber: 12, firstName: "Jordan", lastName: "Kim",
    handle: "jkim_ss12", initials: "JK", avatarColor: "sky",
    classYear: "'27 Jr", classYearShort: "Jr", gradYear: 2027,
    positions: ["SS"], level: "V", ba: ".318",
    availabilityStatus: "questionable", availabilityNote: "Hamstring Q",
    profileStatus: "linked",
    stat: "limited reps", statEmphasis: "attention",
  },
  {
    id: "p3", jerseyNumber: 7, firstName: "Alex", lastName: "Riggs",
    handle: "riggsbeats", initials: "AR", avatarColor: "dirt",
    classYear: "'26 Sr", classYearShort: "Sr", gradYear: 2026,
    positions: ["P", "1B"], level: "V", ba: ".295", era: "2.84",
    availabilityStatus: "ok", profileStatus: "linked",
    stat: "bullpen day", statEmphasis: "neutral",
  },
  {
    id: "p4", jerseyNumber: 33, firstName: "DeAndre", lastName: "Brooks",
    handle: "dbrooks_33", initials: "DB", avatarColor: "grass",
    classYear: "'27 Jr", classYearShort: "Jr", gradYear: 2027,
    positions: ["2B", "3B"], level: "V", ba: ".287",
    availabilityStatus: "out", availabilityNote: "Academic",
    profileStatus: "linked",
    stat: "tutoring until 4", statEmphasis: "attention",
  },
  {
    id: "p5", jerseyNumber: 44, firstName: "Tre", lastName: "Mbeki",
    handle: "tremb44", initials: "TM", avatarColor: "amber",
    classYear: "'28 So", classYearShort: "So", gradYear: 2028,
    positions: ["C"], level: "V", ba: ".254",
    availabilityStatus: "ok", profileStatus: "pending",
    stat: "full reps", statEmphasis: "neutral",
  },
  {
    id: "p6", jerseyNumber: 8, firstName: "Noah", lastName: "Patel",
    handle: "npatel_rf", initials: "NP", avatarColor: "red",
    classYear: "'26 Sr", classYearShort: "Sr", gradYear: 2026,
    positions: ["RF"], level: "V", ba: ".301",
    availabilityStatus: "questionable", availabilityNote: "Wrist tight",
    profileStatus: "linked",
    stat: "no BP", statEmphasis: "neutral",
  },
  {
    id: "p7", jerseyNumber: 27, firstName: "Sean", lastName: "Hale",
    handle: "seanhale27", initials: "SH", avatarColor: "ink2",
    classYear: "'27 Jr", classYearShort: "Jr", gradYear: 2027,
    positions: ["SS", "3B"], level: "V", ba: ".266",
    availabilityStatus: "ok", profileStatus: "linked",
    stat: "full reps", statEmphasis: "neutral",
  },
  {
    id: "p8", jerseyNumber: 15, firstName: "Ty", lastName: "Okafor",
    handle: "tyokafor15", initials: "TO", avatarColor: "gold",
    classYear: "'28 So", classYearShort: "So", gradYear: 2028,
    positions: ["P"], level: "V", era: "3.12",
    availabilityStatus: "ok", profileStatus: "linked",
  },
  {
    id: "p9", jerseyNumber: 5, firstName: "Omar", lastName: "Ruiz",
    handle: "omarruiz5", initials: "OR", avatarColor: "sky",
    classYear: "'27 Jr", classYearShort: "Jr", gradYear: 2027,
    positions: ["LF"], level: "V", ba: ".281",
    availabilityStatus: "ok", profileStatus: "pending",
  },
  {
    id: "p10", jerseyNumber: 23, firstName: "Kai", lastName: "Nakamura",
    handle: "knakamura23", initials: "KN", avatarColor: "ink",
    classYear: "'26 Sr", classYearShort: "Sr", gradYear: 2026,
    positions: ["P", "DH"], level: "V", ba: ".289", era: "3.14",
    availabilityStatus: "ok", profileStatus: "linked",
  },
  {
    id: "p11", jerseyNumber: 9, firstName: "Jaylen", lastName: "Carter",
    handle: "jcarter9", initials: "JC", avatarColor: "sky",
    classYear: "'27 Jr", classYearShort: "Jr", gradYear: 2027,
    positions: ["1B"], level: "V", ba: ".280",
    availabilityStatus: "ok", profileStatus: "linked",
  },
  {
    id: "p12", jerseyNumber: 16, firstName: "Mateo", lastName: "Vasquez",
    handle: "mvasquez16", initials: "MV", avatarColor: "dirt",
    classYear: "'26 Sr", classYearShort: "Sr", gradYear: 2026,
    positions: ["3B"], level: "V", ba: ".255",
    availabilityStatus: "ok", profileStatus: "linked",
  },
  {
    id: "p13", jerseyNumber: 14, firstName: "Ethan", lastName: "Murphy",
    handle: "emurphy14", initials: "EM", avatarColor: "grass",
    classYear: "'28 So", classYearShort: "So", gradYear: 2028,
    positions: ["SS"], level: "V", ba: ".248",
    availabilityStatus: "ok", profileStatus: "pending",
  },
  {
    id: "p14", jerseyNumber: 22, firstName: "Zayd", lastName: "Hassan",
    handle: "zhassan22", initials: "ZH", avatarColor: "red",
    classYear: "'27 Jr", classYearShort: "Jr", gradYear: 2027,
    positions: ["CF"], level: "V",
    availabilityStatus: "questionable", availabilityNote: "Knee bruised",
    profileStatus: "linked",
  },
  {
    id: "p15", jerseyNumber: 17, firstName: "Caleb", lastName: "Foster",
    handle: "cfoster17", initials: "CF", avatarColor: "ink2",
    classYear: "'28 So", classYearShort: "So", gradYear: 2028,
    positions: ["P"], level: "V", era: "4.21",
    availabilityStatus: "ok", profileStatus: "linked",
  },
];

export interface MockScheduleItem {
  date: { day: number; month: string };
  title: string;
  sub: string;
  tag: "PRAC" | "GAME" | "TRV";
  emphasis?: boolean;
}

// ── Dynamic week schedule ────────────────────────────────────────
// The demo's "this week" view always anchors on the current date so a
// prospect visiting on any day sees relevant context (today, the
// upcoming Friday game, this Saturday's road trip). Computed at render
// time from `new Date()` so the schedule never goes stale.

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"] as const;

/** Find the next Friday at or after `from`. */
function nextFriday(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const offset = (5 - d.getDay() + 7) % 7; // Fri = 5
  d.setDate(d.getDate() + offset);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * getMockWeek — six events anchored on the upcoming Friday game vs
 * Central Hawks (Senior Night). Mon–Thu are practice, Fri is the
 * highlighted home game, Sat is a road back-to-back at Westfield.
 *
 * Always returns a coherent week in the player's local timezone.
 */
export function getMockWeek(now: Date = new Date()): MockScheduleItem[] {
  const fri = nextFriday(now);
  const day = (offset: number) => {
    const d = addDays(fri, offset);
    return { day: d.getDate(), month: DOW[d.getDay()] };
  };
  return [
    { date: day(-4), title: "Practice · Situational hitting",       sub: "3:30 PM · Field A · 2h",      tag: "PRAC" },
    { date: day(-3), title: "Practice · Defense & baserunning",     sub: "3:30 PM · Field A · 2h",      tag: "PRAC" },
    { date: day(-2), title: "Practice · Bullpens + situational BP", sub: "3:30 PM · Field A · 2h",      tag: "PRAC" },
    { date: day(-1), title: "Light BP + pregame prep",              sub: "3:30 PM · Field A · 90 min",  tag: "PRAC" },
    { date: day(0),  title: "vs Central Hawks · Senior Night",      sub: "5:00 PM · Home · Bus: none",  tag: "GAME", emphasis: true },
    { date: day(1),  title: "@ Westfield Panthers",                 sub: "1:00 PM · Bus 11:15",         tag: "GAME" },
  ];
}

/** Pretty "Monday, April 27" for whatever today is. */
export function prettyToday(now: Date = new Date()): string {
  const fullDow = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return `${fullDow[now.getDay()]}, ${MONTHS_LONG[now.getMonth()]} ${now.getDate()}`;
}

/**
 * todayEventForDemo — pick the right "what's happening today" card to
 * surface on the demo's daily-standup page based on the day of week.
 *
 *   Mon–Thu → today's practice from getMockWeek()
 *   Fri     → Senior Night home game (today is game day)
 *   Sat     → road game @ Westfield
 *   Sun     → null (rest day)
 */
export function todayEventForDemo(now: Date = new Date()): MockScheduleItem | null {
  const week = getMockWeek(now);
  const dow = now.getDay();
  // week[0]..week[3] = Mon..Thu practices; week[4] = Fri game; week[5] = Sat game.
  const map: Record<number, number | null> = {
    0: null, // Sun
    1: 0,    // Mon practice
    2: 1,    // Tue practice
    3: 2,    // Wed practice
    4: 3,    // Thu light BP
    5: 4,    // Fri Senior Night
    6: 5,    // Sat road game
  };
  const idx = map[dow];
  return idx !== null && idx !== undefined ? week[idx] : null;
}

/**
 * Days-until label for a future date relative to today.
 * "Today", "Tomorrow", "in 3 days", "next Friday".
 */
export function daysUntilLabel(target: Date, now: Date = new Date()): string {
  const a = new Date(now); a.setHours(0,0,0,0);
  const b = new Date(target); b.setHours(0,0,0,0);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 6) return `in ${diff} days`;
  return target.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/** Backward-compat snapshot for any caller that still imports MOCK_WEEK directly. */
export const MOCK_WEEK: MockScheduleItem[] = getMockWeek();

// ── Dynamic schedule + games (for /demo/schedule, /demo/games) ───
// Both surfaces need to anchor on the upcoming Friday game so a
// prospect clicking from the Hub doesn't land on a "last week" view.

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * getMockScheduleEvents — 7-event week tuned for /demo/schedule.
 * Mon–Thu practices, Fri Senior Night, Sat road game, plus one
 * Tue-of-next-week game so the schedule extends past the weekend.
 */
export function getMockScheduleEvents(now: Date = new Date()): Array<{
  id: string;
  kind: "practice" | "game";
  date: { day: number; month: string; weekday: string };
  time: string;
  title: string;
  sub: string;
  emphasis?: boolean;
  href: string;
}> {
  const fri = nextFriday(now);
  const at = (offset: number) => {
    const d = addDays(fri, offset);
    return {
      day: d.getDate(),
      month: MONTH_SHORT[d.getMonth()],
      weekday: DOW[d.getDay()],
    };
  };
  return [
    { id: "p1", kind: "practice", date: at(-4), time: "3:30 PM", title: "Practice · Situational hitting", sub: "Field A · 2h · Coach Martinez",       href: "/demo/practice" },
    { id: "p2", kind: "practice", date: at(-3), time: "3:30 PM", title: "Practice · Defense & baserunning", sub: "Field A · 2h · Coach Rivera",        href: "/demo/practice" },
    { id: "p3", kind: "practice", date: at(-2), time: "3:30 PM", title: "Practice · Bullpens + situational BP", sub: "Field A · 2h · Coach Morales",   href: "/demo/practice" },
    { id: "p4", kind: "practice", date: at(-1), time: "3:30 PM", title: "Light BP + pregame prep",          sub: "Field A · 90 min · Coach Martinez",  href: "/demo/practice" },
    { id: "g1", kind: "game",     date: at(0),  time: "5:00 PM", title: "vs Central Hawks · Senior Night",  sub: "Home · ceremony 4:30 · Bus: none",   emphasis: true, href: "/demo/games" },
    { id: "g2", kind: "game",     date: at(1),  time: "1:00 PM", title: "@ Westfield Panthers",             sub: "Away · Bus 11:15 · Westfield HS",                    href: "/demo/games" },
    { id: "g3", kind: "game",     date: at(4),  time: "4:30 PM", title: "vs Eastside Eagles",                sub: "Home",                                                href: "/demo/games" },
  ];
}

/**
 * getMockGames — upcoming + recent games for /demo/games. Includes 4
 * upcoming (this Friday Senior Night, Saturday road, next Tuesday home,
 * next Friday road) and 3 finals from the prior weeks (matches the 8-3
 * record on the Hub stats tile).
 */
export function getMockGames(now: Date = new Date()): Array<{
  id: string;
  date: { day: number; month: string; year?: number };
  time: string;
  opponent: string;
  home: boolean;
  location: string;
  status: "upcoming" | "final" | "live" | "postponed";
  result?: { us: number; them: number };
  tag?: "conference" | "tournament" | "scrimmage";
}> {
  const fri = nextFriday(now);
  const fmt = (d: Date) => ({ day: d.getDate(), month: MONTH_SHORT[d.getMonth()] });
  return [
    // Upcoming
    { id: "g1", date: fmt(fri),                    time: "5:00 PM", opponent: "Central Hawks",       home: true,  location: "Lincoln HS · Main", status: "upcoming", tag: "conference" },
    { id: "g2", date: fmt(addDays(fri, 1)),        time: "1:00 PM", opponent: "Westfield Panthers",  home: false, location: "Westfield HS",      status: "upcoming", tag: "conference" },
    { id: "g3", date: fmt(addDays(fri, 4)),        time: "4:30 PM", opponent: "Eastside Eagles",     home: true,  location: "Lincoln HS · Main", status: "upcoming" },
    { id: "g4", date: fmt(addDays(fri, 7)),        time: "5:00 PM", opponent: "Ridgewood Prep",      home: false, location: "Ridgewood HS",      status: "upcoming", tag: "conference" },
    // Final — recent results that build the 8-3 record on the Hub stats tile.
    { id: "g5", date: fmt(addDays(fri, -4)),       time: "",        opponent: "Oakridge",            home: true,  location: "Lincoln HS · Main", status: "final", result: { us: 7, them: 4 } },
    { id: "g6", date: fmt(addDays(fri, -7)),       time: "",        opponent: "Meridian",            home: false, location: "Meridian HS",       status: "final", result: { us: 6, them: 3 }, tag: "conference" },
    { id: "g7", date: fmt(addDays(fri, -11)),      time: "",        opponent: "Sun Valley",          home: true,  location: "Lincoln HS · Main", status: "final", result: { us: 3, them: 5 }, tag: "conference" },
  ];
}

export interface MockFeedEntry {
  id: string;
  iconColor: "red" | "sky" | "grass" | "dirt" | "gold" | "amber" | "ink";
  iconInitials: string;
  body: React.ReactNode;
  meta: string;
}

export interface MockMessage {
  id: string;
  author: string;
  avatarColor: AvatarColor;
  initials: string;
  preview: string;
  time: string;
  unread: boolean;
}

// Inbox previews tied to actual roster state — Anita Patel (Noah's mom)
// is messaging because Noah's wrist is "questionable" in MOCK_PLAYERS;
// Coach Rivera's infield-time question lands the day before Tuesday
// practice. Author names + injuries cross-check with availability.
export const MOCK_MESSAGES: MockMessage[] = [
  { id: "m1", author: "Anita Patel", avatarColor: "dirt", initials: "AP", preview: "Hi coach — Noah's wrist needs another rest day. Doc says no BP til Wed…", time: "9:42 AM", unread: true },
  { id: "m2", author: "Team · Parents", avatarColor: "sky", initials: "P", preview: "You: Reminder, game Friday 5 PM home field — Senior Night ceremony at 4:30.", time: "Yesterday", unread: false },
  { id: "m3", author: "Coach Rivera (asst)", avatarColor: "grass", initials: "CR", preview: "Can we move infield time to 4:15? I've got…", time: "Yesterday", unread: true },
];

// Marcus Johnson — the team's standout senior CF — pulled from MOCK_PLAYERS
// + the per-player generators so the Hub spotlight matches his profile
// page exactly. Numbers: BA from his MOCK_PLAYERS.ba, EV / 60-yd from
// MOCK_MEASURABLES_BY_PLAYER (computed at module load).
export const MOCK_SPOTLIGHT = {
  initials: "MJ",
  name: "Marcus Johnson",
  handle: "marcusjohnson21",
  meta: "#21 · Sr · CF · .372 BA",
  reason:
    "Hitting streak active (7 games). Pulled in 5 college coach profile views this month from LSU, Oklahoma, and Sam Houston.",
  stats: [
    { value: "90", label: "EV max" },
    { value: "6.45", label: "60-yd" },
    { value: ".372", label: "BA" },
  ],
};

export const MOCK_AI_SUGGESTIONS = [
  { label: "Set Friday lineup vs Central", meta: "2 min" },
  { label: "Tue practice: who needs defensive reps?", meta: "30s" },
  { label: "Draft season mid-point progress email", meta: "90s" },
];

// ── Mock stats lines ─────────────────────────────────────────────
// Plausible per-player batting + pitching lines so the demo player
// profile + stats pages look "lived in". Numbers are deterministic
// (derived from each player's BA/ERA + position), not random — so the
// tour looks the same on every reload.

export interface MockBattingLine {
  playerId: string;
  programId: string;
  seasonYear: number;
  games: number;
  pa: number;
  ab: number;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  sac: number;
  rbi: number;
  ba: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface MockPitchingLine {
  playerId: string;
  programId: string;
  seasonYear: number;
  games: number;
  bf: number;
  outs: number;
  ip: number;
  h: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  r: number;
  er: number;
  era: number;
  whip: number;
  k9: number;
  bb9: number;
  kBB: number;
}

const MOCK_PROGRAM_ID = "demo-lincoln-hs";
const MOCK_SEASON_YEAR = 2026;

function isPitcher(p: MockPlayer): boolean {
  return p.positions.some((pos) => pos === "P");
}

function isPositionPlayer(p: MockPlayer): boolean {
  // Pitcher-only players don't get batting stats. Two-way (P+1B,
  // P+DH) do.
  return !p.positions.every((pos) => pos === "P");
}

/**
 * battingFor — generate a plausible batting line for a position player
 * using their listed BA as the anchor. Other rates (OBP, SLG, OPS)
 * derive from realistic ratios so leaderboards order reasonably.
 *
 * Deterministic — same inputs → same outputs every render.
 */
export function battingFor(p: MockPlayer): MockBattingLine | null {
  if (!isPositionPlayer(p)) return null;
  const ba = p.ba ? parseFloat(p.ba) : 0.27;
  // 22-game season anchor; vary by class year so seniors look more
  // worn-in than sophomores.
  const games = p.classYearShort === "Sr" ? 24 : p.classYearShort === "Jr" ? 22 : 20;
  const ab = Math.round(games * 3.6); // ~3.6 AB per game
  const h = Math.round(ab * ba);
  // Power scales with BA + a position bump for corner/OF spots.
  const isPower = p.positions.some((pos) => ["1B", "3B", "LF", "RF", "DH"].includes(pos));
  const hr = Math.max(0, Math.round((ba - 0.22) * 30) + (isPower ? 2 : 0));
  const triples = Math.max(0, Math.round((ba - 0.25) * 10));
  const doubles = Math.max(0, Math.round(h * 0.22));
  const singles = Math.max(0, h - doubles - triples - hr);
  const bb = Math.round(ab * 0.11);
  const hbp = Math.max(0, Math.round(games * 0.12));
  const k = Math.round(ab * 0.18);
  const sac = Math.max(0, Math.round(games * 0.08));
  const pa = ab + bb + hbp + sac;
  const rbi = Math.round(h * 0.45 + hr * 1.4);
  const tb = singles + doubles * 2 + triples * 3 + hr * 4;
  const obp = pa > 0 ? (h + bb + hbp) / pa : 0;
  const slg = ab > 0 ? tb / ab : 0;
  const ops = obp + slg;
  return {
    playerId: p.id,
    programId: MOCK_PROGRAM_ID,
    seasonYear: MOCK_SEASON_YEAR,
    games,
    pa,
    ab,
    h,
    singles,
    doubles,
    triples,
    hr,
    bb,
    hbp,
    k,
    sac,
    rbi,
    ba,
    obp,
    slg,
    ops,
  };
}

/**
 * pitchingFor — plausible pitching line for any player listed at P.
 * ERA anchors the line; everything else (IP, K/9, WHIP) derives from
 * usage tier (starter vs reliever based on ERA + class year).
 */
export function pitchingFor(p: MockPlayer): MockPitchingLine | null {
  if (!isPitcher(p)) return null;
  const era = p.era ? parseFloat(p.era) : 3.85;
  // Lower ERA + senior = workhorse starter (more IP). Higher ERA +
  // sophomore = bullpen depth.
  const isStarter = era < 3.5 && p.classYearShort !== "So";
  const games = isStarter ? 9 : 14;
  const ip = isStarter ? 52 : 24;
  const outs = Math.round(ip * 3);
  const k9 = isStarter ? 9.4 : 7.8;
  const k = Math.round((k9 * ip) / 9);
  const bb9 = era < 3.0 ? 2.4 : era < 4.0 ? 3.1 : 4.0;
  const bb = Math.round((bb9 * ip) / 9);
  const hbp = Math.max(0, Math.round(games * 0.4));
  const baa = era < 3.0 ? 0.21 : era < 4.0 ? 0.245 : 0.275;
  const bf = Math.round(ip * 4.2);
  const h = Math.round(bf * baa);
  const hr = Math.max(0, Math.round(ip * 0.08));
  const er = Math.round((era * ip) / 9);
  const r = er + Math.max(0, Math.round(games * 0.2));
  const whip = ip > 0 ? (bb + h) / ip : 0;
  const kBB = bb > 0 ? k / bb : k;
  return {
    playerId: p.id,
    programId: MOCK_PROGRAM_ID,
    seasonYear: MOCK_SEASON_YEAR,
    games,
    bf,
    outs,
    ip,
    h,
    hr,
    bb,
    hbp,
    k,
    r,
    er,
    era,
    whip,
    k9,
    bb9,
    kBB,
  };
}

/**
 * Pre-computed maps so consumers don't recompute on every render.
 * Coaches viewing the demo see populated stat cards on every player
 * profile + populated leaderboards on /demo/stats.
 */
export const MOCK_BATTING_BY_PLAYER: Record<string, MockBattingLine> = Object.fromEntries(
  MOCK_PLAYERS.map((p) => [p.id, battingFor(p)]).filter(([, line]) => line !== null) as Array<
    [string, MockBattingLine]
  >,
);

export const MOCK_PITCHING_BY_PLAYER: Record<string, MockPitchingLine> = Object.fromEntries(
  MOCK_PLAYERS.map((p) => [p.id, pitchingFor(p)]).filter(([, line]) => line !== null) as Array<
    [string, MockPitchingLine]
  >,
);

export const MOCK_BATTING_LEADERS: MockBattingLine[] = Object.values(MOCK_BATTING_BY_PLAYER)
  .filter((l) => l.games >= 10)
  .sort((a, b) => b.ops - a.ops);

export const MOCK_PITCHING_LEADERS: MockPitchingLine[] = Object.values(MOCK_PITCHING_BY_PLAYER)
  .filter((l) => l.games >= 1)
  .sort((a, b) => a.era - b.era);

// ── Mock measurables (combine + bio) ─────────────────────────────
// Position-appropriate tryout-station results so the Combine card on
// every demo player profile shows different, realistic numbers (not
// all "94 mph EV / 6.74 60-yd" like before). Pitchers get FB velo +
// pickoff, catchers get pop time, infielders get IF velo + home-to-1B,
// outfielders get OF velo. Bio (height/weight/bats/throws) is also
// per-player so two players never look identical.
//
// Quality is anchored to BA (for hitters), ERA (for pitchers), and
// class year (seniors > juniors > sophs) plus a small per-player jitter
// from the player ID so equivalents don't all share identical numbers.

/**
 * Mirrors `PlayerMeasurable` from /lib/services/tryouts.ts so the
 * profile page can consume mock + real measurables through the same
 * pipeline. We don't import the type here to avoid pulling Supabase
 * types into a leaf module.
 */
export interface MockMeasurable {
  shortCode: string;
  stationName: string;
  unit: string | null;
  bestValue: number;
  scoreType: "lower_better" | "higher_better" | "rating";
  latestAt: string | null;
  verifiedByCoachName: string | null;
}

export interface MockBio {
  height: string;
  weight: number; // lbs
  bats: "L" | "R" | "S";
  throws: "L" | "R";
}

/** Stable hash of a string → integer in [0, 1) for jitter. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const VERIFIERS = ["Coach Martinez", "Coach Rivera", "Coach Morales"];
const ISO_VERIFIED = "2026-03-18";

function classBoost(p: MockPlayer): number {
  return p.classYearShort === "Sr" ? 1.0 : p.classYearShort === "Jr" ? 0.5 : 0.0;
}

function bioFor(p: MockPlayer): MockBio {
  const j = hash01(p.id);
  // Height: 5'9" to 6'4" — pitchers and OF skew taller, catchers shorter.
  let inches = 70; // baseline 5'10"
  const isP = p.positions.includes("P");
  const isC = p.positions.includes("C");
  const isOF = p.positions.some((pos) => ["CF", "LF", "RF"].includes(pos));
  if (isP || isOF) inches += 2;
  if (isC) inches -= 1;
  inches += Math.round(j * 4) - 1; // ±2 inches jitter
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  // Weight: scales with height, varies by position.
  let weight = 165 + (inches - 70) * 6;
  if (isP) weight += 5;
  if (isC) weight += 8;
  weight += Math.round(j * 16) - 8; // ±8 lbs jitter

  // ── Bats / throws — realistic with position constraints ────────
  // Hard rule: catchers + middle infielders + 3B always throw right.
  // Lefty catchers / lefty SS effectively don't exist at any competitive
  // level (a lefty C can't throw to 3B over a R-handed hitter without
  // stepping into the box; a lefty SS/2B/3B can't pivot in time for the
  // throw to first). Lefties cluster at 1B, OF, and on the mound.
  const throwsRightOnly =
    isC ||
    p.positions.some((pos) => ["SS", "2B", "3B"].includes(pos));

  const jt = hash01(p.id + "throws");
  const jb = hash01(p.id + "bats");

  // ~28% of HS varsity players throw left when not position-constrained.
  const throws: "L" | "R" =
    !throwsRightOnly && jt < 0.28 ? "L" : "R";

  // Bats: ~10% switch-hitters, then split L/R conditional on throws.
  // Lefty throwers almost always bat lefty (~90%). Right-handed
  // throwers bat L ~30% of the time (the classic lefty-hitter /
  // righty-thrower combo, common in OF + 1B). Catchers skew R-bat
  // slightly more than the rest of the field.
  let bats: "L" | "R" | "S";
  if (jb < 0.10) {
    bats = "S";
  } else {
    const adjusted = (jb - 0.10) / 0.90; // re-normalize to [0, 1)
    const lBatChance =
      throws === "L" ? 0.90
      : isC ? 0.18
      : 0.32;
    bats = adjusted < lBatChance ? "L" : "R";
  }

  return {
    height: `${ft}'${inch}"`,
    weight: Math.round(weight),
    bats,
    throws,
  };
}

/**
 * measurablesFor — position-appropriate mock combine results.
 * Returns the shape `PlayerMeasurable[]` expects so the existing
 * Combine card on /p/[handle] consumes them without changes.
 */
export function measurablesFor(p: MockPlayer): MockMeasurable[] {
  const j = hash01(p.id);
  const j2 = hash01(p.id + "x");
  const cb = classBoost(p);
  const verifier = VERIFIERS[Math.floor(j * VERIFIERS.length) % VERIFIERS.length];

  const isP = p.positions.includes("P");
  const isPitcherOnly = p.positions.every((pos) => pos === "P");
  const isC = p.positions.includes("C");
  const isInfield = p.positions.some((pos) => ["SS", "2B", "3B", "1B"].includes(pos));
  const isOutfield = p.positions.some((pos) => ["CF", "LF", "RF"].includes(pos));
  const isPositionPlayer = !isPitcherOnly;

  const hitterTier = p.ba ? parseFloat(p.ba) : 0.27;
  const pitcherTier = p.era ? parseFloat(p.era) : 4.0;

  const out: MockMeasurable[] = [];

  // 60-yard dash (everyone). Better hitters + outfielders run faster.
  // Range 6.45 (elite) to 7.45 (slow).
  let sixty = 7.10 - cb * 0.25;
  if (isOutfield) sixty -= 0.18;
  sixty += hitterTier > 0 ? (0.27 - hitterTier) * 1.4 : 0;
  sixty += (j - 0.5) * 0.35;
  out.push({
    shortCode: "60YD",
    stationName: "60-yard dash",
    unit: "s",
    bestValue: round2(clamp(sixty, 6.45, 7.45)),
    scoreType: "lower_better",
    latestAt: ISO_VERIFIED,
    verifiedByCoachName: verifier,
  });

  // Exit velocity (every position player). Range 72 (low) to 96 (D1).
  if (isPositionPlayer) {
    let ev = 78 + cb * 6;
    ev += hitterTier > 0 ? (hitterTier - 0.27) * 60 : 0;
    if (isOutfield || p.positions.some((pos) => ["1B", "3B"].includes(pos))) ev += 2;
    ev += (j2 - 0.5) * 6;
    out.push({
      shortCode: "EV",
      stationName: "Exit velocity",
      unit: "mph",
      bestValue: Math.round(clamp(ev, 72, 96)),
      scoreType: "higher_better",
      latestAt: ISO_VERIFIED,
      verifiedByCoachName: verifier,
    });
  }

  // Home-to-1B (position players, faster runners). Range 4.0 (elite) to 4.7.
  if (isPositionPlayer) {
    let h1b = 4.45 - cb * 0.12;
    if (isOutfield) h1b -= 0.10;
    h1b += hitterTier > 0 ? (0.27 - hitterTier) * 0.9 : 0;
    h1b += (j - 0.5) * 0.25;
    out.push({
      shortCode: "H1B",
      stationName: "Home to 1B",
      unit: "s",
      bestValue: round2(clamp(h1b, 3.95, 4.75)),
      scoreType: "lower_better",
      latestAt: ISO_VERIFIED,
      verifiedByCoachName: verifier,
    });
  }

  // Pop time (catchers only). Range 1.85 (elite) to 2.30.
  if (isC) {
    const pop = 2.10 - cb * 0.08 + (j - 0.5) * 0.2;
    out.push({
      shortCode: "POP",
      stationName: "Pop time to 2B",
      unit: "s",
      bestValue: round2(clamp(pop, 1.85, 2.30)),
      scoreType: "lower_better",
      latestAt: ISO_VERIFIED,
      verifiedByCoachName: verifier,
    });
  }

  // Infield velocity (across diamond). Range 72 to 90.
  if (isInfield && !isC) {
    const ifv = 78 + cb * 4 + (j2 - 0.5) * 8;
    out.push({
      shortCode: "IFV",
      stationName: "Infield velocity",
      unit: "mph",
      bestValue: Math.round(clamp(ifv, 72, 90)),
      scoreType: "higher_better",
      latestAt: ISO_VERIFIED,
      verifiedByCoachName: verifier,
    });
  }

  // Outfield velocity. Range 78 to 95.
  if (isOutfield) {
    const ofv = 84 + cb * 5 + (j2 - 0.5) * 8;
    out.push({
      shortCode: "OFV",
      stationName: "Outfield velocity",
      unit: "mph",
      bestValue: Math.round(clamp(ofv, 78, 95)),
      scoreType: "higher_better",
      latestAt: ISO_VERIFIED,
      verifiedByCoachName: verifier,
    });
  }

  // Fastball velocity (any P). Range 76 to 92.
  if (isP) {
    let fb = 84 + cb * 4 - (pitcherTier - 3.5) * 1.6;
    fb += (j2 - 0.5) * 4;
    out.push({
      shortCode: "FBV",
      stationName: "Fastball velocity",
      unit: "mph",
      bestValue: Math.round(clamp(fb, 76, 92)),
      scoreType: "higher_better",
      latestAt: ISO_VERIFIED,
      verifiedByCoachName: verifier,
    });
  }

  // Vert jump (everyone). Range 22 to 32.
  const vert = 26 + cb * 2 + (j - 0.5) * 6;
  out.push({
    shortCode: "VJ",
    stationName: "Vert jump",
    unit: "in",
    bestValue: Math.round(clamp(vert, 22, 32)),
    scoreType: "higher_better",
    latestAt: ISO_VERIFIED,
    verifiedByCoachName: verifier,
  });

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export const MOCK_BIO_BY_PLAYER: Record<string, MockBio> = Object.fromEntries(
  MOCK_PLAYERS.map((p) => [p.id, bioFor(p)]),
);

export const MOCK_MEASURABLES_BY_PLAYER: Record<string, MockMeasurable[]> = Object.fromEntries(
  MOCK_PLAYERS.map((p) => [p.id, measurablesFor(p)]),
);

// ── Mock recruiting interest ─────────────────────────────────────
// Per-player school list + scout view counts so every demo profile
// shows a different "Recruiting interest" sidebar card. Stronger
// players (high BA / low ERA / senior) get more views from bigger
// programs; underclassmen with quieter numbers get a thinner board
// (juniors trickling in from in-state, sophomores still under the radar).

export interface MockRecruitingSchool {
  initials: string;
  color: "sky" | "grass" | "amber" | "dirt" | "red" | "ink";
  name: string;
  meta: string;
  interested?: boolean;
}

export interface MockRecruiting {
  viewsLast30: number;
  schools: MockRecruitingSchool[];
}

const SCHOOL_POOL: Array<{
  initials: string;
  color: MockRecruitingSchool["color"];
  name: string;
  tier: number; // 1 = power D1, 2 = mid-major, 3 = D2/JUCO
}> = [
  { initials: "TX", color: "sky", name: "Texas", tier: 1 },
  { initials: "AR", color: "dirt", name: "Arkansas", tier: 1 },
  { initials: "LSU", color: "amber", name: "LSU", tier: 1 },
  { initials: "OU", color: "amber", name: "Oklahoma", tier: 1 },
  { initials: "VU", color: "ink", name: "Vanderbilt", tier: 1 },
  { initials: "BU", color: "grass", name: "Baylor", tier: 1 },
  { initials: "TCU", color: "sky", name: "TCU", tier: 1 },
  { initials: "TT", color: "red", name: "Texas Tech", tier: 1 },
  { initials: "SHSU", color: "amber", name: "Sam Houston", tier: 2 },
  { initials: "UTA", color: "sky", name: "UT Arlington", tier: 2 },
  { initials: "UTSA", color: "ink", name: "UTSA", tier: 2 },
  { initials: "TXST", color: "sky", name: "Texas State", tier: 2 },
  { initials: "DBU", color: "red", name: "Dallas Baptist", tier: 2 },
  { initials: "ACU", color: "amber", name: "Abilene Christian", tier: 2 },
  { initials: "NTC", color: "grass", name: "North Texas CC", tier: 3 },
  { initials: "HC", color: "dirt", name: "Hill College", tier: 3 },
  { initials: "GC", color: "amber", name: "Galveston CC", tier: 3 },
];

/** Player "buzz" score — used to pick how many + how high-tier of schools follow. */
function buzzFor(p: MockPlayer): number {
  const ba = p.ba ? parseFloat(p.ba) : 0;
  const era = p.era ? parseFloat(p.era) : 99;
  const cb = classBoost(p);
  // BA contribution maxes out around 0.4 → +1.5 buzz
  // ERA contribution maxes when ERA<2.5 → +1.5 buzz, fades over 4.0.
  const baBuzz = ba > 0 ? Math.max(0, (ba - 0.25) * 12) : 0;
  const eraBuzz = era < 99 ? Math.max(0, 4.5 - era) * 0.6 : 0;
  return baBuzz + eraBuzz + cb;
}

function recruitingFor(p: MockPlayer): MockRecruiting {
  const j = hash01(p.id);
  const j2 = hash01(p.id + "r");
  const buzz = buzzFor(p);
  // Sophomores barely get tracked (0–2 schools), juniors mid (2–4),
  // seniors with real production crack the top tier (4–6).
  const baseSchools = p.classYearShort === "Sr" ? 4 : p.classYearShort === "Jr" ? 2 : 1;
  const schoolCount = Math.min(6, baseSchools + Math.round(buzz * 0.6));
  // Tier mix: high-buzz players see more tier-1, low-buzz see tier 2/3.
  const wantedTiers = buildTierBag(buzz, schoolCount);
  // Pick schools: rotate through the pool starting at a player-stable offset.
  const offset = Math.floor(j * SCHOOL_POOL.length);
  const pool = [...SCHOOL_POOL.slice(offset), ...SCHOOL_POOL.slice(0, offset)];
  const picked: MockRecruitingSchool[] = [];
  for (const tier of wantedTiers) {
    const next = pool.find(
      (s) => s.tier === tier && !picked.some((p) => p.initials === s.initials),
    );
    if (!next) continue;
    const daysAgo = 2 + Math.floor((picked.length + j2) * 6);
    const isFirst = picked.length === 0;
    picked.push({
      initials: next.initials,
      color: next.color,
      name: next.name,
      meta: isFirst && buzz > 2 ? `saved · ${daysAgo}d ago` : `viewed · ${daysAgo}d ago`,
      interested: isFirst && buzz > 2,
    });
  }
  // Views: scale with buzz. Low-buzz players still get a couple from
  // routine recruiter sweeps; high-buzz players get serious traffic.
  const viewsLast30 = Math.max(
    1,
    Math.round(2 + buzz * 4 + j * 3),
  );
  return { viewsLast30, schools: picked };
}

/** Pick a tier bag (e.g. [1, 1, 2, 2, 3]) sized to schoolCount, weighted by buzz. */
function buildTierBag(buzz: number, n: number): number[] {
  const bag: number[] = [];
  // Weight: buzz 0 → mostly tier 3; buzz 4+ → mostly tier 1.
  const t1Weight = Math.min(0.7, buzz * 0.18);
  const t2Weight = 0.4 + Math.min(0.2, buzz * 0.05);
  for (let i = 0; i < n; i++) {
    const r = (i + 0.5) / n; // deterministic spread
    if (r < t1Weight) bag.push(1);
    else if (r < t1Weight + t2Weight) bag.push(2);
    else bag.push(3);
  }
  return bag;
}

export const MOCK_RECRUITING_BY_PLAYER: Record<string, MockRecruiting> = Object.fromEntries(
  MOCK_PLAYERS.map((p) => [p.id, recruitingFor(p)]),
);

// ── Mock academics ───────────────────────────────────────────────
// Per-player GPA / SAT / class rank / major / target division so the
// Academic sidebar card on every demo profile reads like a real
// student's transcript instead of a duplicate placeholder.

export interface MockAcademic {
  gpa: string; // "3.78" — formatted
  sat: number;
  classRank: string; // "32 / 412"
  major: string;
  targetDiv: string; // "D1 / D2"
}

const MAJORS = [
  "Business",
  "Kinesiology",
  "Communications",
  "Economics",
  "Sports management",
  "Mechanical engineering",
  "Computer science",
  "Marketing",
  "Sociology",
  "Education",
];

function academicFor(p: MockPlayer): MockAcademic {
  const j = hash01(p.id + "ac");
  const j2 = hash01(p.id + "sat");
  const j3 = hash01(p.id + "maj");
  const buzz = buzzFor(p);

  // GPA: roughly 3.0 to 4.0, gently tilted up by buzz (better players
  // tend to be locked-in students too — narratively cleaner for the
  // demo than random uncoupling). Range strictly 2.6 – 4.0.
  const gpaNum = clamp(3.05 + buzz * 0.10 + (j - 0.5) * 0.85, 2.60, 4.00);
  const gpa = gpaNum.toFixed(2);

  // SAT: 1080 – 1480, loosely correlated with GPA.
  const sat = Math.round(clamp(1100 + (gpaNum - 3.0) * 220 + (j2 - 0.5) * 160, 1080, 1480));

  // Class rank: derived from GPA (higher GPA → lower rank). Total
  // class size kept at 412 to match a typical 6A Texas school size.
  const total = 412;
  const rank = Math.max(1, Math.round(total * (1 - (gpaNum - 2.6) / 1.4) * 0.95));
  const classRank = `${rank} / ${total}`;

  const major = MAJORS[Math.floor(j3 * MAJORS.length) % MAJORS.length];

  // Target division: scales with buzz and class year (seniors with
  // production target D1; sophs without numbers stay open-ended).
  const targetDiv =
    buzz >= 3.5 ? "D1"
    : buzz >= 2.0 ? "D1 / D2"
    : buzz >= 1.0 ? "D2 / D3"
    : "D3 / JUCO";

  return { gpa, sat, classRank, major, targetDiv };
}

export const MOCK_ACADEMIC_BY_PLAYER: Record<string, MockAcademic> = Object.fromEntries(
  MOCK_PLAYERS.map((p) => [p.id, academicFor(p)]),
);
