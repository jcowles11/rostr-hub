"use client";

import { useEffect } from "react";

/**
 * Root error boundary — catches errors that bubble past every route's
 * error.tsx (e.g. errors in the root layout itself). Plain HTML because
 * at this level we can't count on the layout being stable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global error]", error);
    // Best-effort POST to /api/log-error so this catastrophic case
    // still lands in our log stream. We can't import the helper here
    // (it would defeat the "minimal HTML" goal) — inline it.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const body = JSON.stringify({
          message: error?.message ?? "global error",
          stack: error?.stack,
          name: error?.name,
          area: "global-error",
          level: "fatal",
          extra: { digest: error?.digest },
          ts: new Date().toISOString(),
        });
        navigator.sendBeacon(
          "/api/log-error",
          new Blob([body], { type: "application/json" }),
        );
      } catch {
        /* swallow */
      }
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: "40px 20px",
        background: "#f5f2ec",
        color: "#0e1116",
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
      }}>
        <div style={{
          maxWidth: 460,
          margin: "40px auto",
          background: "#fff",
          border: "1px solid #e5e0d4",
          borderRadius: 8,
          padding: "28px 24px",
          textAlign: "center",
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#f8dedc",
            color: "#c83a3a",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            marginBottom: 12,
          }}>
            !
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>
            Something broke
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>
            We hit a critical error. Reloading usually fixes it.
          </p>
          {error.digest && (
            <div style={{
              marginTop: 12,
              fontSize: 11,
              color: "#9ca3af",
              fontFamily: "monospace",
            }}>
              ref: {error.digest}
            </div>
          )}
          <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "10px 16px",
                background: "#c83a3a",
                color: "#fff",
                border: 0,
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{
                padding: "10px 16px",
                background: "#f5f2ec",
                color: "#0e1116",
                textDecoration: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
