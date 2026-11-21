"use client";

import { Analytics } from "@vercel/analytics/next";

// Vercel Web Analytics: page views only, cookieless, no personal data. The
// query string and hash are dropped before anything is sent, so searches,
// filters, and invite tokens never leave the browser. Pages still group by
// route (/connections/[id]), not by listing.
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        url.search = "";
        url.hash = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
