"use client";

import { useState, useTransition } from "react";
import { offline } from "@/lib/offline";
import { setKeepPrivate, type SharingResult } from "@/lib/connections/sharing-actions";

// Keep one record private (phase 2): only this band sees it. Saves on change. Pinned at the top of the record page.
export function KeepPrivate({
  id,
  band,
  initial,
  locked = null,
}: {
  id: string;
  band: string;
  initial: boolean;
  /** Why this member can't change it (#195): shown, not editable. */
  locked?: string | null;
}) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    setOn(next);
    setError("");
    startTransition(async () => {
      const result: SharingResult = await setKeepPrivate([id], next).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
      if (result.error) {
        setOn(!next);
        setError(result.error);
      } else if (result.refused) {
        setOn(!next);
        setError("Someone else decides this one.");
      }
    });
  };

  // Pinned beside the back button: the explanation is read with the box,
  // and shows on hover.
  const hint =
    (on ? `Only ${band} sees this record.` : `Shared: other bands see this record. Status, notes, and contacts stay ${band}'s.`) +
    (locked ? ` ${locked}.` : "");
  return (
    <>
      <label className="choice" title={hint}>
        <input type="checkbox" checked={on} disabled={pending || Boolean(locked)} onChange={(e) => change(e.target.checked)} aria-describedby="keep-private-hint" />
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
