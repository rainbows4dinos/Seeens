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
// Once out, it stays a moment, so a load that ends just after it appears
// doesn't blink it on and off.
const MIN_SHOW_MS = 400;
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
/**
 * Sent when a link's click didn't navigate after all: it selected the listing
 * (#243), or Show More finished loading in place.
 */
export const STAY_EVENT = "seeens:stay";

// Waiting means a link was clicked (or a search or filter sent) and the new page hasn't arrived, a page
// loader is on screen, or a pressed button is still working (PressedButton). Whoever has the metronome when a wait starts keeps it
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
    // A search or filter form (GET, like the Directory's) loads a page too,
    // whether it's sent with Enter or a menu sends it as it changes.
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "get") return;
      if (form.target && form.target !== "_self") return;
      const url = new URL(form.action, location.href);
      if (url.origin !== location.origin) return;
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form, e.submitter)) if (typeof v === "string") params.append(k, v);
      url.search = params.toString();
      if (url.pathname === location.pathname && url.search === location.search) return;
      from.current = location.href;
      setNavigating(true);
    };
    // A link click that didn't navigate: the wait ends (STAY_EVENT).
    const stay = () => setNavigating(false);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener(STAY_EVENT, stay);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener(STAY_EVENT, stay);
    };
  }, []);

  // The router changes the address after it draws the new page, often with
  // nothing else changing on the page after that, so watch the address itself.
  useEffect(() => {
    if (!navigating) return;
    const arrived = () => {
      if (from.current && location.href !== from.current) {
        from.current = "";
        setNavigating(false);
      }
    };
    const poll = setInterval(arrived, 100);
    const t = setTimeout(() => setNavigating(false), GIVE_UP_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(t);
    };
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
      // A pressed button still working on it (PressedButton) counts too, if
      // it's on screen: a page you left stays in the page, hidden, button and all.
      const working = [...document.querySelectorAll<HTMLElement>("button[data-pressed]:disabled")].some((el) =>
        el.checkVisibility(),
      );
      setLoaderShown(working || [...loaders].some((el) => el.checkVisibility()));
    };
    check();
    const mo = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(check);
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "hidden", "class", "disabled", "data-pressed"],
    });
    // Back and forward land here too. So does a page the browser kept as it
    // was (the back-forward cache, Safari especially): it comes back mid-wait
    // for the link you clicked to leave it, so the wait ends.
    const pop = () => {
      from.current = "";
      setNavigating(false);
    };
    const show = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      pop();
      check();
    };
    addEventListener("popstate", pop);
    addEventListener("pageshow", show);
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener("popstate", pop);
      removeEventListener("pageshow", show);
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
    // A modal dialog (the photo editor) sits in the top layer, above any
    // z-index. As a popover the metronome joins the top layer too, and
    // showing it again puts it above whatever opened since.
    if (el?.showPopover) {
      const open = el.matches(":popover-open");
      if (show) {
        if (open) el.hidePopover();
        el.showPopover();
      } else if (open) el.hidePopover();
    }
    const root = document.documentElement;
    root.toggleAttribute("data-page-owns", owner === "page");
    root.toggleAttribute("data-busy-pointer-on", show);
    root.toggleAttribute("data-navigating", navigating && due);
  }, [owner, show, navigating, due]);

  return (
    <>
      <div ref={ref} popover="manual" className="busy-pointer" data-on={show ? "" : undefined} aria-hidden="true">
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
