import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Rostr — Team operating system for coaches",
  description:
    "The platform high school coaches run their program on. Scoutable player profiles come for free.",
  // App-like behavior on iOS Safari: enables full-screen launch when
  // saved to Home Screen + tweaks the status-bar styling. Pairs with
  // the apple-touch-icon at src/app/apple-icon.svg.
  appleWebApp: {
    capable: true,
    title: "Rostr",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    // Stop iOS Safari from auto-linking phone numbers / dates / emails
    // it thinks it sees in headings or stat lines (".372" got
    // misdetected as a phone number on some devices).
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
};

/**
 * Viewport — split out from `metadata` because Next 14 enforces this
 * separation. `themeColor` swaps based on system theme. Allow
 * pinch-zoom (don't kill it for accessibility) but raise maximumScale
 * past 1 so iOS doesn't fire the auto double-tap zoom flash that
 * breaks the app illusion.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
  // Paint into the safe-area insets on notch/home-bar iPhones; we
  // respect the cutouts via env(safe-area-inset-*) in CSS.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}
    >
      <body className="bg-paper text-ink antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "hsl(var(--card, 0 0% 100%))",
              border: "1px solid var(--hair)",
              color: "var(--ink)",
              borderRadius: "8px",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
