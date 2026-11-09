"use client";

import { useEffect } from "react";

// The directory's status headings (Homies, Let's play…) pin under the
// pinned filter bar as you scroll, each for its own section: the next one
// pushes it away. This keeps --bar-h (the pinned bar's height, which
// changes when filters open or the layout shifts) on the page for their
// sticky top, and marks a heading data-pinned while it's stuck, so it gets
// solid ground and the cards slide under it.
export function StickyGroups() {
  useEffect(() => {
    const root = document.documentElement;
    // Wide screens pin the whole bar; phones pin only its search row.
    const bar = () =>
      [...document.querySelectorAll<HTMLElement>(".directory-bar, .bar-search")].find(
        (el) => getComputedStyle(el).position === "sticky",
      );
    let frame = 0;
    const update = () => {
      frame = 0;
      root.style.setProperty("--bar-h", `${bar()?.getBoundingClientRect().height ?? 0}px`);
      for (const el of document.querySelectorAll<HTMLElement>(".group-head")) {
        const top = parseFloat(getComputedStyle(el).top) || 0;
        el.toggleAttribute("data-pinned", scrollY > 0 && el.getBoundingClientRect().top <= top + 0.5);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    const el = bar();
    if (el) ro.observe(el);
    // More cards loaded, a filter changed: new headings.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
