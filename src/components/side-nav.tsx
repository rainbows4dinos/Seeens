"use client";

import { useEffect, useState } from "react";

export type SideNavSection = { id: string; label: string };

// "On this page" for long pages (About, Help): a list beside the content from
// 64rem, sticky as you scroll, marking the section you're reading.
export function SideNav({ sections }: { sections: SideNavSection[] }) {
  const [current, setCurrent] = useState<string | null>(null);
  const ids = sections.map((s) => s.id).join(" ");

  useEffect(() => {
    const headings = ids
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    // The section whose heading most recently passed a line near the top
    // (just under the header, where a jump lands it) is the one being read.
    const update = () => {
      const line = (headings[0] ? parseFloat(getComputedStyle(headings[0]).scrollMarginTop) || 0 : 0) + 48;
      let at: string | null = null;
      for (const h of headings) if (h.getBoundingClientRect().top <= line) at = h.id;
      // At the very bottom, the last section counts even if its heading can't reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2)
        at = headings.at(-1)?.id ?? at;
      setCurrent(at);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids]);

  return (
    <nav aria-labelledby="side-nav-title" className="side-nav">
      <p id="side-nav-title" className="caption">
        On this page
      </p>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={current === s.id ? "location" : undefined}>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Narrower than 64rem, where there's no room beside the content: a line of links under the intro. */
export function InlineNav({ sections }: { sections: SideNavSection[] }) {
  return (
    <nav aria-label="On this page" className="inline-nav">
      <span className="caption">On this page</span>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="link">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
