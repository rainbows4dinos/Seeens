"use client";

import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { SettingsAdjust } from "@carbon/icons-react";
import { useEffect, useId, useRef, useState } from "react";

// The directory's search and filter form. A plain GET form (the URL stays
// shareable), navigated client-side by next/form. Menus apply as soon as
// they change; the name search still waits for Enter or the button.
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
  }, [query]);

  return (
    <Form
      {...props}
      ref={ref}
      action="/"
      scroll={false}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
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
  /** Controls after Filters, behind a rule (the List/Cards toggle). */
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
      <div className="flex items-center gap-2">
        {search}
        <button
          type="button"
          className={`${lit ? "button-primary" : "button-secondary"} shrink-0 max-sm:px-2.5`}
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
        {after ? (
          <>
            <span className="bar-divider" aria-hidden="true" />
            {after}
          </>
        ) : null}
      </div>
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </>
  );
}
