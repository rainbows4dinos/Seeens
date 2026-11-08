"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Metronome, PageLoader } from "./metronome";

const SHOW_AFTER_MS = 300;
const GIVE_UP_MS = 15000;

// The busy pointer: while Seeens is waiting on a page, a small metronome rides
// beside the mouse arrow, like the old busy cursors. Only with a mouse over
// the page; otherwise the page loader's own metronome does the job.
//
// Without a mouse over the page, a link waiting shows the page loader instead.
// Waiting means a link was clicked and the new page hasn't arrived, or a page
// loader is on screen. It shows after a beat, so quick loads don't flicker.
export function BusyPointer() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [navigating, setNavigating] = useState(false);
  const [loaderShown, setLoaderShown] = useState(false);
  const [due, setDue] = useState(false);
  const [inside, setInside] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // A new page arrived: done navigating.
  const [prev, setPrev] = useState(pathname + "?" + search);
  if (prev !== pathname + "?" + search) {
    setPrev(pathname + "?" + search);
    setNavigating(false);
  }

  // Internal link clicks start a wait.
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
    // Capture, so this sees the click before the router's Link handles it.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!navigating) return;
    const t = setTimeout(() => setNavigating(false), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [navigating]);

  // A page loader on screen counts too.
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

  // Follow the mouse; touch and pens don't get one.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      setInside(true);
      const el = ref.current;
      if (el) el.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 16}px)`;
    };
    const leave = () => setInside(false);
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);

  const waiting = navigating || loaderShown;
  useEffect(() => {
    const root = document.documentElement;
    if (!waiting) {
      root.removeAttribute("data-navigating");
      return;
    }
    const t = setTimeout(() => {
      if (navigating) root.setAttribute("data-navigating", "");
      setDue(true);
    }, SHOW_AFTER_MS);
    return () => {
      clearTimeout(t);
      setDue(false);
    };
  }, [waiting, navigating]);

  const canPoint =
    inside &&
    typeof window !== "undefined" &&
    matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const show = waiting && due && canPoint;

  // One metronome at a time: the page loader's steps aside.
  useEffect(() => {
    const root = document.documentElement;
    if (show) root.setAttribute("data-busy-pointer", "");
    else root.removeAttribute("data-busy-pointer");
  }, [show]);

  return (
    <>
      <div ref={ref} className="busy-pointer" data-on={show ? "" : undefined} aria-hidden="true">
        <Metronome size={32} />
      </div>
      {/* No mouse to ride along with (a phone, the keyboard): the page loader
          shows over the old page instead. */}
      {navigating && due && !canPoint ? (
        <div className="nav-loader">
          <PageLoader />
        </div>
      ) : null}
    </>
  );
}
