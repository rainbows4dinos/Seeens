"use client";

import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

// Starts open when the URL has filters, then stays however the person left
// it. A plain open={…} would snap shut when the last filter is cleared.
export function FilterPanel({
  initialOpen,
  summary,
  children,
}: {
  initialOpen: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {summary}
      {children}
    </details>
  );
}
