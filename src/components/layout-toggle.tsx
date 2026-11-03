"use client";

import { Grid, List } from "@carbon/icons-react";
import Link from "next/link";
import { LAYOUT_COOKIE, type DirectoryLayout } from "@/lib/connections/card";

function remember(layout: DirectoryLayout) {
  document.cookie = `${LAYOUT_COOKIE}=${layout}; path=/; max-age=31536000; samesite=lax`;
}

// List / Cards toggle (Figma Segmented Control). The choice is in the URL, so
// a view can be shared, and in a cookie, so the directory opens the same way
// next time on this device.
export function LayoutToggle({
  current,
  hrefs,
}: {
  current: DirectoryLayout;
  hrefs: Record<DirectoryLayout, string>;
}) {
  return (
    <nav aria-label="Directory layout" className="segmented">
      {(["list", "cards"] as const).map((layout) => (
        <Link
          key={layout}
          href={hrefs[layout]}
          aria-current={current === layout ? "page" : undefined}
          onClick={() => remember(layout)}
          className="inline-flex items-center gap-2"
        >
          {layout === "list" ? <List size={16} aria-hidden="true" /> : <Grid size={16} aria-hidden="true" />}
          {layout === "list" ? "List" : "Cards"}
        </Link>
      ))}
    </nav>
  );
}
