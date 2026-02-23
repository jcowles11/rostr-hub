export interface SportConfig {
  id: string;
  label: string;
  emoji: string;
  categories: string[];
  positions: string[];
  hasBatsThrows?: boolean;
  defaultMetrics: {
    name: string;
    unit: string;
    category: string;
    metric_type: "timed" | "measured" | "rated";
    sort_order: number;
    min_value?: number;
    max_value?: number;
  }[];
  placeholderProgramName: string;
}

export const SPORTS: SportConfig[] = [
  {
    id: "baseball",
    label: "Baseball / Softball",
    emoji: "⚾",
    categories: ["running", "hitting", "fielding", "pitching", "other"],
    positions: ["RHP", "LHP", "C", "1B", "2B", "SS", "3B", "RF", "CF", "LF", "DH", "IF", "OF", "UT"],
    hasBatsThrows: true,
    defaultMetrics: [
      { name: "60-Yard Dash", unit: "sec", category: "running", metric_type: "timed", sort_order: 1 },
      { name: "Home to First", unit: "sec", category: "running", metric_type: "timed", sort_order: 2 },
      { name: "Exit Velocity", unit: "mph", category: "hitting", metric_type: "measured", sort_order: 3 },
      { name: "Arm Velocity (IF)", unit: "mph", category: "fielding", metric_type: "measured", sort_order: 4 },
      { name: "Arm Velocity (OF)", unit: "mph", category: "fielding", metric_type: "measured", sort_order: 5 },
      { name: "Arm Velocity (C)", unit: "mph", category: "fielding", metric_type: "measured", sort_order: 6 },
      { name: "Fastball Velo", unit: "mph", category: "pitching", metric_type: "measured", sort_order: 7 },
      { name: "Fielding", unit: "20-80", category: "fielding", metric_type: "rated", min_value: 20, max_value: 80, sort_order: 8 },
      { name: "Hitting", unit: "20-80", category: "hitting", metric_type: "rated", min_value: 20, max_value: 80, sort_order: 9 },
      { name: "Hustle/Attitude", unit: "20-80", category: "other", metric_type: "rated", min_value: 20, max_value: 80, sort_order: 10 },
    ],
    placeholderProgramName: "Eagles Baseball",
  },
  {
    id: "football",
    label: "Football",
    emoji: "🏈",
    categories: ["speed", "strength", "offense", "defense", "special_teams", "other"],
    positions: ["QB", "RB", "WR", "TE", "OL", "OT", "OG", "C", "DE", "DT", "LB", "CB", "S", "K", "P", "KR", "PR", "ATH"],
    defaultMetrics: [
      { name: "40-Yard Dash", unit: "sec", category: "speed", metric_type: "timed", sort_order: 1 },
      { name: "Pro Shuttle (5-10-5)", unit: "sec", category: "speed", metric_type: "timed", sort_order: 2 },
      { name: "Vertical Jump", unit: "in", category: "strength", metric_type: "measured", sort_order: 3 },
      { name: "Broad Jump", unit: "in", category: "strength", metric_type: "measured", sort_order: 4 },
      { name: "Bench Press Reps (185 lbs)", unit: "reps", category: "strength", metric_type: "measured", sort_order: 5 },
      { name: "Positional Skills", unit: "1-10", category: "offense", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 6 },
      { name: "Football IQ", unit: "1-10", category: "other", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 7 },
      { name: "Coachability", unit: "1-10", category: "other", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 8 },
    ],
    placeholderProgramName: "Eagles Football",
  },
  {
    id: "basketball",
    label: "Basketball",
    emoji: "🏀",
    categories: ["speed", "shooting", "skills", "athleticism", "other"],
    positions: ["PG", "SG", "SF", "PF", "C", "G", "F", "G/F"],
    defaultMetrics: [
      { name: "Lane Agility", unit: "sec", category: "speed", metric_type: "timed", sort_order: 1 },
      { name: "3/4 Court Sprint", unit: "sec", category: "speed", metric_type: "timed", sort_order: 2 },
      { name: "Vertical Jump", unit: "in", category: "athleticism", metric_type: "measured", sort_order: 3 },
      { name: "Shooting Form", unit: "1-10", category: "shooting", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 4 },
      { name: "Ball Handling", unit: "1-10", category: "skills", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 5 },
      { name: "Court Vision / IQ", unit: "1-10", category: "skills", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 6 },
      { name: "Defensive Ability", unit: "1-10", category: "skills", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 7 },
      { name: "Coachability", unit: "1-10", category: "other", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 8 },
    ],
    placeholderProgramName: "Eagles Basketball",
  },
  {
    id: "soccer",
    label: "Soccer",
    emoji: "⚽",
    categories: ["speed", "technical", "tactical", "physical", "other"],
    positions: ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"],
    defaultMetrics: [
      { name: "40-Yard Dash", unit: "sec", category: "speed", metric_type: "timed", sort_order: 1 },
      { name: "Beep Test (Yo-Yo)", unit: "level", category: "physical", metric_type: "measured", sort_order: 2 },
      { name: "Dribbling / 1v1", unit: "1-10", category: "technical", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 3 },
      { name: "Passing Accuracy", unit: "1-10", category: "technical", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 4 },
      { name: "Finishing / Shooting", unit: "1-10", category: "technical", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 5 },
      { name: "Tactical Awareness", unit: "1-10", category: "tactical", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 6 },
      { name: "Defensive Work Rate", unit: "1-10", category: "tactical", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 7 },
      { name: "Coachability", unit: "1-10", category: "other", metric_type: "rated", min_value: 1, max_value: 10, sort_order: 8 },
    ],
    placeholderProgramName: "Eagles Soccer",
  },
];

export function getSportById(id: string): SportConfig | undefined {
  return SPORTS.find((s) => s.id === id);
}

export function getSportCategories(sportId: string): string[] {
  return getSportById(sportId)?.categories || ["other"];
}

export function getSportPositions(sportId: string): string[] {
  return getSportById(sportId)?.positions || [];
}

export function sportHasBatsThrows(sportId: string): boolean {
  return getSportById(sportId)?.hasBatsThrows ?? false;
}

export function formatCategory(category: string): string {
  return category
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
