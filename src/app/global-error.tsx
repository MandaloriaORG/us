"use client";

import { useEffect } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Last boundary before the framework's own error page — the one error surface
 * the route `error.tsx` files cannot cover, because it catches a crash inside
 * the root layout itself. The layout that would load the global stylesheet is
 * gone at this point, so the page is styled inline rather than with tokens.
 * The digest is the only thing logged: the message may carry data the reader
 * is not entitled to, and production redacts it anyway.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error.", { digest: error.digest });
  }, [error.digest]);

  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#0a0d10",
          color: "#eef1f4",
          fontFamily:
            "'Inter UI', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
        }}
      >
        <main
          style={{
            alignItems: "center",
            display: "flex",
            minHeight: "100vh",
            padding: "1.5rem",
          }}
        >
          <div
            role="alert"
            style={{
              border: "1px solid rgba(224 98 98 / 0.3)",
              backgroundColor: "rgba(224 98 98 / 0.08)",
              borderRadius: "0.5rem",
              margin: "0 auto",
              maxWidth: "36rem",
              padding: "1.5rem",
              width: "100%",
            }}
          >
            <div style={{ alignItems: "flex-start", display: "flex", gap: "0.75rem" }}>
              <WarningCircleIcon
                aria-hidden="true"
                style={{
                  color: "#e05d5d",
                  flexShrink: 0,
                  height: "1.5rem",
                  marginTop: "0.125rem",
                  width: "1.5rem",
                }}
              />
              <div>
                <h1
                  style={{
                    color: "#eef1f4",
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    lineHeight: 1.4,
                    margin: 0,
                  }}
                >
                  This page could not be loaded
                </h1>
                <p
                  style={{
                    color: "#a5abb4",
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                    margin: "0.5rem 0 0",
                  }}
                >
                  Something failed on our side. Nothing you were doing was lost.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    marginTop: "1.25rem",
                  }}
                >
                  <button
                    onClick={reset}
                    style={{
                      backgroundColor: "#c8a45d",
                      border: "none",
                      borderRadius: "0.375rem",
                      color: "#3a2f14",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      minHeight: "2.75rem",
                      padding: "0 1rem",
                    }}
                    type="button"
                  >
                    Try again
                  </button>
                  <a
                    href="/"
                    style={{
                      color: "#a5abb4",
                      fontSize: "0.875rem",
                      lineHeight: "2.75rem",
                      textDecoration: "underline",
                      textUnderlineOffset: "0.25rem",
                    }}
                  >
                    Return to Mandaloria
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
