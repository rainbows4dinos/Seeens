"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const ITEMS = [
  { href: "/", label: "My Network", match: (p: string) => p === "/" || p.startsWith("/connections") || p === "/export" },
  { href: "/follow-ups", label: "Follow-ups", match: (p: string) => p.startsWith("/follow-ups") },
  { href: "/scenes", label: "Scenes", match: (p: string) => p.startsWith("/scenes") },
  // Every band's shared records (#192).
  { href: "/directory", label: "Directory", match: (p: string) => p.startsWith("/directory") },
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
