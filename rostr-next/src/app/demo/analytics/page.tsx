/**
 * /demo/analytics — Season trends.
 * The real /app/analytics is already a fully self-contained client
 * component with hardcoded chart data + StatTile components. Re-using
 * it directly is fine — no auth, no fetches, no migration coupling.
 */
import AnalyticsPage from "@/app/app/analytics/page";

export const metadata = {
  title: "Analytics · Demo · Rostr",
  robots: { index: false, follow: false },
};

export default AnalyticsPage;
