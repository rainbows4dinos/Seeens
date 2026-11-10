"use client";

import { Checkmark, ChevronDown } from "@carbon/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useRef } from "react";

const ITEMS = [
  {
    href: "/",
    label: "Network",
    match: (p: string) => p === "/" || p.startsWith("/connections") || p === "/export",
  },
  // Every band's shared records (#192), for finding who you don't know yet.
  { href: "/directory", label: "Explore", match: (p: string) => p.startsWith("/directory") },
  { href: "/follow-ups", label: "Follow-ups", match: (p: string) => p.startsWith("/follow-ups") },
  { href: "/scenes", label: "Scenes", match: (p: string) => p.startsWith("/scenes") },
];

type Layout = "row" | "menu";

// Nav chips (Figma Nav Chip): the current section inverts. "row" is the
// desktop header; "menu" is the stacked, right-aligned list in the mobile
// menu. Reading the path is request data, so the static fallback renders
// first.
export function MainNav({ layout = "row" }: { layout?: Layout }) {
  return (
    <Suspense fallback={<Chips pathname={null} layout={layout} />}>
      <CurrentChips layout={layout} />
    </Suspense>
  );
}

function CurrentChips({ layout }: { layout: Layout }) {
  return <Chips pathname={usePathname()} layout={layout} />;
}

function Chips({ pathname, layout }: { pathname: string | null; layout: Layout }) {
  const menu = layout === "menu";
  return (
    <nav aria-label="Main" className={menu ? "flex flex-col gap-4" : "flex flex-wrap gap-2"}>
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={menu ? "nav-chip w-full justify-end" : "nav-chip"}
          aria-current={pathname && item.match(pathname) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// Phones: the main nav as a select-like menu in the header, showing where
// you are (the account things live behind the burger). A <details> of real
// links, so it works before the page's script loads and links open in new
// tabs. Escape, a tap outside, or picking a page closes it.
export function NavPicker() {
  return (
    <Suspense fallback={<Picker pathname={null} />}>
      <CurrentPicker />
    </Suspense>
  );
}

function CurrentPicker() {
  return <Picker pathname={usePathname()} />;
}

function Picker({ pathname }: { pathname: string | null }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const listId = useId();
  const current = pathname ? ITEMS.find((i) => i.match(pathname)) : undefined;

  // A new page closes it.
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (details.open && !details.contains(e.target as Node)) details.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <details ref={ref} className="nav-picker">
      <summary className="field" aria-controls={listId}>
        <span className="sr-only">Go to page. Current: </span>
        <span className="truncate">{current?.label ?? "Go To"}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <nav id={listId} aria-label="Main" className="nav-picker-menu">
        <ul>
          {ITEMS.map((item) => {
            const here = pathname ? item.match(pathname) : false;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={here ? "page" : undefined}
                  onClick={() => ref.current && (ref.current.open = false)}
                >
                  {item.label}
                  {here ? <Checkmark size={16} aria-hidden="true" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </details>
  );
}
