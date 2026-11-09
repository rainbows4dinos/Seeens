"use client";

import { useActionState, useState, useTransition } from "react";
import { noAutofill } from "@/lib/no-autofill";
import { offline } from "@/lib/offline";
import { Combobox, type ComboOption } from "@/components/combobox";
import { LinkBox, Note } from "@/components/band-settings";
import { inviteBand, renewBandInvite, type InviteBandState } from "@/lib/band/invite-band-actions";

const unreachable = offline<InviteBandState>({
  error: "Couldn't reach Seeens. Try again.",
});

// Invite a band (#68): pick its listing in the directory (or name a band
// that isn't listed), and its first owner. The owner makes their account
// on the invite page, then invites the rest of the band.
export function InviteBandForm({
  bands,
  picked: initial,
  emailReady,
}: {
  bands: ComboOption[];
  /** Opened from a listing's Invite button: that band, already picked. */
  picked?: string;
  emailReady: boolean;
}) {
  const [state, action, pending] = useActionState(inviteBand, {});
  const preset = bands.find((b) => b.value === initial);
  const [fixed, setFixed] = useState(preset);
  const [listing, setListing] = useState(preset?.value ?? "");
  const [newBand, setNewBand] = useState("");
  // What's typed in the picker: a band that isn't listed, without having to
  // choose "New Band" (if it is listed, the server says to pick it).
  const [typed, setTyped] = useState("");
  // A new picker after each invite, so the last pick doesn't linger.
  const [round, setRound] = useState(0);
  const [prevLink, setPrevLink] = useState(state.link);
  if (state.link !== prevLink) {
    setPrevLink(state.link);
    setListing("");
    setNewBand("");
    setTyped("");
    setFixed(undefined);
    setRound((r) => r + 1);
  }
  const band = listing ? "" : newBand || typed.trim();
  const picked = Boolean(listing || band);

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-muted">
        Pick the band from the directory, or type its name if nobody&rsquo;s added it yet. Its owner gets an invite,
        makes their account, and the band&rsquo;s listing becomes theirs to keep up to date. They invite their bandmates
        from Band Settings.
        {emailReady ? "" : " Email isn’t set up yet, so you’ll get a link to send them yourself."}
      </p>
      <div className="grid gap-5 sm:grid-cols-3">
        {fixed ? (
          <div className="flex flex-col gap-2">
            <p className="label">Band</p>
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
                Change<span className="sr-only"> band</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            onInput={(e) => {
              const t = e.target as HTMLInputElement;
              if (t.getAttribute("role") === "combobox") setTyped(t.value);
            }}
          >
            <Combobox
              key={round}
              label="Band"
              options={bands}
              multiple={false}
              placeholder="Find a band"
              create={{ verb: "New Band" }}
              onChange={(values, created) => {
                setListing(values[0] ?? "");
                setNewBand(values[0] ? "" : (created[0] ?? ""));
              }}
            />
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
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="owner-name" className="label">
            Owner&rsquo;s Name (Optional)
          </label>
          <input {...noAutofill} id="owner-name" name="name" className="field" placeholder="Sam" maxLength={80} />
        </div>
      </div>
      <input type="hidden" name="listing_id" value={listing} />
      <input type="hidden" name="new_band" value={band} />
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
        New Link<span className="sr-only"> for {band}</span>
      </button>
      <Note state={state} />
      {state.link ? <LinkBox key={state.link} link={state.link} /> : null}
    </div>
  );
}
