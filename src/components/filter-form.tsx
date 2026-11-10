"use client";

import Form from "next/form";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Close, SettingsAdjust } from "@carbon/icons-react";
import { useEffect, useId, useRef, useState } from "react";

// Under 40rem the filters open as a sheet from the bottom of the screen.
const PHONE = "(width < 40rem)";

// The directory's search and filter form. A plain GET form (the URL stays
// shareable), navigated client-side by next/form. Menus apply as soon as
// they change (and so would any checkbox); the name search still waits
// for Enter or the button.
export function AutoFilterForm({
  children,
  action = "/",
  ...props
}: Omit<React.ComponentProps<typeof Form>, "action" | "onChange"> & { action?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const params = useSearchParams();
  const query = params.toString();

  // Client navigation keeps the fields mounted, so after "Clear filters" or
  // a link they would still show old values (and resubmit them). Match the
  // URL without remounting, so focus stays where it is.
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const now = new URLSearchParams(query);
    form
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[type=search][name], select[name]")
      .forEach((el) => {
        const want = now.get(el.name) ?? "";
        if (el.value !== want) el.value = want;
      });
    form.querySelectorAll<HTMLInputElement>("input[type=checkbox][name]").forEach((el) => {
      el.checked = now.getAll(el.name).includes(el.value);
    });
  }, [query]);

  return (
    <Form
      {...props}
      ref={ref}
      action={action}
      scroll={false}
      onChange={(e) => {
        const t = e.target;
        if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type === "checkbox")) {
          e.currentTarget.requestSubmit();
        }
      }}
    >
      {children}
    </Form>
  );
}

// The search row and the filter fields under it. "Filters" toggles the
// fields; they start open when the URL has filters, then stay however the
// person left them (a plain open={…} would snap shut when the last filter
// is cleared). On phones the fields open as a sheet over the list instead,
// always closed to start, with what else there is to sort by, Clear, and a
// button that shows the results (they update behind it as you pick).
export function FilterDisclosure({
  initialOpen,
  active,
  search,
  after,
  sheetExtra,
  clearHref,
  showLabel,
  children,
}: {
  initialOpen: boolean;
  /** How many filters are set, shown on the button while the fields are hidden. */
  active: number;
  search: React.ReactNode;
  /** Controls pinned to the right end of the row (Cards/List, and Add on phones). */
  after?: React.ReactNode;
  /** Phones only, in the sheet under the fields: Cards/List, hidden and archived ones. */
  sheetExtra?: React.ReactNode;
  /** The sheet's Clear, when anything's filtered. */
  clearHref?: string | null;
  /** The sheet's close button, like "Show 6 bands". */
  showLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [sheet, setSheet] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function closeSheet() {
    setSheet(false);
    button.current?.focus();
  }

  // The sheet: Escape closes it, focus starts on it, and the page behind
  // doesn't scroll.
  useEffect(() => {
    if (!sheet) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // A combobox's Escape closes its list first.
      if (e.key === "Escape" && !e.defaultPrevented) closeSheet();
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [sheet]);

  // Paper by default; ink while the fields are open or a filter is set, so
  // ink means something is in play.
  const lit = sheet || open || active > 0;
  return (
    <>
      <div className="bar-row">
        {search}
        <button
          ref={button}
          type="button"
          className={`bar-filters ${lit ? "button-primary" : "button-secondary"} shrink-0 ${
            // Icon-only on phones until a filter is set; then the count shows too.
            active ? "max-sm:px-2" : "button-icon-phone"
          }`}
          aria-expanded={sheet || open}
          aria-controls={panelId}
          onClick={() => (window.matchMedia(PHONE).matches ? setSheet((o) => !o) : setOpen((o) => !o))}
        >
          <SettingsAdjust size={16} aria-hidden="true" />
          {/* Phones show the icon and count; the name is still read out. */}
          <span className="max-sm:sr-only">Filters</span>
          {active ? (
            <span className="tabular-nums">
              ({active}
              <span className="sr-only"> set</span>)
            </span>
          ) : null}
        </button>
        {/* Search and Filters hold the left; the layout switch sits right. */}
        {after ? <div className="bar-after ml-auto flex shrink-0 gap-2">{after}</div> : null}
      </div>
      {sheet ? <div className="sheet-backdrop" aria-hidden="true" onClick={closeSheet} /> : null}
      {/* Closed: a class, not `hidden`, so the bar can always show the
          fields from 1280 (Tailwind makes [hidden] !important). */}
      <div
        ref={panel}
        id={panelId}
        className={["bar-panel", open ? "" : "bar-panel-closed", sheet ? "bar-sheet-open" : ""].join(" ")}
        {...(sheet ? { role: "dialog", "aria-modal": true, "aria-labelledby": titleId, tabIndex: -1 } : {})}
      >
        <div className="sheet-head">
          <h2 id={titleId} className="font-medium">
            Filters
          </h2>
          <button type="button" className="button-secondary button-icon" aria-label="Close" onClick={closeSheet}>
            <Close size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
        {sheetExtra ? <div className="sheet-extra">{sheetExtra}</div> : null}
        <div className="sheet-foot">
          {clearHref ? (
            <Link href={clearHref} scroll={false} className="button-secondary">
              Clear
            </Link>
          ) : null}
          <button type="button" className="button-primary flex-1 justify-center" onClick={closeSheet}>
            {showLabel}
          </button>
        </div>
      </div>
    </>
  );
}
