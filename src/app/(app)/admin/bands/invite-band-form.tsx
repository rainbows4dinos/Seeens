"use client";

import { useActionState, useState, useTransition } from "react";
import { noAutofill } from "@/lib/no-autofill";
import { offline } from "@/lib/offline";
import { Combobox, type ComboOption } from "@/components/combobox";
import { LinkBox, Note } from "@/components/band-settings";
import { cancelBandInvite, inviteBand, renewBandInvite, type InviteBandState } from "@/lib/band/invite-band-actions";

const unreachable = offline<InviteBandState>({
  error: "Couldn't reach Seeens. Try again.",
});

// Invite a band (#68) or a label (#298): pick its listing in the directory
// (or name one that isn't listed), and its first owner. The owner makes
// their account on the invite page, then invites the rest.
export function InviteBandForm({
  bands,
  people,
  picked: initial,
  emailReady,
  emails,
}: {
  bands: ComboOption[];
  /** People the owner could be, so their account links to them. */
  people: ComboOption[];
  /** Opened from a listing's Invite button: that band, already picked. */
  picked?: string;
  emailReady: boolean;
  /** Emails your band saved for listings, to fill in the owner's email. */
  emails: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(inviteBand, {});
  const preset = bands.find((b) => b.value === initial);
  const [fixed, setFixed] = useState(preset);
  const [listing, setListing] = useState(preset?.value ?? "");
  const [newBand, setNewBand] = useState("");
  // What's typed in the picker: a band that isn't listed, without having to
  // choose "New Band" (if it is listed, the server says to pick it).
  const [typed, setTyped] = useState("");
  const [person, setPerson] = useState("");
  // The owner's email. Picking a listing or a person with a saved email
  // fills it in, unless you've typed something else. A person's beats a
  // band's.
  const [email, setEmail] = useState((preset && emails[preset.value]) || "");
  const [filled, setFilled] = useState((preset && emails[preset.value]) || "");
  const fill = (next: string | undefined) => {
    if (!next || (email && email !== filled)) return;
    setEmail(next);
    setFilled(next);
  };
  // A name that isn't listed: a band, unless it's a label.
  const [newKind, setNewKind] = useState<"band" | "label">("band");
  // A new picker after each invite, so the last pick doesn't linger.
  const [round, setRound] = useState(0);
  const [prevLink, setPrevLink] = useState(state.link);
  if (state.link !== prevLink) {
    setPrevLink(state.link);
    setListing("");
    setNewBand("");
    setTyped("");
    setPerson("");
    setEmail("");
    setFilled("");
    setNewKind("band");
    setFixed(undefined);
    setRound((r) => r + 1);
  }
  const band = listing ? "" : newBand || typed.trim();
  const picked = Boolean(listing || band);

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-muted">
        Pick the band or label from the directory, or type its name if nobody&rsquo;s added it yet. Its owner gets an
        invite, makes their account, and the listing becomes theirs to keep up to date. They invite the rest from Band
        Settings (Label Settings for a label). People listed as its members can find themselves under Find Yourself.
        {emailReady ? "" : " Email isn’t set up yet, so you’ll get a link to send them yourself."}
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {fixed ? (
          <div className="flex flex-col gap-2">
            <p className="label">Band or Label</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-col">
                <p className="font-medium break-words">{fixed.label}</p>
                {fixed.hint ? <p className="text-sm text-muted">{fixed.hint}</p> : null}
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setFixed(undefined);
                  setListing("");
                }}
              >
                Change<span className="sr-only"> band or label</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col gap-3"
            onInput={(e) => {
              const t = e.target as HTMLInputElement;
              if (t.getAttribute("role") === "combobox") setTyped(t.value);
            }}
          >
            <Combobox
              key={round}
              label="Band or Label"
              options={bands}
              multiple={false}
              placeholder="Find a band or label"
              create={{ verb: "New" }}
              onChange={(values, created) => {
                setListing(values[0] ?? "");
                setNewBand(values[0] ? "" : (created[0] ?? ""));
                if (!person || !emails[person]) fill(values[0] ? emails[values[0]] : undefined);
              }}
            />
            {band ? (
              <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <legend className="sr-only">{band} is a</legend>
                <span className="text-sm text-muted" aria-hidden="true">
                  New, not listed yet:
                </span>
                {(["band", "label"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="radio" checked={newKind === k} onChange={() => setNewKind(k)} />
                    {k === "band" ? "Band" : "Label"}
                  </label>
                ))}
              </fieldset>
            ) : null}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="owner-email" className="label">
            Owner&rsquo;s Email
          </label>
          <input
            {...noAutofill}
            id="owner-email"
            name="email"
            type="email"
            className="field"
            placeholder="sam@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {email && email === filled ? (
            <p className="text-sm text-muted">From the email your band saved for them.</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="owner-name" className="label">
            Owner&rsquo;s Name (Optional)
          </label>
          <input {...noAutofill} id="owner-name" name="name" className="field" placeholder="Sam" maxLength={80} />
        </div>
        <div className="flex flex-col gap-2">
          <Combobox
            key={round}
            label="Owner’s Profile (Optional)"
            options={people}
            multiple={false}
            placeholder="Find a person"
            onChange={(values) => {
              setPerson(values[0] ?? "");
              fill(values[0] ? emails[values[0]] : undefined);
            }}
          />
          <p className="text-sm text-muted">
            If they&rsquo;re already in the directory, their account links to them when they join. Private ones become
            shared.
          </p>
        </div>
      </div>
      <input type="hidden" name="listing_id" value={listing} />
      <input type="hidden" name="new_band" value={band} />
      <input type="hidden" name="person_id" value={person} />
      <input type="hidden" name="new_kind" value={newKind} />
      <Note state={state} />
      {state.link ? <LinkBox link={state.link} /> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="mode" value="email" className="button-primary" disabled={pending || !picked}>
          {pending ? "Working…" : "Send Invite"}
        </button>
        <button
          type="submit"
          name="mode"
          value="link"
          className="button-secondary"
          disabled={pending || !picked}
          formNoValidate
        >
          Copy Invite Link
        </button>
      </div>
    </form>
  );
}

export function NewLinkButton({ id, band }: { id: string; band: string }) {
  const [state, setState] = useState<InviteBandState>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex basis-full flex-col gap-2 sm:basis-auto sm:items-end">
      <button
        type="button"
        className="button-secondary"
        disabled={pending}
        onClick={() => start(async () => setState(await renewBandInvite(id).catch(unreachable)))}
      >
        Refresh Link<span className="sr-only"> for {band}</span>
      </button>
      <Note state={state} />
      {state.link ? <LinkBox key={state.link} link={state.link} /> : null}
    </div>
  );
}

/** Cancel a waiting band's invite, after a second press to be sure. */
export function CancelInviteButton({ id, band }: { id: string; band: string }) {
  const [state, setState] = useState<InviteBandState>({});
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  if (!sure)
    return (
      <button type="button" className="button-secondary" onClick={() => setSure(true)}>
        Cancel Invite<span className="sr-only"> for {band}</span>
      </button>
    );
  return (
    <div className="flex basis-full flex-col gap-2 sm:items-end">
      <p className="text-sm">Cancel the invite for {band}? Its link stops working.</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="button-primary"
          disabled={pending}
          onClick={() => start(async () => setState(await cancelBandInvite(id).catch(unreachable)))}
        >
          Yes, Cancel It
        </button>
        <button type="button" className="button-secondary" disabled={pending} onClick={() => setSure(false)} autoFocus>
          Keep It
        </button>
      </div>
      <Note state={state} />
    </div>
  );
}
