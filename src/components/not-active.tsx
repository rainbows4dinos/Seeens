"use client";

import { useState, useTransition } from "react";
import { offline } from "@/lib/offline";
import { setNotActive, type NotActiveResult } from "@/lib/connections/sharing-actions";

// Not Active (#335): broke up, on hiatus, or stepped away. Not archived: every
// band sees it, it can flip back, and it keeps the listing out of
// suggestions. Saves on change; pinned at the top of the record page.
export function NotActive({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    setOn(next);
    setError("");
    startTransition(async () => {
      const result: NotActiveResult = await setNotActive(id, next).catch(
        offline({ error: "Couldn't reach Seeens. Try again." }),
      );
      if (result.error) {
        setOn(!next);
        setError(result.error);
      }
    });
  };

  const hint = on
    ? "Not active right now. Every band sees this, and it stays out of suggestions. Uncheck it when they're back."
    : "Broke up, on a break, or stepped away? Every band sees it, and it can change back.";
  return (
    <>
      <label className="choice" title={hint}>
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => change(e.target.checked)}
          aria-describedby={`not-active-hint-${id}`}
        />
        <span>Not Active</span>
      </label>
      <span id={`not-active-hint-${id}`} className="sr-only">
        {hint}
      </span>
      <p role="alert" className="keep-private-error empty:hidden">
        {error ? `Error: ${error}` : ""}
      </p>
    </>
  );
}
