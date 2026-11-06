"use client";

import { useEffect } from "react";

// Marks sticky elements with data-pinned while they're stuck, so CSS can
// style the pinned state (the directory bar's bottom rule, the back
// button's shadow). Each is watched against the area below its own sticky
// top (under the pinned App Header, and any gap): pinned, one pixel of it
// is tucked above that line, so it's no longer fully visible there.
export function PinWatch({ selector }: { selector: string }) {
  useEffect(() => {
    const observers = [...document.querySelectorAll<HTMLElement>(selector)].map((el) => {
      const top = parseFloat(getComputedStyle(el).top) || 0;
      const observer = new IntersectionObserver(
        ([e]) => {
          const sticky = getComputedStyle(el).position === "sticky";
          el.toggleAttribute("data-pinned", sticky && e.intersectionRatio < 1 && e.boundingClientRect.top < top + 1);
        },
        { threshold: [1], rootMargin: `${-Math.ceil(top + 1)}px 0px 0px 0px` },
      );
      observer.observe(el);
      return observer;
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [selector]);
  return null;
}
