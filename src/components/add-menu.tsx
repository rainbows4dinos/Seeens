"use client";

import Link from "next/link";
import { Add, ChevronDown, DocumentImport } from "@carbon/icons-react";
import { useEffect, useRef } from "react";

// Add, split (#350 follow-up): the main part adds one listing; the chevron
// opens a menu with Import a Spreadsheet, since importing is adding in bulk.
// A <details> menu, so it opens without script; with script, Escape and a
// click outside close it.
export function AddMenu({
  href,
  label,
  short,
  className,
}: {
  href: string;
  label: string;
  short: boolean;
  className: string;
}) {
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
    <div className={`add-split ${className}`}>
      <Link
        href={href}
        className="button-primary"
        aria-label={short ? label : undefined}
        title={short ? label : undefined}
      >
        <Add size={16} aria-hidden="true" />
        {short ? "Add" : label}
      </Link>
      <details ref={ref} className="add-more">
        <summary className="button-primary" aria-label="More Ways to Add" title="More Ways to Add">
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <ul className="type-menu">
          <li>
            <Link href="/import" onClick={() => ref.current?.removeAttribute("open")}>
              <DocumentImport size={16} aria-hidden="true" />
              Import a Spreadsheet
            </Link>
          </li>
        </ul>
      </details>
    </div>
  );
}
