/**
 * Pure formatters — safe to import from both client and server components.
 *
 * Anything that needs a Supabase client or `next/headers` belongs in a
 * service module, not here. Keeping this file dependency-free lets
 * client-side cards and chips format stats without pulling server code
 * into the client bundle.
 */

/**
 * formatAvg — baseball stats convention: drop the leading 0 and pad
 * to 3 decimal places. `.372` not `0.372`.
 */
export function formatAvg(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = Number(n).toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}

/**
 * formatIP — innings pitched in baseball convention. Integer innings
 * plus thirds: 6.0 innings = 18 outs, 6.1 = 19 outs (1/3 into the 7th),
 * 6.2 = 20 outs (2/3 into the 7th). We store outs as a decimal in the
 * view already (via `ROUND(outs/3, 2)`), so 6.33 -> "6.1", 6.67 -> "6.2".
 */
export function formatIP(ip: number | null | undefined): string {
  if (ip == null) return "—";
  const total = Number(ip);
  const whole = Math.floor(total);
  const frac = total - whole;
  // Bucket to nearest third: 0, 1/3 (~.33), 2/3 (~.67)
  const thirds = frac < 0.17 ? 0 : frac < 0.5 ? 1 : frac < 0.84 ? 2 : 0;
  return thirds === 0 ? `${whole}.0` : `${whole}.${thirds}`;
}

/**
 * formatERA — 2-decimal rate stat, no leading-zero strip (ERAs can
 * be large; 0.00 is legitimate and readable).
 */
export function formatERA(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toFixed(2);
}

/**
 * formatWHIP — 2-decimal rate stat. Walks-plus-hits-per-inning-pitched.
 */
export function formatWHIP(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toFixed(2);
}
