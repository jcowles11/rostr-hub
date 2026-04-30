import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchPlayerAcademics,
  fetchPlayerHighlights,
  fetchPlayerProfileMedia,
  fetchPlayerPrivacy,
  fetchPlayerPriorStats,
} from "@/lib/services/player-profile";
import { ProfileEditor } from "./profile-editor";

/**
 * /me/profile — the player-facing profile editor.
 *
 * "LinkedIn for high-school athletes." Players land here from a "Edit
 * profile" button on /me. The page:
 *   - Authenticates and loads the user's claimed player row
 *   - Hydrates current values for academics + media + highlights
 *   - Renders the ProfileEditor client component, which submits via
 *     the server actions in ./actions.ts
 *
 * Authoritative source for what coaches CAN'T edit: anything that
 * would put words in the player's mouth (bio, GPA, SAT/ACT, intended
 * level). Coaches can still upload an avatar via the Roster admin
 * tools, but the kid driving their own narrative is the design goal.
 */
export const metadata = {
  title: "Edit profile · Rostr",
  robots: { index: false, follow: false },
};

export default async function ProfileEditorPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/profile");

  // Find the player row claimed by this user.
  const { data: player } = await supabase
    .from("players")
    .select(
      "id, first_name, last_name, profile_slug, grade, positions, player_number",
    )
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();

  if (!player) {
    // No claimed player → bounce them to /me which has the
    // claim-your-profile flow.
    redirect("/me");
  }

  const [academics, highlights, media, privacy, priorStats] = await Promise.all([
    fetchPlayerAcademics(player.id),
    fetchPlayerHighlights(player.id),
    fetchPlayerProfileMedia(player.id),
    // Privacy + prior stats default to safe values (all-off / empty array)
    // when migration 34 columns are missing — fetcher handles the gap.
    fetchPlayerPrivacy(player.id),
    fetchPlayerPriorStats(player.id),
  ]);

  return (
    <ProfileEditor
      player={{
        id: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        slug: player.profile_slug,
        grade: player.grade,
        positions: player.positions ?? [],
        jerseyNumber: player.player_number,
      }}
      academics={
        academics ?? {
          gpa: null,
          satScore: null,
          actScore: null,
          classRankNumerator: null,
          classRankDenominator: null,
          intendedLevel: null,
          schoolLogoUrl: null,
          bio: null,
        }
      }
      media={
        media ?? {
          avatarUrl: null,
          headerUrl: null,
          highlightVideoUrl: null,
          commitmentStatus: null,
          commitmentSchool: null,
          commitmentYear: null,
          commitmentNote: null,
        }
      }
      highlights={highlights}
      privacy={privacy}
      priorStats={priorStats}
    />
  );
}
