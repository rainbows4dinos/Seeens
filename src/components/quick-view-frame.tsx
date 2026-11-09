"use client";

import { ChevronDown, ChevronUp, Close } from "@carbon/icons-react";
import { usePathname, useRouter } from "next/navigation";
import { LogForm } from "@/components/outreach-panel";
import {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  // The panel's status, for the number keys. QuickStatus registers it.
  const statusKeysRef = useRef<StatusSetter | null>(null);

  const closeOnEscape = useEffectEvent(close);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented || inField(e)) return;
      closeOnEscape();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <LogContext value={{ logging, setLogging }}>
      <StatusKeysContext value={statusKeysRef}>
        <aside ref={aside} className="quick-view" aria-label="Quick view">
          <div className="quick-view-title">
            <span className="font-semibold">Quick view</span>
            <span className="quick-view-buttons">
              {/* It reads the URL, so it waits for the request (cacheComponents). */}
              <Suspense fallback={<StepButtons />}>
                <Steps statusKeysRef={statusKeysRef} />
              </Suspense>
              <button
                type="button"
                className="quick-view-close"
                onClick={close}
                title="Close (Esc)"
                aria-keyshortcuts="Escape"
              >
                <Close size={16} aria-hidden="true" />
                <span className="sr-only">Close quick view</span>
              </button>
            </span>
          </div>
          {children}
        </aside>
      </StatusKeysContext>
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
    <button
      type="button"
      className="button-secondary"
      aria-expanded={open}
      onClick={() => setLogging(open ? null : connectionId)}
    >
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

// Number keys 1 to 6, in the dropdown's order with No status last (#244).
type StatusSetter = (status: (typeof KEY_STATUSES)[number]) => void;
const KEY_STATUSES = ["homies", "lets_play", "prospect", "neutral", "avoid", null] as const;
const StatusKeysContext = createContext<{ current: StatusSetter | null } | null>(null);

/** Lets the number keys set this status while it's in the quick view. */
export function useStatusKeys(set: StatusSetter) {
  const keysRef = useContext(StatusKeysContext);
  const latest = useEffectEvent(set);
  useEffect(() => {
    if (!keysRef) return;
    const mine: StatusSetter = (st) => latest(st);
    keysRef.current = mine;
    return () => {
      if (keysRef.current === mine) keysRef.current = null;
    };
  }, [keysRef]);
}

// The listings before and after the open one, in the order the directory
// shows them: whatever page, tab, filters, search, and groups are on screen.
// Rows and cards carry data-listing. If the open one leaves the list (its
// status moved it out of a filter), its old neighbors still count.
function useNeighbors() {
  const openId = usePathname().match(/^\/connections\/([^/]+)$/)?.[1] ?? null;
  const [ids, setIds] = useState<string[]>([]);
  // The last list the open one was in.
  const [known, setKnown] = useState<string[]>([]);
  if (openId && ids.includes(openId) && known !== ids) setKnown(ids);

  useEffect(() => {
    const shell = document.querySelector(".directory-shell");
    if (!shell) return;
    const read = () => {
      const now = [...shell.querySelectorAll<HTMLElement>("[data-listing]")].map((el) => el.dataset.listing!);
      setIds((was) => (was.join() === now.join() ? was : now));
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(shell, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);

  // Show the open one in the list.
  useEffect(() => {
    if (!openId) return;
    const el = document.querySelector<HTMLElement>(`.directory-shell [data-listing="${CSS.escape(openId)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [openId]);

  if (!openId) return { prev: null, next: null };
  const i = ids.indexOf(openId);
  if (i >= 0) return { prev: ids[i - 1] ?? null, next: ids[i + 1] ?? null };
  // Gone from the list: step from where it was.
  const was = known.indexOf(openId);
  if (was < 0) return { prev: null, next: null };
  const present = new Set(ids);
  return {
    prev:
      known
        .slice(0, was)
        .reverse()
        .find((id) => present.has(id)) ?? null,
    next: known.slice(was + 1).find((id) => present.has(id)) ?? null,
  };
}

// Keys in a field or an open dialog belong to that field or dialog.
function inField(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return Boolean(t?.closest("input, textarea, select, [contenteditable], dialog[open]"));
}

// Previous and Next (#244), with J and K, and 1 to 6 for the status.
function Steps({ statusKeysRef }: { statusKeysRef: { current: StatusSetter | null } }) {
  const router = useRouter();
  const { prev, next } = useNeighbors();
  function go(id: string | null) {
    if (id) router.replace(`/connections/${id}`, { scroll: false });
  }

  const onKeyEvent = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || inField(e)) return;
    const key = e.key.toLowerCase();
    if (key === "j" && next) {
      e.preventDefault();
      go(next);
    } else if (key === "k" && prev) {
      e.preventDefault();
      go(prev);
    } else if (/^[1-6]$/.test(key) && statusKeysRef.current) {
      e.preventDefault();
      statusKeysRef.current(KEY_STATUSES[Number(key) - 1]);
    }
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onKeyEvent(e);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return <StepButtons onPrev={prev ? () => go(prev) : undefined} onNext={next ? () => go(next) : undefined} />;
}

/** The two buttons; without handlers they're disabled (also the loading state). */
function StepButtons({ onPrev, onNext }: { onPrev?: () => void; onNext?: () => void }) {
  return (
    <>
      <button
        type="button"
        className="quick-view-close"
        onClick={onPrev}
        disabled={!onPrev}
        title="Previous (K)"
        aria-keyshortcuts="K"
      >
        <ChevronUp size={16} aria-hidden="true" />
        <span className="sr-only">Previous listing</span>
      </button>
      <button
        type="button"
        className="quick-view-close"
        onClick={onNext}
        disabled={!onNext}
        title="Next (J)"
        aria-keyshortcuts="J"
      >
        <ChevronDown size={16} aria-hidden="true" />
        <span className="sr-only">Next listing</span>
      </button>
    </>
  );
}
