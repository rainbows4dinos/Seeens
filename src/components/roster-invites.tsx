"use client";

import { useActionState, useState } from "react";
import { noAutofill } from "@/lib/no-autofill";
import { LinkBox, Note } from "@/components/band-settings";
import { inviteRosterBand } from "@/lib/band/roster-actions";

// A label's roster in Label Settings (#298): each band on the label, whether
// it's on Seeens, and, for owners, a way to invite the ones that aren't.

export type RosterBand = {
  id: string;
  name: string;
  current: boolean;
  joined: boolean;
  /** Waiting on its owner; byUs when this label sent the invite. */
  invited: boolean;
  byUs: boolean;
};

export function RosterInvites({ bands, canInvite, label }: { bands: RosterBand[]; canInvite: boolean; label: string }) {
  return (
    <ul className="rows flex flex-col">
      {bands.map((b) => (
        <RosterRow key={b.id} band={b} canInvite={canInvite} label={label} />
      ))}
    </ul>
  );
}

function RosterRow({ band: b, canInvite, label }: { band: RosterBand; canInvite: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(inviteRosterBand, {});
  const where = b.joined
    ? "On Seeens"
    : b.invited
      ? b.byUs
        ? "Invited, waiting on them"
        : "Invited by someone else"
      : "Not on Seeens yet";
  // Inviting again makes a new link; only for ones this label invited.
  const invitable = canInvite && !b.joined && (!b.invited || b.byUs);

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {/* A full page load, not the directory's quick view. */}
          <a href={`/connections/${b.id}`} className="link font-medium break-words">
            {b.name}
          </a>
          <p className="text-sm text-muted">{[b.current ? null : "Past", where].filter(Boolean).join(" · ")}</p>
        </div>
        {invitable && !open ? (
          <button type="button" className="button-secondary" onClick={() => setOpen(true)}>
            {b.invited ? "Invite Again" : "Invite"}
            <span className="sr-only"> {b.name}</span>
          </button>
        ) : null}
      </div>
      {open ? (
        <form action={action} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Whoever runs {b.name} gets an invite from {label}. Their listing becomes theirs to keep up to date, and they
            bring in their bandmates.{b.invited && !state.link ? " The last link you sent stops working." : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor={`roster-email-${b.id}`} className="label">
                Email
              </label>
              <input
                {...noAutofill}
                id={`roster-email-${b.id}`}
                name="email"
                type="email"
                className="field"
                placeholder="sam@example.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`roster-name-${b.id}`} className="label">
                Name (Optional)
              </label>
              <input
                {...noAutofill}
                id={`roster-name-${b.id}`}
                name="name"
                className="field"
                placeholder="Sam"
                maxLength={80}
              />
            </div>
          </div>
          <input type="hidden" name="listing_id" value={b.id} />
          <Note state={state} />
          {state.link ? <LinkBox key={state.link} link={state.link} /> : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" name="mode" value="email" className="button-primary" disabled={pending}>
              {pending ? "Working…" : "Send Invite"}
            </button>
            <button
              type="submit"
              name="mode"
              value="link"
              className="button-secondary"
              disabled={pending}
              formNoValidate
            >
              Copy Invite Link
            </button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>
              {state.link ? "Done" : "Cancel"}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
