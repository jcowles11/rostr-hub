import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /api/ical/[programId] — public iCal feed for a program's schedule.
 *
 * Emits an .ics calendar that parents and players can subscribe to in
 * Google Calendar / Apple Calendar / Outlook. Updates flow automatically
 * because subscribers re-fetch the URL on their own cadence (Google ~1×/day,
 * Apple ~5min–1h depending on settings).
 *
 * Auth model:
 * - The URL is keyed on the program's UUID. Anyone with the link can
 *   subscribe — by design, since the whole point is for parents to use it.
 * - The UUID itself is not enumerable (2^122 possibilities) so the URL
 *   functions as a soft secret.
 * - When migration 000029 adds `programs.ical_token`, swap the lookup
 *   to use the rotatable token so coaches can revoke a leaked URL
 *   without changing the program ID.
 *
 * Response is cached 5 min on the edge so a hot calendar subscriber
 * pool doesn't hammer the database.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { programId: string } },
) {
  const programId = params.programId;
  if (!isUuid(programId)) {
    return new NextResponse("invalid program id", { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Pull program + games + practices in parallel. RLS for unauth
  // requests is restrictive by default — the program / games / practices
  // tables need a "public iCal" policy or the queries return empty.
  // We fall back to a sensible empty calendar if Supabase blocks the
  // read (better than 500ing a parent's calendar app).
  const [programRes, gamesRes, practicesRes] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name, sport, season")
      .eq("id", programId)
      .maybeSingle(),
    supabase
      .from("games")
      .select("id, name, opponent, game_date, game_time, location, home_away, team_level, status")
      .eq("program_id", programId)
      .order("game_date", { ascending: true }),
    supabase
      .from("practice_plans")
      .select("id, title, practice_date, team_level, start_time")
      .eq("program_id", programId)
      .order("practice_date", { ascending: true }),
  ]);

  const program = programRes.data;
  const programName = program?.name ?? "Schedule";
  const calendarName = program
    ? `${program.name}${program.sport ? ` ${program.sport}` : ""}${program.season ? ` · ${program.season}` : ""}`
    : "Rostr schedule";

  const games = gamesRes.data ?? [];
  const practices = practicesRes.data ?? [];

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Rostr//Program Calendar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`NAME:${escape(calendarName)}`);
  lines.push(`X-WR-CALNAME:${escape(calendarName)}`);
  lines.push(`X-WR-CALDESC:${escape(`${programName} schedule — exported from Rostr`)}`);
  lines.push("X-PUBLISHED-TTL:PT15M");
  lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT15M");

  const now = new Date();
  const dtstamp = formatICalDateTimeUTC(now);

  for (const g of games) {
    const start = parseLocalDateTime(g.game_date, g.game_time ?? "17:00:00");
    if (!start) continue;
    // Default game length: 2.5 hours (rough for HS varsity baseball).
    const end = new Date(start.getTime() + 2.5 * 60 * 60 * 1000);
    const isHome = (g.home_away ?? "home") === "home";
    const summary = isHome
      ? `vs ${g.opponent ?? g.name ?? "Opponent"}`
      : `@ ${g.opponent ?? g.name ?? "Opponent"}`;
    const description = [
      g.team_level ? `Team: ${g.team_level}` : null,
      g.status ? `Status: ${g.status}` : null,
    ]
      .filter(Boolean)
      .join("\\n");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:game-${g.id}@rostr.app`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${formatICalDateTimeUTC(start)}`);
    lines.push(`DTEND:${formatICalDateTimeUTC(end)}`);
    lines.push(`SUMMARY:${escape(summary)}`);
    if (g.location) lines.push(`LOCATION:${escape(g.location)}`);
    if (description) lines.push(`DESCRIPTION:${escape(description)}`);
    lines.push("CATEGORIES:GAME");
    lines.push("END:VEVENT");
  }

  for (const p of practices) {
    const start = parseLocalDateTime(p.practice_date, p.start_time ?? "15:30:00");
    if (!start) continue;
    // Default practice length: 2 hours.
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const summary = p.title ?? "Practice";
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:practice-${p.id}@rostr.app`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${formatICalDateTimeUTC(start)}`);
    lines.push(`DTEND:${formatICalDateTimeUTC(end)}`);
    lines.push(`SUMMARY:${escape(summary)}`);
    if (p.team_level) lines.push(`DESCRIPTION:${escape(`Team: ${p.team_level}`)}`);
    lines.push("CATEGORIES:PRACTICE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // CRLF per RFC 5545.
  const body = lines.join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // 5 min edge cache is a good balance between fresh + cheap.
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      "Content-Disposition": `inline; filename="${slug(programName)}.ics"`,
    },
  });
}

/** Escape per RFC 5545: backslash, comma, semicolon, newline. */
function escape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Convert a local "YYYY-MM-DD" + "HH:MM[:SS]" to a Date in the server's TZ. */
function parseLocalDateTime(date: string, time: string): Date | null {
  if (!date) return null;
  const [hh = "0", mm = "0", ss = "0"] = time.split(":");
  const d = new Date(`${date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`);
  return isNaN(d.getTime()) ? null : d;
}

/** YYYYMMDDTHHMMSSZ */
function formatICalDateTimeUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "schedule";
}
