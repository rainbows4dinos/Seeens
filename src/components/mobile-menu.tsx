"use client";

import { Close, Menu } from "@carbon/icons-react";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useRef, type ReactNode } from "react";

// The phone header's menu (Figma App Header, Viewport=Mobile). It opens as
// an overlay: the header row stays sharp, the page behind blurs, and the
// panel floats below the header.
//
// It's a <details>, so it opens and closes without JavaScript. With
// JavaScript:
//   - tapping the blurred page, Escape, or moving to another page closes it
//   - while it's open, the page behind is inert, so focus stays in the
//     header and menu; Escape returns focus to the button
//
// The button and panel are positioned against the header's padded box, so
// the header wrapper must be relative.
export function MobileMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const panelId = useId();
  const close = useCallback(() => {
    if (ref.current) ref.current.open = false;
  }, []);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const summary = details.querySelector("summary");
    // The page behind the menu: everything but the header.
    const behind = () => document.querySelectorAll<HTMLElement>("main, footer");

    const onToggle = () => {
      behind().forEach((el) => (el.inert = details.open));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.open) {
        details.open = false;
        summary?.focus();
      }
    };
    // A tap on a link inside closes it right away, even before the new page.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("a")) details.open = false;
    };

    details.addEventListener("toggle", onToggle);
    document.addEventListener("keydown", onKey);
    details.addEventListener("click", onClick);
    return () => {
      details.removeEventListener("toggle", onToggle);
      document.removeEventListener("keydown", onKey);
      details.removeEventListener("click", onClick);
      behind().forEach((el) => (el.inert = false));
    };
  }, []);

  return (
    <details ref={ref} className="mobile-menu min-[60rem]:hidden">
      <summary
        className="button-secondary button-icon absolute top-4 right-4"
        aria-label="Menu"
        aria-controls={panelId}
      >
        <Menu size={16} className="icon-menu" aria-hidden="true" />
        <Close size={16} className="icon-close" aria-hidden="true" />
      </summary>
      {/* The blurred page. Tapping it closes the menu; keyboard users have
          Escape and the button, so it isn't a control of its own. */}
      <div className="menu-backdrop" aria-hidden="true" onClick={close} />
      <div id={panelId} className="menu-panel">
        {children}
      </div>
      <Suspense fallback={null}>
        <CloseOnNavigate onNavigate={close} />
      </Suspense>
    </details>
  );
}

// Closes the menu after a page change (back and forward included).
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onNavigate();
  }, [pathname, onNavigate]);
  return null;
}
