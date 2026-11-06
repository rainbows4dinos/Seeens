"use client";

import { Close } from "@carbon/icons-react";
import { useRouter } from "next/navigation";
import { LogForm } from "@/components/outreach-panel";
import { createContext, useContext, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// The quick view's shell (#126): an ink title bar with Close, then the body
// and footer the server renders. Not a dialog: the directory stays usable
// beside it, so picking another row just switches what's shown.
//
// Close (or Escape) goes back, which is the directory: rows open the first
// connection with a push and switch with a replace.
export function QuickViewFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Which connection the Log Outreach form is open for. The frame stays
  // while you switch connections, so the form only shows on the one it was
  // opened for.
  const [logging, setLogging] = useState<string | null>(null);
  const aside = useRef<HTMLElement>(null);

  // Tell the directory to make room while this panel is showing. Next keeps
  // a closed panel in the page, hidden, for Back and Forward; effects only
  // run while it's visible, so this follows what's on screen. Shown again
  // (Forward), it slides back in rather than staying where it slid out.
  useLayoutEffect(() => {
    const shell = document.querySelector(".directory-shell");
    shell?.setAttribute("data-quick-view", "");
    aside.current?.removeAttribute("data-closing");
    return () => shell?.removeAttribute("data-quick-view");
  }, []);

  // Slides out (150ms, ease-in), then goes back to the directory. The slide
  // is CSS on data-closing; with reduced motion it just goes. If another
  // connection opens while it's sliding, Back would undo that, so the panel
  // slides back in with it instead.
  function close() {
    const el = aside.current;
    if (!el || el.hasAttribute("data-closing")) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return router.back();
    const from = location.pathname;
    el.setAttribute("data-closing", "");
    setTimeout(() => {
      if (location.pathname === from) router.back();
      else el.removeAttribute("data-closing");
    }, 150);
  }
  const closeOnEscape = useEffectEvent(close);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Escape in a field or an open dialog belongs to that field or dialog.
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, dialog[open]")) return;
      closeOnEscape();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <LogContext value={{ logging, setLogging }}>
      <aside ref={aside} className="quick-view" aria-label="Quick view">
        <div className="quick-view-title">
          <span className="font-semibold">Quick view</span>
          <button type="button" className="quick-view-close" onClick={close}>
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
// last entry. They share which connection it's open for.
const LogContext = createContext<{ logging: string | null; setLogging: (id: string | null) => void }>({
  logging: null,
  setLogging: () => {},
});

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
export function LogOutreachButton({ connectionId }: { connectionId: string }) {
  const { logging, setLogging } = useContext(LogContext);
  const open = logging === connectionId;
  return (
    <button type="button" className="button-secondary" aria-expanded={open} onClick={() => setLogging(open ? null : connectionId)}>
      Log Outreach
    </button>
  );
}

/** Where the Log Outreach form opens, above the last entry. */
export function QuickLog({ connectionId, today }: { connectionId: string; today: string }) {
  const { logging, setLogging } = useContext(LogContext);
  return logging === connectionId ? (
    <LogForm connectionId={connectionId} today={today} onClose={() => setLogging(null)} />
  ) : null;
}
