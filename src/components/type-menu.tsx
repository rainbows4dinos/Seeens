"use client";

import Link from "next/link";
import { OverflowMenuVertical } from "@carbon/icons-react";
import { useEffect, useRef } from "react";

// Phones only (#122): the type tabs that don't fit sit behind a ⋮ button at
// the end of the row. A <details> menu, so it opens without script; with
// script, Escape and a click outside close it.
export function TypeMenu({ items }: { items: { href: string; label: string; count: number }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const close = (e: Event) => {
      if (!details.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        details.open = false;
        details.querySelector("summary")?.focus();
      } else if (!details.contains(e.target as Node)) {
        details.open = false;
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("click", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("click", close);
    };
  }, []);

  return (
    <details ref={ref} className="type-more">
      <summary aria-label="More types" title="More types">
        <OverflowMenuVertical size={16} aria-hidden="true" />
      </summary>
      <ul className="type-menu">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} onClick={() => ref.current?.removeAttribute("open")}>
              {item.label} <span className="tabular-nums">{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
