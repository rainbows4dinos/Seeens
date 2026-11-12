"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { quickUpdate } from "@/lib/connections/actions";
import { STATUSES, statusLabel, type ConnectionStatus } from "@/lib/connections/labels";

export type SuggestedBand = { connection_id: string; name: string; town: string; knows_you: boolean };

// Bands a new band might know, each with a status to pick right here. Picking
// one counts toward Getting Started, and it shows up on Home.
// In an admin's preview a pick only shows; it doesn't save.
export function SuggestedBands({ bands, preview = false }: { bands: SuggestedBand[]; preview?: boolean }) {
  return (
    <ul className="suggested-bands flex flex-col">
      {bands.map((b) => (
        <Row key={b.connection_id} band={b} preview={preview} />
      ))}
    </ul>
  );
}

function Row({ band, preview }: { band: SuggestedBand; preview: boolean }) {
  const [status, setStatus] = useState<ConnectionStatus | "">("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const id = `suggested-${band.connection_id}`;

  function pick(next: ConnectionStatus | "") {
    const before = status;
    setStatus(next);
    setError(false);
    if (preview) return;
    start(async () => {
      let ok = false;
      try {
        ok = (await quickUpdate(band.connection_id, { status: next || null })).ok;
      } catch (e) {
        unstable_rethrow(e);
      }
      if (!ok) {
        setStatus(before);
        setError(true);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="flex min-w-0 flex-1 basis-32 flex-col">
        {/* A full page load: a link to a listing would otherwise open the quick view. */}
        <a href={`/connections/${band.connection_id}`} className="font-medium break-words">
          {band.name}
        </a>
        <p className="text-sm text-muted">
          {[band.town || null, band.knows_you ? "Knows you" : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <label htmlFor={id} className="sr-only">
        Status for {band.name}
      </label>
      <select
        id={id}
        className="field w-36 shrink-0 sm:w-44"
        value={status}
        disabled={pending}
        onChange={(e) => pick(e.target.value as ConnectionStatus | "")}
      >
        <option value="">Set Status</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="basis-full text-sm font-medium text-error">
          Couldn&rsquo;t save. Try again.
        </p>
      ) : null}
    </li>
  );
}
