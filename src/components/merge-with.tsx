"use client";

import { useRef, useState } from "react";
import { Combobox, type ComboOption } from "@/components/combobox";

// "Merge with…" on a profile (#169): pick the duplicates of this one, then
// compare them on the merge page. Nothing changes until that page's Merge.
export function MergeWith({ id, name, options }: { id: string; name: string; options: ComboOption[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const startRef = useRef<HTMLButtonElement>(null);

  if (!open) {
    return (
      <button ref={startRef} type="button" className="button-secondary self-start" onClick={() => setOpen(true)}>
        Merge with…
      </button>
    );
  }

  return (
    <form action="/merge" method="get" className="panel order-last flex basis-full flex-col gap-3 p-4">
      <input type="hidden" name="ids" value={id} />
      <Combobox
        label={`Merge ${name} with…`}
        hint="Pick the ones it duplicates. You'll compare them before anything changes."
        name="ids"
        options={options}
        onChange={(values) => setPicked(values)}
        autoFocus
      />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="button-primary" disabled={!picked.length}>
          Compare
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            setOpen(false);
            setPicked([]);
            requestAnimationFrame(() => startRef.current?.focus());
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
