"use client";

import { useEffect, useRef, type ReactNode } from "react";

// The profile's name beside the pinned Back button, shown once the page's
// big heading has scrolled up under the header and the button. Hidden from
// screen readers: the heading is the name for them.
export function PinnedName({ headingId, children }: { headingId: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const heading = document.getElementById(headingId);
    const el = ref.current;
    if (!heading || !el) return;
    // The pinned row's bottom edge: the header, the gap, and the button.
    const css = getComputedStyle(document.documentElement);
    const below = (parseFloat(css.getPropertyValue("--header-h")) || 0) + 12 + 36;
    const observer = new IntersectionObserver(
      ([e]) => el.toggleAttribute("data-shown", !e.isIntersecting && e.boundingClientRect.top < below),
      { rootMargin: `-${below}px 0px 0px 0px` },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [headingId]);

  return (
    <span ref={ref} className="back-pin-name" aria-hidden="true">
      {children}
    </span>
  );
}
