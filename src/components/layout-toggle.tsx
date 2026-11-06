"use client";

import { Grid, List } from "@carbon/icons-react";
import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import { LAYOUT_COOKIE, type DirectoryLayout } from "@/lib/connections/card";

// Cards / List for the directory (Cards by default). Switching happens in the browser: the
// results render from the same loaded data either way, so there's no trip
// to the server. The choice still goes in the URL (shareable)
// and a cookie (this device opens the same way next time).

const LayoutContext = createContext<{
  layout: DirectoryLayout;
  setLayout: (layout: DirectoryLayout) => void;
} | null>(null);

function remember(layout: DirectoryLayout) {
  document.cookie = `${LAYOUT_COOKIE}=${layout}; path=/; max-age=31536000; samesite=lax`;
  // With the quick view open the address is the connection's (#126); adding
  // ?layout there would make a stray history entry for Close to land on.
  if (window.location.pathname !== "/") return;
  const url = new URL(window.location.href);
  url.searchParams.set("layout", layout);
  // Next keeps its router in sync with replaceState; no navigation, no fetch.
  window.history.replaceState(window.history.state, "", url);
}

export function LayoutProvider({ initial, children }: { initial: DirectoryLayout; children: ReactNode }) {
  const [layout, setLayout] = useState(initial);
  return <LayoutContext.Provider value={{ layout, setLayout }}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("LayoutToggle and LayoutSlot need a LayoutProvider.");
  return ctx;
}

// Figma Layout Toggle: icon-only segments, Cards first, on wider screens;
// on phones, one square button that switches to the other layout and shows
// its icon. Each keeps its name for screen readers and as a tooltip. Real
// links, so they still work before the page's script loads, or opened in a
// new tab.
export function LayoutToggle({ hrefs }: { hrefs: Record<DirectoryLayout, string> }) {
  const { layout: current, setLayout } = useLayout();
  const pick = (layout: DirectoryLayout) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setLayout(layout);
    remember(layout);
  };
  const other = current === "list" ? "cards" : "list";
  return (
    <>
      <nav aria-label="Directory layout" className="segmented segmented-secondary shrink-0 max-sm:hidden">
        {(["cards", "list"] as const).map((layout) => (
          <Link
            key={layout}
            href={hrefs[layout]}
            aria-current={current === layout ? "page" : undefined}
            aria-label={layout === "list" ? "List" : "Cards"}
            title={layout === "list" ? "List" : "Cards"}
            onClick={pick(layout)}
            className="segment-icon"
          >
            {layout === "list" ? <List size={16} aria-hidden="true" /> : <Grid size={16} aria-hidden="true" />}
          </Link>
        ))}
      </nav>
      <Link
        href={hrefs[other]}
        onClick={pick(other)}
        className="button-secondary button-icon shrink-0 sm:hidden"
        aria-label={other === "cards" ? "Show as cards" : "Show as a list"}
        title={other === "cards" ? "Show as cards" : "Show as a list"}
      >
        {other === "list" ? <List size={16} aria-hidden="true" /> : <Grid size={16} aria-hidden="true" />}
      </Link>
    </>
  );
}
