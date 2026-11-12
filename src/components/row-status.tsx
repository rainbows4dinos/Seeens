"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { quickUpdate } from "@/lib/connections/actions";
import {
  NO_STATUS,
  STATUSES,
  statusLabel,
  type ConnectionKind,
  type ConnectionStatus,
  type GroupType,
  type PersonRole,
} from "@/lib/connections/labels";

export type StatusType = { kind: ConnectionKind; group_type: GroupType | null; person_roles: PersonRole[] };

// A small status picker on a member's row (#311): from a band's page, set
// each member's own status, and from a person's page, each of their bands'.
// Being Homies with a band doesn't make you close with the bass player.
// Saves on change; snaps back if the save fails.
export function RowStatus({
  id,
  name,
  initial,
  type,
}: {
  id: string;
  name: string;
  initial: ConnectionStatus | null;
  type: StatusType;
}) {
  const [saved, setSaved] = useState(initial);
  const [shown, setShown] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  // A newer value from the server (a refresh, another member).
  const [prev, setPrev] = useState(initial);
  if (!pending && initial !== prev) {
    setPrev(initial);
    setSaved(initial);
    setShown(initial);
  }

  function save(status: ConnectionStatus | null) {
    setFailed(false);
    setShown(status);
    startTransition(async () => {
      let result;
      try {
        result = await quickUpdate(id, { status });
      } catch (e) {
        unstable_rethrow(e);
        result = { ok: false as const, saved: null };
      }
      const truth = result.saved ? result.saved.status : saved;
      setSaved(truth);
      setShown(truth);
      setFailed(!result.ok);
    });
  }

  return (
    <span className="flex items-center gap-2">
      <select
        aria-label={`Status for ${name}`}
        value={shown ?? ""}
        onChange={(e) => save((e.target.value || null) as ConnectionStatus | null)}
        className="field"
        aria-invalid={failed || undefined}
      >
        <option value="">{NO_STATUS}</option>
        {STATUSES.map((st) => (
          <option key={st} value={st}>
            {statusLabel(st, type)}
          </option>
        ))}
      </select>
      {failed ? (
        <span role="alert" className="font-medium text-error">
          Didn&rsquo;t save
        </span>
      ) : null}
    </span>
  );
}
