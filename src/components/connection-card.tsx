import Link from "next/link";
import { photoSrcSet, photoUrl } from "@/lib/photos/urls";
import { Photo } from "@/components/photo";
import type { ReactNode } from "react";
import { DateLines } from "@/components/date-line";
import {
  formatLocality,
  formatType,
  type ConnectionKind,
  type ConnectionStatus,
  type GroupType,
  type PersonRole,
} from "@/lib/connections/labels";
import { catalogNo, initials, seed } from "@/lib/connections/card";

// Figma Connection Card: a print on top, a machine meta box below. The whole
// card is one link; it sits straight and leans a little when you point at
// it, like picking a snapshot up off a board.
//
// Kept independent of the directory layout so Boards (#49) can reuse it.
// The print is the connection's copied photo (#37), or the initials on photo
// paper when there's none. It's decorative: the name is right below. A strip of tape (#63) holds the print's top-right
// corner; its angle is seeded from the id so it looks the same every visit.

export type CardConnection = {
  id: string;
  name: string;
  kind: ConnectionKind;
  person_roles: PersonRole[];
  group_type: GroupType | null;
  /** Null: no status (#192). */
  status: ConnectionStatus | null;
  is_us: boolean;
  played_together: boolean;
  catalog_no: number;
  photo_path?: string | null;
  photo_alt?: string | null;
  localities: Parameters<typeof formatLocality>[0];
  outreach_entries: { occurred_on: string; summary: string }[];
  next_actions: { description: string; due_on: string | null }[];
};

// Tape matches the status tag: colored tags get that plate; Neutral (no fill)
// and Avoid get clear.
const TAPE: Record<ConnectionStatus, string> = {
  homies: "tape-magenta",
  lets_play: "tape-yellow",
  prospect: "tape-cyan",
  neutral: "tape-clear",
  avoid: "tape-clear",
};

export function ConnectionCard({
  connection: c,
  tags,
  today,
  detail,
  open = false,
  replace = false,
  onClick,
  linkProps,
}: {
  connection: CardConnection;
  tags: ReactNode[];
  today: string;
  /** One more line under the name: members, the bands someone plays in, a note (#122). */
  detail?: string | null;
  /** Open in the quick view (#126): it stays lifted. */
  open?: boolean;
  /** Switching from another open connection replaces it in history. */
  replace?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  /** More handlers for the link: selecting (#243). */
  linkProps?: Omit<React.ComponentProps<"a">, "href">;
}) {
  const place = formatLocality(c.localities);
  const lastOutreach = c.outreach_entries[0];
  const nextAction = c.next_actions[0];
  // Tape: up to 2° either way. The card sits straight and leans when you
  // point at it: 0.6° to 1.2°, left or right, seeded apart from the tape.
  const tilt = (-2 + seed(c.id) * 4).toFixed(2);
  const lean = seed(`${c.id}:card`);
  const cardTilt = ((lean < 0.5 ? -1 : 1) * (0.6 + (lean % 0.5) * 1.2)).toFixed(2);

  return (
    <Link
      href={`/connections/${c.id}`}
      replace={replace}
      onClick={onClick}
      {...linkProps}
      aria-current={open ? "true" : undefined}
      data-listing={c.id}
      className="connection-card"
      style={{ "--card-tilt": `${cardTilt}deg` } as React.CSSProperties}
    >
      <span className="card-print" aria-hidden="true">
        {/* Initials sit under the photo, so a photo that fails to load never leaves a blank print. */}
        <span className="card-print-initials">{initials(c.name)}</span>
        {c.photo_path ? (
          // Served at a stable address and cached by the browser; the card takes
          // the smallest copy that's sharp at its width.
          <Photo
            src={photoUrl(c.photo_path, 640)!}
            srcSet={photoSrcSet(c.photo_path)}
            sizes="(min-width: 80rem) 25vw, (min-width: 48rem) 33vw, (min-width: 40rem) 50vw, 100vw"
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </span>
      <span
        className={`tape ${c.is_us ? "tape-clear" : TAPE[c.status ?? "neutral"]} card-tape`}
        style={{ rotate: `${tilt}deg` }}
        aria-hidden="true"
      />
      <span className="card-meta">
        {/* Name first for screen readers; the caption row sits above it visually. */}
        <span className="flex flex-col-reverse gap-2">
          <span className="display-m break-words">{c.name}</span>
          <span className="caption flex items-start justify-between gap-3">
            <span>{[formatType(c), place].filter(Boolean).join(" · ")}</span>
            <span className="shrink-0 whitespace-nowrap">{catalogNo(c)}</span>
          </span>
        </span>
        {detail ? <span className="detail-line">{detail}</span> : null}
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
