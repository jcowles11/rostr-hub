import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true when the app is in demo/dev mode.
 * Demo mode is active when:
 *   - devRoleOverride is set, OR
 *   - sessionStorage rostr_demo_mode flag is "1"
 *
 * Production users should never see demo-only features.
 */
export function useIsDemo(): boolean {
  const { devRoleOverride } = useAuth();
  return !!devRoleOverride || sessionStorage.getItem("rostr_demo_mode") === "1";
}
