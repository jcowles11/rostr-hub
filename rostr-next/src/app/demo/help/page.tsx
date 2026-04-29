/**
 * /demo/help — FAQ + getting-started guide.
 * The /app/help page is static + uses no auth, so it can be re-exported
 * for the demo as-is. Same content for prospects evaluating the product.
 */
import HelpPage from "@/app/app/help/page";

export const metadata = {
  title: "Help · Demo · Rostr",
  robots: { index: false, follow: false },
};

export default HelpPage;
