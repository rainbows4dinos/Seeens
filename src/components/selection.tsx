"use client";

import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ChevronDown } from "@carbon/icons-react";
import { bulkUpdate, undoBulkUpdate, type Before } from "@/lib/connections/bulk-actions";
import { NO_STATUS, STATUSES, STATUS_WORDS, type ConnectionStatus } from "@/lib/connections/labels";
import type { WordSet } from "@/lib/connections/status-words";
import { STAY_EVENT } from "@/components/busy-pointer";

// Bulk status (#243): select listings in the directory, then set a status
// (or played together) for all of them from a bar at the bottom. Export
// Selected (#321) downloads just those listings as CSV, and Select All picks
// every listing that's loaded.
//
// - The photo is the checkbox: it shows on hover or focus, and on every
//   listing once something's selected.
// - Cmd-click (Ctrl on Windows) adds or removes one; Shift-click selects the
//   range from the last one picked. A plain click still opens the listing.
// - Touch: long-press a listing to start; then taps select instead of open.
// - Escape clears. In the Set Status menu, 1–6 pick.

type Selection = {
  selected: ReadonlySet<string>;
  /** How many listings are loaded, for Select All. */
  loaded: number;
  toggle: (id: string, range?: boolean) => void;
  selectAll: () => void;
  clear: () => void;
};
const SelectionContext = createContext<Selection | null>(null);
export const useSelection = () => use(SelectionContext);

/** The listings in page order, read from the page (rows and cards both carry data-listing). */
function listingOrder(root: HTMLElement | null) {
  return [...(root?.querySelectorAll<HTMLElement>("[data-listing]") ?? [])].map((el) => el.dataset.listing!);
}

export function SelectionProvider({
  visibleIds,
  words,
  children,
}: {
  /** What's loaded now: a selection never holds listings that aren't shown. */
  visibleIds: string[];
  words: WordSet;
  children: ReactNode;
}) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const visible = new Set(visibleIds);
  const selected = new Set([...picked].filter((id) => visible.has(id)));

  const value: Selection = {
    selected,
    loaded: visible.size,
    selectAll: () => setPicked(new Set(visibleIds)),
    clear: () => {
      setPicked(new Set());
      anchor.current = null;
    },
    toggle: (id, range = false) => {
      // Read now: the update below runs later, after the anchor moves.
      const from = anchor.current;
      const order = range && from && from !== id ? listingOrder(root.current) : [];
      setPicked((prev) => {
        const next = new Set([...prev].filter((x) => visible.has(x)));
        if (order.length) {
          const [a, b] = [order.indexOf(from!), order.indexOf(id)].sort((x, y) => x - y);
          if (a >= 0) for (const x of order.slice(a, b + 1)) next.add(x);
          else next.add(id);
        } else if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      anchor.current = id;
    },
  };

  // Escape clears (before the quick view sees it).
  const size = selected.size;
  useEffect(() => {
    if (!size) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input:not([type=checkbox]), textarea, select, [contenteditable]")) return;
      e.preventDefault();
      setPicked(new Set());
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [size]);

  return (
    <SelectionContext value={value}>
      <div ref={root} className="contents" data-selecting={size ? "" : undefined}>
        {children}
      </div>
      <SelectionBar words={words} />
    </SelectionContext>
  );
}

/** The checkbox over a listing's photo. A sibling of its link, not inside it. */
export function SelectBox({ id, name }: { id: string; name: string }) {
  const s = useSelection();
  if (!s) return null;
  const on = s.selected.has(id);
  return (
    <label className="select-slot" title={on ? "Deselect" : "Select (or Cmd-click)"}>
      <input
        type="checkbox"
        className="sr-only"
        checked={on}
        aria-label={`Select ${name}`}
        onChange={() => {}}
        onClick={(e) => s.toggle(id, e.shiftKey)}
      />
      <span className="select-mark" aria-hidden="true" />
    </label>
  );
}

/**
 * Click handling for a listing's link: Cmd/Ctrl-click toggles it, Shift-click
 * selects a range, and while selecting on touch, a tap toggles. A long press
 * on touch starts selecting. Returns props for the link.
 */
export function useSelectClick(id: string, onOpen?: (e: React.MouseEvent) => void) {
  const s = useSelection();
  const pressed = useRef<{ timer: number; fired: boolean } | null>(null);
  if (!s) return { onClick: onOpen };
  const touchSelecting = () => s.selected.size > 0 && window.matchMedia("(hover: none)").matches;
  return {
    onClick(e: React.MouseEvent) {
      if (pressed.current?.fired) {
        pressed.current = null;
        e.preventDefault();
        document.dispatchEvent(new Event(STAY_EVENT));
        return;
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey || touchSelecting()) {
        e.preventDefault();
        document.dispatchEvent(new Event(STAY_EVENT));
        s.toggle(id, e.shiftKey);
        return;
      }
      onOpen?.(e);
    },
    onPointerDown(e: React.PointerEvent) {
      if (e.pointerType !== "touch") return;
      const p = { timer: 0, fired: false };
      p.timer = window.setTimeout(() => {
        p.fired = true;
        s.toggle(id);
        navigator.vibrate?.(10);
      }, 500);
      pressed.current = p;
    },
    onPointerUp() {
      if (pressed.current && !pressed.current.fired) clearTimeout(pressed.current.timer);
    },
    onPointerCancel() {
      if (pressed.current) clearTimeout(pressed.current.timer);
      pressed.current = null;
    },
    // No link preview on a long press.
    onContextMenu(e: React.MouseEvent) {
      if (pressed.current) e.preventDefault();
    },
  };
}

type Done = { text: string; before: Before[] } | { error: string } | null;

function SelectionBar({ words }: { words: WordSet }) {
  const s = useSelection()!;
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [pending, start] = useTransition();
  const menu = useRef<HTMLDivElement>(null);
  const n = s.selected.size;
  const labels = STATUS_WORDS[words];
  const options: [ConnectionStatus | null, string][] = [
    ...STATUSES.map((st): [ConnectionStatus, string] => [st, labels[st]]),
    [null, NO_STATUS],
  ];

  function run(change: Parameters<typeof bulkUpdate>[1], what: string) {
    const ids = [...s.selected];
    setOpen(false);
    start(async () => {
      const r = await bulkUpdate(ids, change).catch(() => ({ ok: false as const }));
      setDone(r.ok ? { text: `${r.changed} ${what}`, before: r.before } : { error: "Couldn't save. Try again." });
    });
  }

  // 1–6 pick from the open menu; Escape closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < options.length) {
        e.preventDefault();
        const [st, label] = options[i];
        run({ status: st }, `set to ${label}`);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  });

  // A finished change shows until the selection changes.
  const key = [...s.selected].sort().join();
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    if (done && !pending) setDone(null);
  }

  if (!n && !done) return null;
  return (
    <div className="select-bar" role="region" aria-label="Selected listings">
      <p className="select-bar-count font-medium" aria-live="polite">
        {n}
        <span className="max-sm:sr-only"> selected</span>
      </p>
      <div ref={menu} className="relative">
        <button
          type="button"
          className="button-primary"
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={!n || pending}
          onClick={() => setOpen((o) => !o)}
        >
          {pending ? "Saving…" : "Set Status"}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {open ? (
          <ul className="select-menu" role="menu" aria-label="Status for the selected listings">
            {options.map(([st, label], i) => (
              <li key={st ?? "none"} role="none">
                <button type="button" role="menuitem" onClick={() => run({ status: st }, `set to ${label}`)}>
                  {st ? <span className={`tag tag-${st}`}>{label}</span> : <span className="text-muted">{label}</span>}
                  <kbd>{i + 1}</kbd>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <button
        type="button"
        className="button-secondary"
        disabled={!n || pending}
        onClick={() => run({ playedTogether: true }, "marked played together")}
      >
        Played<span className="max-sm:hidden"> Together</span>
      </button>
      <form method="post" action="/api/export" className="contents">
        <input type="hidden" name="ids" value={[...s.selected].join(",")} />
        <button type="submit" className="button-secondary max-sm:hidden" disabled={!n || pending}>
          Export<span className="max-sm:hidden"> Selected</span>
        </button>
      </form>
      {n && n < s.loaded ? (
        <button type="button" className="button-secondary max-sm:hidden" onClick={s.selectAll}>
          Select All {s.loaded}
        </button>
      ) : null}
      <p className="select-bar-done text-sm" aria-live="polite">
        {done && "error" in done ? <span className="text-error">{done.error}</span> : null}
        {done && "text" in done ? (
          <>
            {done.text}.{" "}
            <button
              type="button"
              className="link"
              onClick={() =>
                start(async () => {
                  const r = await undoBulkUpdate(done.before).catch(() => ({ ok: false }));
                  setDone(r.ok ? null : { error: "Couldn't undo. Try again." });
                })
              }
            >
              Undo
            </button>
          </>
        ) : null}
      </p>
      <button
        type="button"
        className="button-secondary ml-auto"
        title="Esc"
        onClick={() => {
          s.clear();
          setDone(null);
        }}
      >
        {n ? "Clear" : "Done"}
      </button>
    </div>
  );
}
