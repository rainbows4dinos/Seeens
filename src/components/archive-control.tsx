"use client";

import { useRef, useState, useTransition } from "react";
import { archiveConnection, restoreConnection } from "@/lib/connections/actions";

// Two-step archive: no browser confirm dialogs, keyboard friendly.
export function ArchiveControl({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const startRef = useRef<HTMLButtonElement>(null);

  const run = (fn: typeof archiveConnection) =>
    startTransition(async () => {
      setError(undefined);
      const result = await fn(id).catch(() => ({ error: "Couldn't reach Seeens. Try again." }));
      if (result.error) setError(result.error);
      else setConfirming(false);
    });

  if (archived) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className="button-secondary self-start" disabled={pending} onClick={() => run(restoreConnection)}>
          {pending ? "Restoring…" : "Restore to directory"}
        </button>
        <Status error={error} />
      </div>
    );
  }

  if (!confirming) {
    return (
      <button ref={startRef} type="button" className="button-secondary self-start" onClick={() => setConfirming(true)}>
        Archive
      </button>
    );
  }

  return (
    <div role="group" aria-labelledby="archive-question" className="flex flex-col gap-3 panel p-4">
      <p id="archive-question" className="font-medium break-words">
        Archive {name}?
      </p>
      <p className="text-sm text-muted">
        They&rsquo;ll be hidden from the directory. Notes, links, outreach, and history are kept, and you can
        restore them anytime.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="button-primary"
          disabled={pending}
          onClick={() => run(archiveConnection)}
          autoFocus
        >
          {pending ? "Archiving…" : "Archive"}
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            requestAnimationFrame(() => startRef.current?.focus());
          }}
        >
          Cancel
        </button>
      </div>
      <Status error={error} />
    </div>
  );
}

function Status({ error }: { error?: string }) {
  return (
    <p role="alert" className="text-sm font-medium text-error">
      {error ? `Error: ${error}` : null}
    </p>
  );
}
