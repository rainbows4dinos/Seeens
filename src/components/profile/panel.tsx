"use client";

import { Add, Subtract } from "@carbon/icons-react";
import { useEffect, useRef, type ReactNode } from "react";

// A profile panel (Figma Window, #126): an ink title bar that folds the
// panel away. Folded, the bar shows a one-line summary. Each device
// remembers which panels you keep folded. A <details>, so it works before
// the page's script loads.
export function ProfilePanel({
  id,
  title,
  summary,
  children,
}: {
  id: string;
  title: string;
  summary?: string | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const key = `seeens:panel:${id}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(key) === "closed" && ref.current) ref.current.open = false;
    } catch {
      // Storage blocked: everything starts open.
    }
  }, [key]);

  return (
    <details
      ref={ref}
      open
      className="profile-panel"
      onToggle={(e) => {
        try {
          localStorage.setItem(key, e.currentTarget.open ? "open" : "closed");
        } catch {
          // Storage blocked: it just won't be remembered.
        }
      }}
    >
      <summary className="profile-panel-title">
        <span className="min-w-0 truncate">
          <span className="font-semibold">{title}</span>
          {summary ? <span className="profile-panel-summary"> · {summary}</span> : null}
        </span>
        <span className="profile-panel-icon" aria-hidden="true">
          <Subtract size={16} className="icon-open" />
          <Add size={16} className="icon-closed" />
        </span>
      </summary>
      <div className="profile-panel-body">{children}</div>
    </details>
  );
}
