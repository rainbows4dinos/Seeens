"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { quickUpdate, type QuickState } from "@/lib/connections/actions";
import { STATUSES, STATUS_HINTS, STATUS_LABELS, type ConnectionStatus } from "@/lib/connections/labels";

type Change = { status: ConnectionStatus } | { playedTogether: boolean };

// Saves as soon as a choice changes. While saving, the control shows the
// new choice; if the save fails it snaps back to what's actually saved and
// offers a retry.
export function QuickStatus({ id, initial }: { id: string; initial: QuickState }) {
  const [saved, setSaved] = useState(initial);
  const [shown, setShown] = useState(initial);
  const [failed, setFailed] = useState<Change | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  // Pick up changes from the server (another member, a refresh).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (
    !pending &&
    (initial.status !== prevInitial.status || initial.playedTogether !== prevInitial.playedTogether)
  ) {
    setPrevInitial(initial);
    setSaved(initial);
    setShown(initial);
  }

  function save(change: Change) {
    setFailed(null);
    setShown((s) => ({ ...s, ...change }));
    setMessage("Saving…");
    startTransition(async () => {
      let result;
      try {
        result = await quickUpdate(id, change);
      } catch (e) {
        unstable_rethrow(e);
        result = { ok: false as const, saved: null };
      }
      const truth = result.saved ?? saved;
      setSaved(truth);
      setShown(truth);
      if (result.ok) {
        setMessage("Saved.");
      } else {
        setFailed(change);
        setMessage("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2" aria-describedby="quick-status-hint">
        <legend className="text-sm font-medium">Status</legend>
        <p id="quick-status-hint" className="-mt-1 text-sm text-muted">
          {STATUS_HINTS[shown.status]}
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((st) => (
            <label key={st} className="choice">
              <input
                type="radio"
                name="quick_status"
                value={st}
                checked={shown.status === st}
                onChange={() => save({ status: st })}
              />
              <span>{STATUS_LABELS[st]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="choice">
          <input
            type="checkbox"
            name="quick_played_together"
            checked={shown.playedTogether}
            onChange={(e) => save({ playedTogether: e.target.checked })}
          />
          <span>We&rsquo;ve played together</span>
        </label>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {pending ? "Saving…" : message}
      </p>
      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-2 border-error bg-surface p-3 text-sm">
          <p className="font-medium text-error">
            Couldn&rsquo;t save. It&rsquo;s still {STATUS_LABELS[saved.status]}
            {saved.playedTogether ? ", played together" : ""}.
          </p>
          <button type="button" className="button-secondary" onClick={() => save(failed)}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
