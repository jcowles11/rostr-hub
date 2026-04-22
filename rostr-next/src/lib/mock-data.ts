/**
 * Mock data for the pre-data-layer UI build.
 * Shapes track the Prisma schema so swapping in real data later is trivial.
 */
import type { AvatarColor } from "@/components/atoms/avatar";

export type AvailabilityStatus = "ok" | "questionable" | "out";

export interface MockPlayer {
  id: string;
  jerseyNumber: number;
  firstName: string;
  lastName: string;
  initials: string;
  avatarColor: AvatarColor;
  classYear: string; // "Sr", "Jr", etc.
  positions: string[];
  availabilityStatus: AvailabilityStatus;
  availabilityNote?: string;
  stat?: string; // sparkle display stat e.g. ".372 BA"
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
    id: "p1",
    jerseyNumber: 21,
    firstName: "Marcus",
    lastName: "Johnson",
    initials: "MJ",
    avatarColor: "ink",
    classYear: "Sr",
    positions: ["CF"],
    availabilityStatus: "ok",
    stat: ".372 BA",
    statEmphasis: "neutral",
  },
  {
    id: "p2",
    jerseyNumber: 12,
    firstName: "Jordan",
    lastName: "Kim",
    initials: "JK",
    avatarColor: "sky",
    classYear: "Jr",
    positions: ["SS"],
    availabilityStatus: "questionable",
    availabilityNote: "Hamstring Q",
    stat: "limited reps",
    statEmphasis: "attention",
  },
  {
    id: "p3",
    jerseyNumber: 7,
    firstName: "Alex",
    lastName: "Riggs",
    initials: "AR",
    avatarColor: "dirt",
    classYear: "Sr",
    positions: ["P", "1B"],
    availabilityStatus: "ok",
    stat: "bullpen day",
    statEmphasis: "neutral",
  },
  {
    id: "p4",
    jerseyNumber: 33,
    firstName: "DeAndre",
    lastName: "Brooks",
    initials: "DB",
    avatarColor: "grass",
    classYear: "Jr",
    positions: ["2B", "3B"],
    availabilityStatus: "out",
    availabilityNote: "Academic",
    stat: "tutoring until 4",
    statEmphasis: "attention",
  },
  {
    id: "p5",
    jerseyNumber: 44,
    firstName: "Tre",
    lastName: "Mbeki",
    initials: "TM",
    avatarColor: "amber",
    classYear: "So",
    positions: ["C"],
    availabilityStatus: "ok",
    stat: "full reps",
    statEmphasis: "neutral",
  },
  {
    id: "p6",
    jerseyNumber: 8,
    firstName: "Noah",
    lastName: "Patel",
    initials: "NP",
    avatarColor: "red",
    classYear: "Sr",
    positions: ["RF"],
    availabilityStatus: "questionable",
    availabilityNote: "Wrist tight",
    stat: "no BP",
    statEmphasis: "neutral",
  },
  {
    id: "p7",
    jerseyNumber: 27,
    firstName: "Sean",
    lastName: "Hale",
    initials: "SH",
    avatarColor: "ink2",
    classYear: "Jr",
    positions: ["SS", "3B"],
    availabilityStatus: "ok",
    stat: "full reps",
    statEmphasis: "neutral",
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
