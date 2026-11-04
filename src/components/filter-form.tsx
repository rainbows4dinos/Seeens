"use client";

import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { SettingsAdjust } from "@carbon/icons-react";
import { useEffect, useId, useRef, useState } from "react";

// The directory's search and filter form. A plain GET form (the URL stays
// shareable), navigated client-side by next/form. Menus apply as soon as
// they change, and so does the Archived checkbox; the name search still waits
// for Enter or the button.
export function AutoFilterForm({
  children,
  ...props
}: Omit<React.ComponentProps<typeof Form>, "action" | "onChange">) {
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
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[type=search][name], select[name]").forEach((el) => {
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
      action="/"
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
// is cleared).
export function FilterDisclosure({
  initialOpen,
  active,
  search,
  after,
  children,
}: {
  initialOpen: boolean;
  /** How many filters are set, shown on the button while the fields are hidden. */
  active: number;
  search: React.ReactNode;
  /** Controls pinned to the right end of the row (Cards/List, and Add on phones). */
  after?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  const panelId = useId();
  // Paper by default; ink while the fields are open or a filter is set, so
  // ink means something is in play.
  const lit = open || active > 0;
  return (
    <>
      <div className="bar-row">
        {search}
        <button
          type="button"
          className={`bar-filters ${lit ? "button-primary" : "button-secondary"} shrink-0 ${
            // Icon-only on phones until a filter is set; then the count shows too.
            active ? "max-sm:px-2" : "button-icon-phone"
          }`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
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
      {/* Closed: a class, not `hidden`, so the bar can always show the
          fields from 1280 (Tailwind makes [hidden] !important). */}
      <div id={panelId} className={open ? "bar-panel" : "bar-panel bar-panel-closed"}>
        {children}
      </div>
    </>
  );
}
