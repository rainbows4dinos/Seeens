"use client";

import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveHomeLayout } from "@/lib/home/actions";

// Arrange Home (#313): move rows up and down and hide the ones you don't
// use. Just for you, in this band. Buttons, not dragging, so it works the
// same with a keyboard, a screen reader, and a thumb.

type Row = { key: string; label: string; shown: boolean };

export function ArrangeHome({ rows: initial, isDefault }: { rows: Row[]; isDefault: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [said, setSaid] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    setSaid(`${next[j].label} moved ${by < 0 ? "up" : "down"}, to ${j + 1} of ${next.length}.`);
    // Keep focus on the same button as the row moves.
    requestAnimationFrame(() => document.getElementById(`arrange-${next[j].key}-${by < 0 ? "up" : "down"}`)?.focus());
  }

  function save(order: Row[] | null) {
    setError(false);
    const list = order ?? rows;
    startTransition(async () => {
      const res = await saveHomeLayout(
        list.filter((r) => r.shown).map((r) => r.key),
        list.filter((r) => !r.shown).map((r) => r.key),
      ).catch(() => ({ ok: false }));
      if (!res.ok) return setError(true);
      setOpen(false);
      router.refresh();
      requestAnimationFrame(() => opener.current?.focus());
    });
  }

  if (!open)
    return (
      <div className="flex justify-center">
        <button
          ref={opener}
          type="button"
          className="button-secondary"
          onClick={() => {
            setRows(initial);
            setOpen(true);
          }}
        >
          Arrange Home
        </button>
      </div>
    );

  return (
    <section aria-labelledby="arrange-home" className="window flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 id="arrange-home" className="display-s">
          Arrange Home
        </h2>
        <p className="text-sm text-muted">
          Put the rows in the order you want, and hide the ones you don&rsquo;t use. Just for you; your bandmates keep
          their own.
        </p>
      </div>
      <ol className="rows flex flex-col">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-2">
            <label className="choice">
              <input
                type="checkbox"
                checked={r.shown}
                onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, shown: e.target.checked } : x)))}
              />
              <span className={r.shown ? undefined : "text-muted"}>{r.label}</span>
            </label>
            <span className="flex gap-2">
              <button
                id={`arrange-${r.key}-up`}
                type="button"
                className="button-secondary control-sm"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ChevronUp aria-hidden size={16} />
                <span className="sr-only">Move {r.label} up</span>
              </button>
              <button
                id={`arrange-${r.key}-down`}
                type="button"
                className="button-secondary control-sm"
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown aria-hidden size={16} />
                <span className="sr-only">Move {r.label} down</span>
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-error">
          Couldn&rsquo;t save. Try again.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-primary" disabled={pending} onClick={() => save(null)}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            requestAnimationFrame(() => opener.current?.focus());
          }}
        >
          Cancel
        </button>
        {!isDefault ? (
          <button type="button" className="button-secondary" disabled={pending} onClick={() => save([])}>
            Reset to Default
          </button>
        ) : null}
      </div>
    </section>
  );
}
