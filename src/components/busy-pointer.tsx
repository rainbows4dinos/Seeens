"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Metronome, PageLoader } from "./metronome";

const SIZE = 32;
// The arrow's tip sits on the metronome's top-left corner (the drawing starts
// 10 and 5 units into its 40-unit box).
const HOTSPOT_X = (10 / 40) * SIZE;
const HOTSPOT_Y = (5 / 40) * SIZE;
const SHOW_AFTER_MS = 300;
// Clicked a link, then the new page's loader: one wait, not two.
const SETTLE_MS = 200;
const GIVE_UP_MS = 15000;

// The busy pointer: while Seeens is waiting on a page, the mouse pointer
// becomes a swinging metronome, like the old busy cursors. Only with a mouse
// over the page; otherwise the page loader's own metronome does the job, and
// a link still waiting shows one over the old page.
//
// Waiting means a link was clicked and the new page hasn't arrived, or a page
// loader is on screen. It shows after a beat, so quick loads don't flicker.
export function BusyPointer() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [navigating, setNavigating] = useState(false);
  const [loaderShown, setLoaderShown] = useState(false);
  const [settling, setSettling] = useState(false);
  const [due, setDue] = useState(false);
  const [mouse, setMouse] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const at = useRef({ x: -100, y: -100 });

  // A new page arrived: done navigating.
  const here = pathname + "?" + search;
  const [prev, setPrev] = useState(here);
  if (prev !== here) {
    setPrev(here);
    setNavigating(false);
  }

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
      setLoaderShown(Boolean(document.querySelector(".page-loader:not(.nav-loader .page-loader)")));
    };
    check();
    const mo = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(check);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
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

  // Follow the mouse; touch and pens don't get one.
  useEffect(() => {
    const place = () => {
      const el = ref.current;
      if (el) el.style.transform = `translate(${at.current.x - HOTSPOT_X}px, ${at.current.y - HOTSPOT_Y}px)`;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      at.current = { x: e.clientX, y: e.clientY };
      place();
      setMouse(true);
    };
    const leave = () => setMouse(false);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", move);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);

  const canPoint =
    mouse &&
    typeof window !== "undefined" &&
    matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The pointer will carry the metronome: page loaders drop theirs right away,
  // so two never tick at once.
  const pointerMode = waiting && canPoint;
  const show = pointerMode && due;

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-busy-pointer", pointerMode);
    root.toggleAttribute("data-busy-pointer-on", show);
    root.toggleAttribute("data-navigating", navigating && due);
  }, [pointerMode, show, navigating, due]);

  return (
    <>
      <div ref={ref} className="busy-pointer" data-on={show ? "" : undefined} aria-hidden="true">
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
