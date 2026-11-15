"use client";

import { Add, Subtract } from "@carbon/icons-react";
import { useEffect, useRef, type ReactNode } from "react";
import { loadFoldedPanels, savePanelFolded } from "@/lib/panels/actions";

// A profile panel (Figma Window, #126): an ink title bar that folds the
// panel away. Folded, the bar shows a one-line summary. Which panels you keep
// folded is saved to your account (#314), so it follows you across devices;
// this device's copy applies first, so there's no flash. A <details>, so it
// works before the page's script loads.
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

  // What we last set or saw, so the toggle event from setting it ourselves
  // (or from the initial open) doesn't save anything.
  const known = useRef(true);

  useEffect(() => {
    // A link straight to this panel (#band-invite) opens it, folded or not.
    if (location.hash === `#${id}`) return;
    const apply = (open: boolean) => {
      known.current = open;
      if (ref.current && ref.current.open !== open) ref.current.open = open;
    };
    let local: string | null = null;
    try {
      local = localStorage.getItem(key);
    } catch {
      // Storage blocked: the account's copy still applies below.
    }
    if (local === "closed") apply(false);
    let live = true;
    folded().then(({ ids, saved }) => {
      if (!live) return;
      if (!saved) {
        // Nothing on the account yet: carry this device's fold over, once.
        if (local === "closed" && !ids.has(id)) {
          ids.add(id);
          void savePanelFolded(id, true);
        }
        return;
      }
      const open = !ids.has(id);
      apply(open);
      remember(key, open);
    });
    return () => {
      live = false;
    };
  }, [key, id]);

  return (
    <details
      ref={ref}
      id={id}
      open
      className="profile-panel"
      onToggle={(e) => {
        const open = e.currentTarget.open;
        if (open === known.current) return;
        known.current = open;
        remember(key, open);
        void folded().then(({ ids }) => {
          if (open) ids.delete(id);
          else ids.add(id);
        });
        void savePanelFolded(id, !open);
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

// Loaded once per page load and shared by every panel; toggles keep it current.
let foldedIds: Promise<{ ids: Set<string>; saved: boolean }> | null = null;
function folded() {
  foldedIds ??= loadFoldedPanels().then(
    (ids) => ({ ids: new Set(ids ?? []), saved: ids !== null }),
    () => ({ ids: new Set<string>(), saved: false }),
  );
  return foldedIds;
}

function remember(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? "open" : "closed");
  } catch {
    // Storage blocked: the account still remembers.
  }
}
