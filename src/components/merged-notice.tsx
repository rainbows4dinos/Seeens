"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { offline } from "@/lib/offline";
import { undoMerge } from "@/lib/connections/merge-actions";

type Merged = { id: string; name: string; catalog: string };

// On the kept connection after a merge (#169): what was folded in, and
// Undo for 30 days. Right after merging it's a notice up top; after that,
// a quiet line in the footer.
export function MergedNotice({
  mergeId,
  keepName,
  merged,
  until,
  quiet = false,
}: {
  mergeId: string;
  keepName: string;
  merged: Merged[];
  until: string;
  quiet?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const names = joinNames(merged.map((m) => `${m.name} (${m.catalog})`));

  const undo = () =>
    startTransition(async () => {
      setError(undefined);
      const r = await undoMerge(mergeId).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
      // On success the action reloads the page with ?unmerged=…
      if (r.error) setError(r.error);
    });

  if (quiet) {
    return (
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p>
          Merged {names} into this one.{" "}
          <button type="button" className="link" disabled={pending} onClick={undo}>
            {pending ? "Undoing…" : "Undo Merge"}
          </button>{" "}
          until {until}.
        </p>
        {error ? (
          <p role="alert" className="font-medium text-error">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="window flex flex-col gap-3 p-4">
      <p>
        Merged {names} into {keepName}. {merged.length === 1 ? "Its" : "Their"} outreach, links, and connections are
        here now.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="button-secondary"
          disabled={pending}
          onClick={undo}
        >
          {pending ? "Undoing…" : "Undo Merge"}
        </button>
        <span className="text-sm text-muted">Until {until}</span>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// After an undo: who came back, with links to them.
export function UnmergedNotice({ merged }: { merged: Merged[] }) {
  return (
    <div role="status" className="window flex flex-col gap-2 p-4">
      <p className="font-medium">Merge undone.</p>
      <p className="text-sm">
        {merged.map((m, i) => (
          <span key={m.id}>
            {i ? ", " : null}
            <Link href={`/connections/${m.id}`} className="link">
              {m.name}
            </Link>
          </span>
        ))}{" "}
        {merged.length === 1 ? "is" : "are"} back, with everything that came from {merged.length === 1 ? "it" : "them"}.
      </p>
    </div>
  );
}

export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
