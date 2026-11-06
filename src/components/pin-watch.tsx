"use client";

import { useEffect } from "react";

// Marks sticky elements with data-pinned while they're stuck under the
// pinned App Header, so CSS can style the pinned state (the directory bar's
// bottom rule). Each element sits 1px higher than the header's bottom edge
// (top: calc(var(--header-h) - 1px)), so once it pins, one pixel of it is
// tucked under the header and the observer sees it as not fully visible.
export function PinWatch({ selector }: { selector: string }) {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>(selector)];
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          const sticky = getComputedStyle(el).position === "sticky";
          el.toggleAttribute("data-pinned", sticky && e.intersectionRatio < 1 && e.boundingClientRect.top < header);
        }
      },
      // The header covers the top of the window, so watch the area under it.
      { threshold: [1], rootMargin: `-${header}px 0px 0px 0px` },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector]);
  return null;
}
