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
  playerCount: 22,
};

export const MOCK_COACH = {
  name: "Coach Martinez",
  role: "Head Coach",
  initials: "CM",
};

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
    id: "p10", jerseyNumber: 3, firstName: "Cal", lastName: "Washington",
    handle: "calw_jv", initials: "CW", avatarColor: "dirt",
    classYear: "'28 So", classYearShort: "So", gradYear: 2028,
    positions: ["2B"], level: "JV", ba: ".298",
    availabilityStatus: "ok", profileStatus: "linked",
  },
  {
    id: "p11", jerseyNumber: 19, firstName: "Henry", lastName: "Park",
    handle: "hpark19", initials: "HP", avatarColor: "grass",
    classYear: "'28 So", classYearShort: "So", gradYear: 2028,
    positions: ["P", "OF"], level: "JV", era: "3.78",
    availabilityStatus: "ok", profileStatus: "unlinked",
  },
  {
    id: "p12", jerseyNumber: 11, firstName: "Diego", lastName: "Alvarez",
    handle: "dalvarez_c", initials: "DA", avatarColor: "amber",
    classYear: "'29 Fr", classYearShort: "Fr", gradYear: 2029,
    positions: ["C"], level: "F",
    availabilityStatus: "ok", profileStatus: "pending",
  },
];

export interface MockScheduleItem {
  date: { day: number; month: string };
  title: string;
  sub: string;
  tag: "PRAC" | "GAME" | "TRV";
  emphasis?: boolean;
}

export const MOCK_WEEK: MockScheduleItem[] = [
  { date: { day: 21, month: "Tue" }, title: "Practice · Situational hitting", sub: "3:30 PM · Field A · 2h", tag: "PRAC" },
  { date: { day: 22, month: "Wed" }, title: "Practice · Defense & baserunning", sub: "3:30 PM · Field A · 2h", tag: "PRAC" },
  { date: { day: 23, month: "Thu" }, title: "Light BP + pregame prep", sub: "3:30 PM · Field A · 90 min", tag: "PRAC" },
  { date: { day: 24, month: "Fri" }, title: "vs Central Hawks · conference", sub: "5:00 PM · Home · Bus: none", tag: "GAME", emphasis: true },
  { date: { day: 25, month: "Sat" }, title: "@ Westfield Panthers", sub: "1:00 PM · Bus 11:15", tag: "GAME" },
];

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

export const MOCK_MESSAGES: MockMessage[] = [
  { id: "m1", author: "Ellen Johnson", avatarColor: "dirt", initials: "EJ", preview: "Hi coach — Marcus has a doctor's note for…", time: "9:42 AM", unread: true },
  { id: "m2", author: "Team · Parents", avatarColor: "sky", initials: "P", preview: "You: Reminder, game Friday 5 PM home field.", time: "Yesterday", unread: false },
  { id: "m3", author: "Coach Rivera (asst)", avatarColor: "grass", initials: "CR", preview: "Can we move infield time to 4:15? I've got…", time: "Yesterday", unread: true },
];

export const MOCK_SPOTLIGHT = {
  initials: "JK",
  name: "Jordan Kim",
  meta: "#12 · Jr · SS · .341 BA · Committed: ND",
  reason:
    "3 scout profile views this week (Arizona, Stanford, Vandy). Hitting trajectory up 4 mph exit velo YoY.",
  stats: [
    { value: "92", label: "EV max" },
    { value: "6.71", label: "60-yd" },
    { value: ".341", label: "BA" },
  ],
};

export const MOCK_AI_SUGGESTIONS = [
  { label: "Set Friday lineup vs Central", meta: "2 min" },
  { label: "Tue practice: who needs defensive reps?", meta: "30s" },
  { label: "Draft season mid-point progress email", meta: "90s" },
];
