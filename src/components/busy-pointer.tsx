"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { POINTER_KEY, readSavedPointer } from "@/lib/saved-pointer";
import { Metronome, PageLoader } from "./metronome";

const SIZE = 32;
// The arrow's tip sits on the metronome's top-left corner (the drawing starts
// 10 and 5 units into its 40-unit box).
const HOTSPOT_X = (10 / 40) * SIZE;
const HOTSPOT_Y = (5 / 40) * SIZE;
const SHOW_AFTER_MS = 300;
// Once out, it stays at least one full swing, so a load that ends just after
// it appears doesn't blink it on and off.
const MIN_SHOW_MS = 1000;
// Clicked a link, then the new page's loader: one wait, not two.
const SETTLE_MS = 200;
const GIVE_UP_MS = 15000;

// Where the mouse last was. Outside the component, so it survives remounts
// and the metronome lands on the pointer even before it moves again.
const last = { x: -100, y: -100, seen: false };

// Across a reload: where the mouse was as the page went away.
if (typeof window !== "undefined") {
  const saved = readSavedPointer();
  if (saved) Object.assign(last, { x: saved.x, y: saved.y, seen: true });
}

// The busy pointer: while Seeens is waiting on a page, the mouse pointer
// becomes a swinging metronome, like the old busy cursors.
//
// Waiting means a link was clicked and the new page hasn't arrived, or a page
// loader is on screen. Whoever has the metronome when a wait starts keeps it
// to the end, so it never jumps: the pointer, when there's a mouse whose
// position is known; otherwise the page loader (a phone, the keyboard, or a
// fresh page the mouse hasn't moved over yet), and a link still waiting shows
// one over the old page. The pointer shows after a beat, so quick loads
// don't flicker.
export function BusyPointer() {
  const [navigating, setNavigating] = useState(false);
  const [loaderShown, setLoaderShown] = useState(false);
  const [settling, setSettling] = useState(false);
  const [due, setDue] = useState(false);
  // true: a mouse is over the page; false: it left; null: not moved over this
  // page yet, so its position isn't known.
  const [mouse, setMouse] = useState<boolean | null>(last.seen ? true : null);
  const ref = useRef<HTMLDivElement>(null);
  // The address when the link was clicked: once it changes, the page arrived.
  const from = useRef("");

  // Internal link clicks start a wait. Capture, so this sees the click before
  // the router's Link handles it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      from.current = location.href;
      setNavigating(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!navigating) return;
    const t = setTimeout(() => setNavigating(false), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [navigating]);

  // A page loader on screen counts too (not the one this shows itself).
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      if (from.current && location.href !== from.current) {
        from.current = "";
        setNavigating(false);
      }
      // Only ones on screen: earlier pages stay in the page, hidden.
      const loaders = document.querySelectorAll<HTMLElement>(".page-loader:not(.nav-loader .page-loader)");
      setLoaderShown([...loaders].some((el) => el.checkVisibility()));
    };
    check();
    const mo = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(check);
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "hidden", "class"],
    });
    // Back and forward land here too.
    const pop = () => {
      from.current = "";
      setNavigating(false);
    };
    addEventListener("popstate", pop);
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener("popstate", pop);
    };
  }, []);

  // Waiting starts at once and ends after a short settle, so the hand-off
  // from a clicked link to the new page's loader doesn't restart it.
  const raw = navigating || loaderShown;
  const [prevRaw, setPrevRaw] = useState(raw);
  if (prevRaw !== raw) {
    setPrevRaw(raw);
    if (!raw) setSettling(true);
  }
  useEffect(() => {
    if (!settling) return;
    const t = setTimeout(() => setSettling(false), SETTLE_MS);
    return () => clearTimeout(t);
  }, [settling]);
  const waiting = raw || settling;

  if (!waiting && due) setDue(false);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setDue(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [waiting]);

  // Follow the mouse; touch and pens don't get one. Any mouse event counts,
  // the click itself included, so it's in place without another move.
  useEffect(() => {
    const track = (e: PointerEvent | MouseEvent) => {
      // Mouse only: not touch or pens, and not a link opened with the keyboard
      // (its click has no real position).
      if ("pointerType" in e && e.pointerType !== "mouse") return;
      if (e.type === "click" && e.detail === 0) return;
      last.x = e.clientX;
      last.y = e.clientY;
      last.seen = true;
      const el = ref.current;
      if (el) el.style.transform = `translate(${last.x - HOTSPOT_X}px, ${last.y - HOTSPOT_Y}px)`;
      // Straight on the page, not after a render: a loader that appears next
      // frame is already without its metronome (see globals.css).
      document.documentElement.toggleAttribute("data-mouse", pointerDevice());
      setMouse(true);
    };
    const leave = () => {
      document.documentElement.removeAttribute("data-mouse");
      last.seen = false;
      setMouse(false);
    };
    // Leaving the page: remember where the mouse is, if it's over the page.
    const away = () => {
      try {
        if (last.seen) sessionStorage.setItem(POINTER_KEY, JSON.stringify({ x: last.x, y: last.y, t: Date.now() }));
        else sessionStorage.removeItem(POINTER_KEY);
      } catch {}
    };
    addEventListener("pagehide", away);
    const opts = { passive: true, capture: true } as const;
    document.addEventListener("pointermove", track, opts);
    document.addEventListener("pointerdown", track, opts);
    document.addEventListener("pointerover", track, opts);
    document.addEventListener("click", track, opts);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      document.removeEventListener("pointermove", track, opts);
      document.removeEventListener("pointerdown", track, opts);
      document.removeEventListener("pointerover", track, opts);
      document.removeEventListener("click", track, opts);
      document.documentElement.removeEventListener("mouseleave", leave);
      removeEventListener("pagehide", away);
    };
  }, []);

  const canPoint = mouse === true && pointerDevice();

  // Once out, it stays a full beat.
  const [held, setHeld] = useState(false);
  const due2 = waiting && due;
  const [prevDue, setPrevDue] = useState(due2);
  if (prevDue !== due2) {
    setPrevDue(due2);
    if (due2) setHeld(true);
  }
  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(false), MIN_SHOW_MS);
    return () => clearTimeout(t);
  }, [held]);

  // Who has the metronome for this wait, decided when it starts.
  const active = waiting || held;
  const [owner, setOwner] = useState<"pointer" | "page" | null>(null);
  const [prevActive, setPrevActive] = useState(false);
  if (prevActive !== active) {
    setPrevActive(active);
    setOwner(active ? (canPoint ? "pointer" : "page") : null);
  }
  const show = owner === "pointer" && mouse === true && (due2 || held);

  useLayoutEffect(() => {
    // Put it on the pointer before it shows.
    const el = ref.current;
    if (show && el) el.style.transform = `translate(${last.x - HOTSPOT_X}px, ${last.y - HOTSPOT_Y}px)`;
    const root = document.documentElement;
    root.toggleAttribute("data-page-owns", owner === "page");
    root.toggleAttribute("data-busy-pointer-on", show);
    root.toggleAttribute("data-navigating", navigating && due);
  }, [owner, show, navigating, due]);

  return (
    <>
      <div ref={ref} className="busy-pointer" data-on={show ? "" : undefined} aria-hidden="true">
        <Metronome size={SIZE} />
      </div>
      {navigating && due && owner === "page" ? (
        <div className="nav-loader">
          <PageLoader />
        </div>
      ) : null}
    </>
  );
}

function pointerDevice() {
  return (
    matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
