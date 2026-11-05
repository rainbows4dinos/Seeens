"use client";

import { unstable_rethrow } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { markPlayedTogether } from "@/lib/connections/actions";
import type { PlayedOffer as Offer } from "@/lib/connections/played-together";

// After "We've played together" is ticked (#124): offer the band's current
// members, or the bands a person is in, each ticked unless they're already
// marked. Untick anyone who wasn't there. "Not Now" changes nothing else.
export function PlayedOffer({
  sourceId,
  offer,
  onDone,
}: {
  sourceId: string;
  offer: Offer;
  /** Called with a message to announce ("Marked 2 members.") or "" when dismissed. */
  onDone: (message: string) => void;
}) {
  const open = offer.relatives.filter((r) => !r.playedTogether);
  const [picked, setPicked] = useState(() => new Set(open.map((r) => r.id)));
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const members = offer.direction === "members";
  const noun = (n: number) => (members ? (n === 1 ? "member" : "members") : n === 1 ? "band" : "bands");

  // Move focus to the question so keyboard and screen reader users land on it.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  function toggle(id: string, on: boolean) {
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function mark() {
    setError(false);
    startTransition(async () => {
      let result;
      try {
        result = await markPlayedTogether(sourceId, [...picked]);
      } catch (e) {
        unstable_rethrow(e);
        result = { ok: false as const };
      }
      if (result.ok) onDone(`Marked ${result.marked} ${noun(result.marked)} as played together.`);
      else setError(true);
    });
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 border border-strong bg-surface p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onDone("");
      }}
    >
      <h3 id={headingId} ref={heading} tabIndex={-1} className="label outline-none">
        {members ? "Also mark their members?" : "Also mark the bands they’re in?"}
      </h3>
      <p className="-mt-2 text-sm text-muted">Untick anyone who wasn&rsquo;t there.</p>
      <ul className="offer-list flex flex-col gap-2">
        {offer.relatives.map((r) => (
          <li key={r.id}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={r.playedTogether || picked.has(r.id)}
                disabled={r.playedTogether || pending}
                onChange={(e) => toggle(r.id, e.target.checked)}
              />
              <span>{r.name}</span>
              {r.playedTogether ? <span className="text-sm text-muted">already marked</span> : null}
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-medium text-error">
          Couldn&rsquo;t save. Nothing changed; try again.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-primary" onClick={mark} disabled={pending || picked.size === 0}>
          {pending ? "Saving…" : `Mark ${picked.size} ${noun(picked.size)}`}
        </button>
        <button type="button" className="button-secondary" onClick={() => onDone("")} disabled={pending}>
          Not Now
        </button>
      </div>
    </section>
  );
}
