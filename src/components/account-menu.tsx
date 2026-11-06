"use client";

import { CaretDown } from "@carbon/icons-react";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useRef, type ReactNode } from "react";

// The desktop header's account menu (Figma Nav Chip, Style=Account): the
// band's picture, "Band & You", and a caret. It opens a panel of links
// grouped by band, you, and signing out (#67).
//
// A <details>, so it opens without JavaScript. With it: Escape closes and
// returns focus to the button, and a click outside or a page change closes.
// It's a disclosure of links, not an ARIA menu.
export function AccountMenu({
  band,
  member,
  picture,
  children,
}: {
  band: string | null;
  member: string;
  picture: ReactNode;
  children: ReactNode;
}) {
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
    <details ref={ref} className="account-menu">
      <summary className="account-chip" aria-controls={panelId}>
        {picture}
        <span className="account-chip-label">
          {band ? (
            <>
              <span className="account-chip-band">{band}</span> &amp;{" "}
            </>
          ) : null}
          <span>{member}</span>
        </span>
        <CaretDown size={16} aria-hidden="true" className="shrink-0" />
        <span className="sr-only">: account and band</span>
      </summary>
      <div id={panelId} className="account-menu-panel">
        {children}
      </div>
      <Suspense fallback={null}>
        <CloseOnNavigate onNavigate={close} />
      </Suspense>
    </details>
  );
}

function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onNavigate();
  }, [pathname, onNavigate]);
  return null;
}
