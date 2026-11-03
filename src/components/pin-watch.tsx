"use client";

import { useEffect } from "react";

// Marks sticky elements with data-pinned while they're stuck to the top of
// the window, so CSS can style the pinned state (the directory bar's bottom
// rule). Each element sits at top: -1px, so once it pins, one pixel of it is
// off-screen and the observer sees it as no longer fully visible.
export function PinWatch({ selector }: { selector: string }) {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>(selector)];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          const sticky = getComputedStyle(el).position === "sticky";
          el.toggleAttribute("data-pinned", sticky && e.intersectionRatio < 1 && e.boundingClientRect.top < 0);
        }
      },
      { threshold: [1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector]);
  return null;
}
