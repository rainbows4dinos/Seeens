"use client";

import { useState, useTransition } from "react";
import { offline } from "@/lib/offline";
import { setKeepPrivate } from "@/lib/connections/sharing-actions";

// Keep one record private (phase 2): when the directory opens, only this
// band will see it. Saves on change. Pinned at the top of the record page.
export function KeepPrivate({ id, band, initial }: { id: string; band: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    setOn(next);
    setError("");
    startTransition(async () => {
      const result = await setKeepPrivate([id], next).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
      if (result.error) {
        setOn(!next);
        setError(result.error);
      }
    });
  };

  // Pinned beside the back button: the explanation is read with the box,
  // and shows on hover.
  const hint = on
    ? `Only ${band} will see this record when Seeens opens up as one directory.`
    : `Shared: other bands will see this record when Seeens opens up as one directory. Status, notes, and contacts stay ${band}'s.`;
  return (
    <>
      <label className="choice" title={hint}>
        <input type="checkbox" checked={on} disabled={pending} onChange={(e) => change(e.target.checked)} aria-describedby="keep-private-hint" />
        <span>Keep Private</span>
      </label>
      <span id="keep-private-hint" className="sr-only">
        {hint}
      </span>
      <p role="alert" className="keep-private-error empty:hidden">
        {error ? `Error: ${error}` : ""}
      </p>
    </>
  );
}
