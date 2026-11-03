"use client";

import { Grid, List } from "@carbon/icons-react";
import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import { LAYOUT_COOKIE, type DirectoryLayout } from "@/lib/connections/card";

// List / Cards for the directory. Switching happens in the browser: the page
// sends both layouts once, and the toggle swaps which one is mounted, so
// there's no trip to the server. The choice still goes in the URL (shareable)
// and a cookie (this device opens the same way next time).

const LayoutContext = createContext<{
  layout: DirectoryLayout;
  setLayout: (layout: DirectoryLayout) => void;
} | null>(null);

function remember(layout: DirectoryLayout) {
  document.cookie = `${LAYOUT_COOKIE}=${layout}; path=/; max-age=31536000; samesite=lax`;
  const url = new URL(window.location.href);
  url.searchParams.set("layout", layout);
  // Next keeps its router in sync with replaceState; no navigation, no fetch.
  window.history.replaceState(window.history.state, "", url);
}

export function LayoutProvider({ initial, children }: { initial: DirectoryLayout; children: ReactNode }) {
  const [layout, setLayout] = useState(initial);
  return <LayoutContext.Provider value={{ layout, setLayout }}>{children}</LayoutContext.Provider>;
}

function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("LayoutToggle and LayoutSlot need a LayoutProvider.");
  return ctx;
}

// Figma Segmented Control. Real links, so they still work before the page's
// script loads, or opened in a new tab.
export function LayoutToggle({ hrefs }: { hrefs: Record<DirectoryLayout, string> }) {
  const { layout: current, setLayout } = useLayout();
  return (
    <nav aria-label="Directory layout" className="segmented">
      {(["list", "cards"] as const).map((layout) => (
        <Link
          key={layout}
          href={hrefs[layout]}
          aria-current={current === layout ? "page" : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            setLayout(layout);
            remember(layout);
          }}
          className="inline-flex items-center gap-2"
        >
          {layout === "list" ? <List size={16} aria-hidden="true" /> : <Grid size={16} aria-hidden="true" />}
          {/* Phones show the icons only; the names are still read out. */}
          <span className="max-sm:sr-only">{layout === "list" ? "List" : "Cards"}</span>
        </Link>
      ))}
    </nav>
  );
}

// Shows whichever layout is chosen.
export function LayoutSlot({ list, cards }: { list: ReactNode; cards: ReactNode }) {
  return <>{useLayout().layout === "list" ? list : cards}</>;
}
