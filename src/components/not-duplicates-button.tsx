"use client";

import { useState, useTransition } from "react";
import { offline } from "@/lib/offline";
import { markNotDuplicates } from "@/lib/connections/merge-actions";
import { joinNames } from "@/components/merged-notice";

// Says a whole group are different connections; they stop showing up here.
export function NotDuplicatesButton({ ids, names }: { ids: string[]; names: string[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <button
        type="button"
        className="button-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const r = await markNotDuplicates(ids).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
            if (r.error) setError(r.error);
          })
        }
      >
        {pending ? "Saving…" : "Not Duplicates"}
        <span className="sr-only">: {joinNames(names)}</span>
      </button>
      {error ? (
        <p role="alert" className="basis-full text-sm font-medium text-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
