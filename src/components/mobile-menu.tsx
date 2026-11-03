"use client";

import { Close, Menu } from "@carbon/icons-react";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useRef, type ReactNode } from "react";

// The phone header's menu (Figma App Header, Viewport=Mobile). It's a
// <details>, so it opens and closes without JavaScript. With JavaScript,
// Escape, a tap outside, or moving to another page also closes it.
//
// This is a disclosure, not a modal: the page behind stays usable, so
// focus isn't trapped. Escape returns focus to the button.
//
// The button is positioned against the header's padded box (top-4 right-4
// lines it up with the logo row), so the header wrapper must be relative.
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

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.open) {
        details.open = false;
        summary?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (details.open && !details.contains(e.target as Node)) details.open = false;
    };
    // A tap on a link inside closes it right away, even before the new page.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("a")) details.open = false;
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    details.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      details.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <details ref={ref} className="mobile-menu sm:hidden">
      <summary
        className="button-secondary button-icon absolute top-4 right-4"
        aria-label="Menu"
        aria-controls={panelId}
      >
        <Menu size={16} className="icon-menu" aria-hidden="true" />
        <Close size={16} className="icon-close" aria-hidden="true" />
      </summary>
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
