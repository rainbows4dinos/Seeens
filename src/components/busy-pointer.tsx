"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

// The busy pointer: while Seeens is waiting on a page, the mouse pointer
// becomes a swinging metronome, like the old busy cursors. The system cursor
// turns into a still one (CSS), and this draws the swinging one over it. Only with a mouse
// over the page; otherwise the page loader's own metronome does the job, and
// a link still waiting shows one over the old page.
//
// Waiting means a link was clicked and the new page hasn't arrived, or a page
// loader is on screen. It shows after a beat, so quick loads don't flicker.
export function BusyPointer() {
  const [navigating, setNavigating] = useState(false);
  const [loaderShown, setLoaderShown] = useState(false);
  const [settling, setSettling] = useState(false);
  const [due, setDue] = useState(false);
  // true: a mouse is over the page; false: it left; null: not moved yet since
  // the page loaded (the system cursor still shows where it is).
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
      setMouse(true);
    };
    const leave = () => setMouse(false);
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
    };
  }, []);

  const canPoint =
    mouse !== false &&
    typeof window !== "undefined" &&
    matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The pointer will carry the metronome: page loaders drop theirs right away,
  // so two never tick at once.
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
  const pointerMode = (waiting || held) && canPoint;
  const show = pointerMode && (due2 || held);

  useLayoutEffect(() => {
    // Put it on the pointer before it shows.
    const el = ref.current;
    if (show && el) el.style.transform = `translate(${last.x - HOTSPOT_X}px, ${last.y - HOTSPOT_Y}px)`;
    const root = document.documentElement;
    root.toggleAttribute("data-busy-pointer", pointerMode);
    root.toggleAttribute("data-busy-pointer-on", show);
    root.toggleAttribute("data-navigating", navigating && due);
  }, [pointerMode, show, navigating, due]);

  return (
    <>
      <div ref={ref} className="busy-pointer" data-on={show && mouse ? "" : undefined} aria-hidden="true">
        <Metronome size={SIZE} />
      </div>
      {navigating && due && !canPoint ? (
        <div className="nav-loader">
          <PageLoader />
        </div>
      ) : null}
    </>
  );
}
