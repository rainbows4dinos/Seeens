import Link from "next/link";
import type { ReactNode } from "react";
import { DateLines } from "@/components/date-line";
import { formatLocality, formatType, type ConnectionKind, type GroupType, type PersonRole } from "@/lib/connections/labels";
import { initials, recordId } from "@/lib/connections/card";

// Figma Connection Card: a print on top, a machine meta box below, both
// straight (tilt is only for small pieces like tape and script notes). The
// whole card is one link.
//
// Kept independent of the directory layout so Boards (#49) can reuse it.
// Until connection photos (#37) ship, the print is a paper placeholder with
// the connection's initials; tape comes with #63.

export type CardConnection = {
  id: string;
  name: string;
  kind: ConnectionKind;
  person_roles: PersonRole[];
  group_type: GroupType | null;
  played_together: boolean;
  localities: Parameters<typeof formatLocality>[0];
  outreach_entries: { occurred_on: string; summary: string }[];
  next_actions: { description: string; due_on: string | null }[];
};

export function ConnectionCard({
  connection: c,
  tags,
  today,
}: {
  connection: CardConnection;
  tags: ReactNode[];
  today: string;
}) {
  const place = formatLocality(c.localities);
  const lastOutreach = c.outreach_entries[0];
  const nextAction = c.next_actions[0];

  return (
    <Link href={`/connections/${c.id}`} className="connection-card">
      <span className="card-print" aria-hidden="true">
        <span className="card-print-initials">{initials(c.name)}</span>
      </span>
      <span className="card-meta">
        {/* Name first for screen readers; the caption row sits above it visually. */}
        <span className="flex flex-col-reverse gap-2">
          <span className="display-m break-words">{c.name}</span>
          <span className="caption flex items-start justify-between gap-3">
            <span>{[formatType(c), place].filter(Boolean).join(" · ")}</span>
            <span aria-hidden="true" className="shrink-0 whitespace-nowrap">
              {recordId(c.id)}
            </span>
          </span>
        </span>
        {tags.length ? <span className="flex flex-wrap gap-1">{tags}</span> : null}
        {lastOutreach || nextAction ? (
          <span className="card-dates">
            <DateLines lastOutreach={lastOutreach} nextAction={nextAction} today={today} />
          </span>
        ) : null}
      </span>
    </Link>
  );
}
