import type { Config } from "tailwindcss";

/**
 * Rostr design tokens — copied verbatim from handoff/DESIGN_TOKENS.md.
 * Any change here must be mirrored in src/app/globals.css.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic surface/text tokens
        paper: "var(--paper)",
        "paper-deep": "var(--paper-deep)",
        card: "var(--card)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        "ink-4": "var(--ink-4)",
        hair: "var(--hair)",
        "hair-2": "var(--hair-2)",

        // Brand / accent
        red: "var(--red)",
        "red-soft": "var(--red-soft)",
        "red-dim": "var(--red-dim)",
        grass: "var(--grass)",
        "grass-dim": "var(--grass-dim)",
        dirt: "var(--dirt)",
        sky: "var(--sky)",
        gold: "var(--gold)",
        amber: "var(--amber)",
        "amber-soft": "var(--amber-soft)",
        "sky-soft": "var(--sky-soft)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        // Display scale (Space Grotesk)
        "display-xl": ["72px", { lineHeight: "1.02", letterSpacing: "-0.04em", fontWeight: "600" }],
        "display-lg": ["46px", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-md": ["32px", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-sm": ["22px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        // Heading scale
        h1: ["30px", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "600" }],
        h2: ["20px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        h3: ["15px", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        // Body / UI
        body: ["14px", { lineHeight: "1.5" }],
        "body-sm": ["13px", { lineHeight: "1.5" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "500" }],
        label: ["11px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "0.06em" }],
        // Numeric
        "stat-xl": ["30px", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "600" }],
        "stat-md": ["18px", { lineHeight: "1", fontWeight: "600" }],
        "stat-sm": ["13px", { lineHeight: "1.2", fontWeight: "500" }],
      },
      spacing: {
        // DESIGN_TOKENS.md §Spacing scale
        4.5: "18px",
        7: "28px",
        15: "60px",
        18: "72px",
      },
      borderRadius: {
        xs: "5px",
        sm: "7px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        phone: "34px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.06)",
        hover: "0 4px 12px rgba(0,0,0,.08)",
        elev: "0 10px 28px -8px rgba(14,17,22,.2)",
        modal: "0 30px 80px rgba(0,0,0,.3)",
        phone: "0 20px 50px rgba(0,0,0,.4)",
      },
      borderColor: {
        DEFAULT: "var(--hair)",
      },
      ringColor: {
        DEFAULT: "var(--red-soft)",
        focus: "var(--red-soft)",
      },
      keyframes: {
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-live": "pulse-live 1.4s infinite ease-in-out",
        "slide-in-right": "slide-in-right 250ms ease-out",
        shimmer: "shimmer 1.5s infinite linear",
      },
      maxWidth: {
        "layout-app": "1400px",
        "layout-marketing": "1160px",
        "layout-hub": "1200px",
      },
      zIndex: {
        sticky: "4",
        topbar: "5",
        "marketing-nav": "20",
        slideover: "90",
        overlay: "100",
      },
    },
  },
  plugins: [],
};
export default config;
