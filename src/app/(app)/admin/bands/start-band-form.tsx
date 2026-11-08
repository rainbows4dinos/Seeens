"use client";

import { useActionState, useState, useTransition } from "react";
import { noAutofill } from "@/lib/no-autofill";
import { offline } from "@/lib/offline";
import { LinkBox, Note } from "@/components/band-settings";
import { renewBandInvite, startBand, type StartBandState } from "@/lib/band/start-actions";

const unreachable = offline<StartBandState>({ error: "Couldn't reach Seeens. Try again." });

// Start a band (#68): its name and its first owner. The owner makes their
// account on the invite page, then invites the rest of the band.
export function StartBandForm({ emailReady }: { emailReady: boolean }) {
  const [state, action, pending] = useActionState(startBand, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-muted">
        The band starts empty. Its owner gets an invite, makes their account, and invites their bandmates from Band
        Settings.{emailReady ? "" : " Email isn’t set up yet, so you’ll get a link to send them yourself."}
      </p>
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="band-name" className="label">
            Band
          </label>
          <input {...noAutofill} id="band-name" name="band" className="field" placeholder="Wet Paint" maxLength={80} required />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="owner-email" className="label">
            Owner&rsquo;s Email
          </label>
          <input {...noAutofill} id="owner-email" name="email" type="email" className="field" placeholder="sam@example.com" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="owner-name" className="label">
            Owner&rsquo;s Name (Optional)
          </label>
          <input {...noAutofill} id="owner-name" name="name" className="field" placeholder="Sam" maxLength={80} />
        </div>
      </div>
      <Note state={state} />
      {state.link ? <LinkBox link={state.link} /> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="mode" value="email" className="button-primary" disabled={pending}>
          {pending ? "Working…" : "Start Band"}
        </button>
        <button type="submit" name="mode" value="link" className="button-secondary" disabled={pending} formNoValidate>
          Start With a Link
        </button>
      </div>
    </form>
  );
}

export function NewLinkButton({ id, band }: { id: string; band: string }) {
  const [state, setState] = useState<StartBandState>({});
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
