"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import {
  addNewToRoster,
  addToRoster,
  removeFromRoster,
  searchRosterBands,
  type BandMatch,
} from "@/lib/band/roster-actions";

// Add to Roster (#365), on a label's own page: search the bands anyone
// shared and add one, or add a new band by name. Added ones open their page.
export function RosterAdd({ label, onRoster }: { label: string; onRoster: string[] }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<BandMatch[]>([]);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<{ id: string; name: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const found = await searchRosterBands(term).catch(() => []);
      if (live) setMatches(found);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const shown = q.trim().length >= 2 ? matches : [];
  const exact = shown.some((m) => m.name.trim().toLowerCase() === q.trim().toLowerCase());

  function run(fn: () => Promise<{ error?: string; id?: string }>, name: string) {
    setError("");
    start(async () => {
      const r: { error?: string; id?: string } = await fn().catch(() => ({
        error: "Couldn't reach Seeens. Try again.",
      }));
      if (r.error) setError(r.error);
      else if (r.id) {
        setAdded({ id: r.id, name });
        setQ("");
        setMatches([]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="label">
        Add to Roster
      </label>
      <input
        id={id}
        type="search"
        className="field sm:max-w-80"
        placeholder="Search Bands"
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
        Any band on Seeens, or a new one. {label}&rsquo;s roster shows on this page and your Home.
      </p>
      {q.trim().length >= 2 ? (
        <ul className="flex flex-col gap-2" aria-label="Matching bands">
          {shown.map((m) => {
            const already = onRoster.includes(m.id);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="font-medium">{m.name}</span>
                  {m.town ? <span className="text-muted"> · {m.town}</span> : null}
                </span>
                {already ? (
                  <span className="text-sm text-muted">On Your Roster</span>
                ) : (
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={pending}
                    onClick={() => run(() => addToRoster(m.id), m.name)}
                  >
                    Add {m.name}
                  </button>
                )}
              </li>
            );
          })}
          {exact ? null : (
            <li>
              <button
                type="button"
                className="button-secondary"
                disabled={pending}
                onClick={() => run(() => addNewToRoster(q), q.trim())}
              >
                Add &ldquo;{q.trim()}&rdquo; as a New Band
              </button>
            </li>
          )}
        </ul>
      ) : null}
      <p role="status" className="text-sm empty:hidden">
        {added ? (
          <>
            Added {added.name}.{" "}
            <Link href={`/connections/${added.id}`} className="link">
              Fill In Their Page
            </Link>
          </>
        ) : null}
      </p>
      <p role="alert" className="text-sm font-medium text-error empty:hidden">
        {error}
      </p>
    </div>
  );
}

/** Take a band off the roster (#365): only ones this label added. */
export function RosterRemove({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <>
      <button
        type="button"
        className="action-link link text-xs text-muted"
        disabled={pending}
        aria-label={`Take ${name} off the roster`}
        onClick={() =>
          start(async () => {
            const r = await removeFromRoster(id).catch(() => ({ error: "x" }));
            setError(Boolean(r.error));
          })
        }
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error ? (
        <span role="alert" className="text-xs font-medium text-error">
          Didn&rsquo;t save
        </span>
      ) : null}
    </>
  );
}
