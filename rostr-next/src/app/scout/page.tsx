import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import {
  getCurrentRecruiter,
  searchPlayers,
  fetchLists,
  fetchSavedSearches,
  classYearForGrade,
  type SearchFilters,
} from "@/lib/services/recruiter";
import { ScoutSearchView } from "./search-view";

/**
 * /scout — the main search surface.
 *
 * SSR reads filter state from the URL (?q=, ?pos=, ?class=, ?max60=,
 * ?minEV=, ?minVelo=, ?sort=), runs the search on the server, passes
 * results + the raw filter state to the client view. The client view
 * handles pill add/remove by updating the URL.
 */
export default async function ScoutPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    pos?: string; // comma-separated
    class?: string; // comma-separated class years
    max60?: string;
    minEV?: string;
    minVelo?: string;
    minField?: string;
    minBP?: string;
    minBA?: string;
    minOPS?: string;
    minHR?: string;
    minIP?: string;
    maxERA?: string;
    maxWHIP?: string;
    minK9?: string;
    sort?: string;
  };
}) {
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) redirect("/scout/setup");

  const filters: SearchFilters = {
    query: searchParams.q,
    positions: parseCSV(searchParams.pos),
    gradeYears: parseCSV(searchParams.class)?.map((s) => Number(s)).filter((n) => !Number.isNaN(n)),
    max60yd: parseNumber(searchParams.max60),
    minEV: parseNumber(searchParams.minEV),
    minVelo: parseNumber(searchParams.minVelo),
    minField: parseNumber(searchParams.minField),
    minBP: parseNumber(searchParams.minBP),
    minBA: parseNumber(searchParams.minBA),
    minOPS: parseNumber(searchParams.minOPS),
    minHR: parseNumber(searchParams.minHR),
    minIP: parseNumber(searchParams.minIP),
    maxERA: parseNumber(searchParams.maxERA),
    maxWHIP: parseNumber(searchParams.maxWHIP),
    minK9: parseNumber(searchParams.minK9),
    sort: (searchParams.sort as SearchFilters["sort"]) ?? "best_ev_desc",
    limit: 50,
  };

  const [{ players, total }, lists, savedSearches] = await Promise.all([
    searchPlayers(filters),
    fetchLists(recruiter.id),
    fetchSavedSearches(recruiter.id),
  ]);

  // Class-year helper: convert grade integers to class years in the
  // result set so the UI can display "Class of 2027" consistently.
  const playersWithClass = players.map((p) => ({
    ...p,
    classYear: p.grade != null ? classYearForGrade(p.grade) : null,
  }));

  const hasAnyFilter =
    Boolean(filters.query) ||
    (filters.positions?.length ?? 0) > 0 ||
    (filters.gradeYears?.length ?? 0) > 0 ||
    filters.max60yd != null ||
    filters.minEV != null ||
    filters.minVelo != null ||
    filters.minField != null ||
    filters.minBP != null ||
    filters.minBA != null ||
    filters.minOPS != null ||
    filters.minHR != null ||
    filters.minIP != null ||
    filters.maxERA != null ||
    filters.maxWHIP != null ||
    filters.minK9 != null;

  return (
    <ScoutSearchView
      recruiter={recruiter}
      filters={filters}
      total={total}
      players={playersWithClass}
      lists={lists}
      savedSearches={savedSearches}
      hasAnyFilter={hasAnyFilter}
    />
  );
}

function parseCSV(s?: string): string[] | undefined {
  if (!s) return undefined;
  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function parseNumber(s?: string): number | null | undefined {
  if (s == null || s === "") return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
}

// Silence unused import warning
void Search;
