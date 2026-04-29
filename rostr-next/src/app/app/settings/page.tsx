import { SettingsView } from "./settings-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { getSessionUser, displayName, initialsFrom } from "@/lib/auth";
import {
  fetchCoachInvitesAction,
  fetchProgramCoaches,
} from "./invite-actions";
import { fetchTeams, fetchProgramCoachesGrouped } from "@/lib/services/teams";

export default async function SettingsPage() {
  const [coach, user] = await Promise.all([getCurrentCoach(), getSessionUser()]);
  const programName = coach?.program_name ?? "Demo · Lincoln HS";
  const coachName = coach?.full_name ?? displayName(user) ?? "Coach";
  const sport = coach?.program_sport ?? "Baseball";
  const levels = coach?.program_levels ?? ["Varsity", "JV", "Freshman"];

  // Coaches + invites for the "Staff" panel (head-coach only in UI).
  // Plus teams + scoped-coaches for the new Teams section that lets a
  // head coach assign per-team coach accounts.
  const [invitesRes, coachesRes, teams, scopedCoaches] = coach
    ? await Promise.all([
        fetchCoachInvitesAction(),
        fetchProgramCoaches(),
        fetchTeams(coach.program_id),
        fetchProgramCoachesGrouped(coach.program_id),
      ])
    : [
        { invites: [], error: null },
        { coaches: [], error: null },
        [],
        [],
      ];

  return (
    <SettingsView
      hasCoach={!!coach}
      isHeadCoach={coach?.role === "head_coach"}
      programName={programName}
      coachName={coachName}
      sport={sport}
      levels={levels}
      logoInitials={initialsFrom(programName).slice(0, 2)}
      programCoaches={coachesRes.coaches}
      coachInvites={invitesRes.invites}
      currentCoachId={coach?.id ?? null}
      teams={teams}
      scopedCoaches={scopedCoaches}
    />
  );
}
