"use client";

// Last resort when the root layout itself fails. Keep it dependency-free.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2.5rem 1rem", maxWidth: "48rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 700 }}>Seeens hit a snag.</h1>
        <p>Something went wrong loading the app. Nothing saved is lost.</p>
        <button type="button" onClick={reset} style={{ minHeight: "2.75rem", padding: "0.5rem 1rem", fontWeight: 600 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
