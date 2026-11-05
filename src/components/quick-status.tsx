"use client";

import { unstable_rethrow } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { quickUpdate, type QuickState } from "@/lib/connections/actions";
import type { PlayedOffer as Offer } from "@/lib/connections/played-together";
import { PlayedOffer } from "@/components/played-offer";
import { STATUSES, playedWords, statusHint, statusLabel, type ConnectionStatus, type ConnectionKind, type GroupType, type PersonRole } from "@/lib/connections/labels";

type Change = { status: ConnectionStatus } | { playedTogether: boolean };

// Saves as soon as a choice changes. While saving, the control shows the
// new choice; if the save fails it snaps back to what's actually saved and
// offers a retry.
//
// Ticking "We've played together" then offers to mark the members (or the
// bands) too (#124). The edit form's save lands here with that offer open.
export function QuickStatus({
  id,
  initial,
  initialOffer = null,
  type,
}: {
  id: string;
  initial: QuickState;
  /** The connection's type, for its status words (#139). */
  type: { kind: ConnectionKind; group_type: GroupType | null; person_roles: PersonRole[] };
  initialOffer?: Offer | null;
}) {
  const [offer, setOffer] = useState(initialOffer);
  // Next keeps this page's state between visits, so take a new offer from the
  // server (an edit-form save) when it arrives.
  const offerKey = initialOffer ? JSON.stringify(initialOffer) : "";
  const [prevOfferKey, setPrevOfferKey] = useState(offerKey);
  if (offerKey !== prevOfferKey) {
    setPrevOfferKey(offerKey);
    if (initialOffer) setOffer(initialOffer);
  }
  const played = useRef<HTMLInputElement>(null);
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

  function closeOffer(done: string) {
    setOffer(null);
    setMessage(done);
    // Don't offer again on a refresh after an edit-form save (?offer=played).
    const url = new URL(window.location.href);
    if (url.searchParams.has("offer")) {
      url.searchParams.delete("offer");
      window.history.replaceState(window.history.state, "", url);
    }
    played.current?.focus();
  }

  function save(change: Change) {
    setFailed(null);
    if ("playedTogether" in change) setOffer(null);
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
        if (result.offer) setOffer(result.offer);
      } else {
        setFailed(change);
        setMessage("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor="quick-status" className="label">
          Status
        </label>
        <p id="quick-status-hint" className="-mt-1 text-sm text-muted">
          {statusHint(shown.status, type)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            id="quick-status"
            value={shown.status}
            onChange={(e) => save({ status: e.target.value as ConnectionStatus })}
            aria-describedby="quick-status-hint"
            className="field w-full sm:w-80"
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {statusLabel(st, type)}
              </option>
            ))}
          </select>
          <label className="choice">
            <input
              ref={played}
              type="checkbox"
              name="quick_played_together"
              checked={shown.playedTogether}
              onChange={(e) => save({ playedTogether: e.target.checked })}
            />
            <span>{playedWords(type).label}</span>
          </label>
        </div>
      </div>
      {offer ? <PlayedOffer sourceId={id} offer={offer} onDone={closeOffer} /> : null}
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {pending ? "Saving…" : message}
      </p>
      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-2 border-error bg-surface p-3 text-sm">
          <p className="font-medium text-error">
            Couldn&rsquo;t save. It&rsquo;s still {statusLabel(saved.status, type)}
            {saved.playedTogether ? `, ${playedWords(type).tag.toLowerCase()}` : ""}.
          </p>
          <button type="button" className="button-secondary" onClick={() => save(failed)}>
            Try Again
          </button>
        </div>
      ) : null}
    </div>
  );
}
