"use client";

import { Close } from "@carbon/icons-react";
import { useRouter } from "next/navigation";
import { LogForm } from "@/components/outreach-panel";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// The quick view's shell (#126): an ink title bar with Close, then the body
// and footer the server renders. Not a dialog: the directory stays usable
// beside it, so picking another row just switches what's shown.
//
// Close (or Escape) goes back, which is the directory: rows open the first
// connection with a push and switch with a replace.
export function QuickViewFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [logging, setLogging] = useState(false);

  // Tell the directory to make room while this panel is showing. Next keeps
  // a closed panel in the page, hidden, for Back and Forward; effects only
  // run while it's visible, so this follows what's on screen.
  useLayoutEffect(() => {
    const shell = document.querySelector(".directory-shell");
    shell?.setAttribute("data-quick-view", "");
    return () => shell?.removeAttribute("data-quick-view");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Escape in a field or an open dialog belongs to that field or dialog.
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, dialog[open]")) return;
      router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <LogContext value={{ logging, setLogging }}>
      <aside className="quick-view" aria-label="Quick view">
        <div className="quick-view-title">
          <span className="text-sm font-semibold">Quick view</span>
          <button type="button" className="quick-view-close" onClick={() => router.back()}>
            <Close size={16} aria-hidden="true" />
            <span className="sr-only">Close quick view</span>
          </button>
        </div>
        {children}
      </aside>
    </LogContext>
  );
}

// Log Outreach sits in the footer; its form opens in the body, above the
// last entry. They share whether it's open.
const LogContext = createContext<{ logging: boolean; setLogging: (v: boolean) => void }>({
  logging: false,
  setLogging: () => {},
});

export function useQuickLog() {
  return useContext(LogContext);
}

/** Moves focus to the heading when a connection opens, so keyboard and screen reader users land in the panel. */
export function QuickViewHeading({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [id]);
  return (
    <h2 ref={ref} tabIndex={-1} className="display-m break-words outline-none">
      {children}
    </h2>
  );
}

/** The footer's Log Outreach button: opens the form in the body. */
export function LogOutreachButton() {
  const { logging, setLogging } = useQuickLog();
  return (
    <button type="button" className="button-secondary" aria-expanded={logging} onClick={() => setLogging(!logging)}>
      Log Outreach
    </button>
  );
}

/** Where the Log Outreach form opens, above the last entry. */
export function QuickLog({ connectionId, today }: { connectionId: string; today: string }) {
  const { logging, setLogging } = useQuickLog();
  return logging ? <LogForm connectionId={connectionId} today={today} onClose={() => setLogging(false)} /> : null;
}
