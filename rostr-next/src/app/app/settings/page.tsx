import { SettingsView } from "./settings-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { getSessionUser, displayName, initialsFrom } from "@/lib/auth";

export default async function SettingsPage() {
  const [coach, user] = await Promise.all([getCurrentCoach(), getSessionUser()]);
  const programName = coach?.program_name ?? "Demo · Lincoln HS";
  const coachName = coach?.full_name ?? displayName(user) ?? "Coach";
  const sport = coach?.program_sport ?? "Baseball";
  const levels = coach?.program_levels ?? ["Varsity", "JV", "Freshman"];

  return (
    <SettingsView
      hasCoach={!!coach}
      programName={programName}
      coachName={coachName}
      sport={sport}
      levels={levels}
      logoInitials={initialsFrom(programName).slice(0, 2)}
    />
  );
}
