import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes Rostr installable as a home-screen app on
 * iOS + Android. When a coach taps "Add to Home Screen" (Safari) or
 * gets the install prompt (Chrome/Edge), the app launches in
 * fullscreen with its own icon, no browser chrome, behaves like a
 * native app.
 *
 * Next.js auto-serves this at /manifest.webmanifest from the
 * file-based config below — no public/manifest.json needed.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rostr — Team operating system",
    short_name: "Rostr",
    description:
      "Run your baseball program. Roster, practice plans, live scoring, scout-ready player profiles.",
    start_url: "/",
    // Standalone hides the browser chrome — looks/feels like a native app.
    display: "standalone",
    background_color: "#f5f1e8",
    // Status-bar tint on Android. Matches the dark ink color used for
    // the app's TopBar so the system status bar feels integrated.
    theme_color: "#0e1116",
    orientation: "portrait",
    categories: ["sports", "productivity"],
    lang: "en-US",
    icons: [
      // Next auto-serves these from src/app/icon.svg + apple-icon.svg.
      // We add explicit entries so installable manifests have the
      // precise sizes Android and Chrome need for the home screen.
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        // "maskable" tells Android it can crop the icon into a circle
        // / squircle / etc. Same SVG is fine for now — improving with
        // a true maskable design (12.5% safe zone padding) is a polish
        // pass when the brand identity gets formalized.
        purpose: "maskable",
      },
      {
        src: "/apple-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
    // Shortcuts — long-press the home-screen icon on Android/iOS to
    // jump straight into the most-used surfaces. Tier-1 polish.
    shortcuts: [
      {
        name: "Today",
        short_name: "Today",
        description: "Daily standup",
        url: "/app/today",
      },
      {
        name: "Roster",
        short_name: "Roster",
        description: "Team roster",
        url: "/app/roster",
      },
      {
        name: "Score live",
        short_name: "Score",
        description: "Open live scoring",
        url: "/app/games",
      },
    ],
  };
}
