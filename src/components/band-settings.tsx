"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { noAutofill } from "@/lib/no-autofill";
import { offline } from "@/lib/offline";
import {
  createInvite,
  removeMember,
  renameBand,
  renewInviteLink,
  resendInvite,
  revokeInvite,
  setMemberRole,
  type BandState,
} from "@/lib/band/actions";

// The parts of Band Settings that change things (#69).

const unreachable = offline<BandState>({ error: "Couldn't reach Seeens. Try again." });

export function Note({ state, id }: { state: BandState; id?: string }) {
  if (state.error)
    return (
      <p id={id} role="alert" className="text-sm font-medium text-error">
        Error: {state.error}
      </p>
    );
  return (
    <p id={id} role="status" className="text-sm empty:hidden">
      {state.done ?? ""}
    </p>
  );
}

/** A link to hand over: copied for you when the browser allows, and shown either way. */
export function LinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          {...noAutofill}
          readOnly
          value={link}
          aria-label="Invite link"
          className="field min-w-0 flex-1 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className="button-secondary" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-sm text-muted">Send it however you talk: a DM, a text. It works once, for 7 days.</p>
    </div>
  );
}

export function BandNameField({ initial }: { initial: string }) {
  const [state, setState] = useState<BandState>({});
  const [pending, start] = useTransition();
  const saved = useRef(initial);
  const save = (value: string) => {
    if (value.trim() === saved.current) return;
    start(async () => {
      const r = await renameBand(value).catch(unreachable);
      if (!r.error) saved.current = value.trim();
      setState(r);
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="band-name" className="label">
        Band Name
      </label>
      <p id="band-name-hint" className="-mt-1 text-sm text-muted">
        Shown in the header and on invites.
      </p>
      <input
        {...noAutofill}
        id="band-name"
        className="field sm:max-w-sm"
        defaultValue={initial}
        maxLength={80}
        required
        aria-describedby="band-name-hint band-name-msg"
        onBlur={(e) => save(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save(e.currentTarget.value);
          }
        }}
      />
      {pending ? (
        <p id="band-name-msg" role="status" className="text-sm text-muted">
          Saving…
        </p>
      ) : (
        <Note state={state} id="band-name-msg" />
      )}
    </div>
  );
}

export function MemberControls({ userId, name, role }: { userId: string; name: string; role: "owner" | "member" }) {
  const [state, setState] = useState<BandState>({});
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="sr-only" htmlFor={`role-${userId}`}>
          Role for {name}
        </label>
        <select
          id={`role-${userId}`}
          className="field w-32"
          defaultValue={role}
          disabled={pending}
          onChange={(e) => {
            const next = e.currentTarget.value as "owner" | "member";
            const el = e.currentTarget;
            start(async () => {
              const r = await setMemberRole(userId, next).catch(unreachable);
              if (r.error) el.value = role;
              setState(r);
            });
          }}
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
        {confirming ? null : (
          <button type="button" className="button-secondary" onClick={() => setConfirming(true)} disabled={pending}>
            Remove<span className="sr-only"> {name}</span>
          </button>
        )}
      </div>
      {confirming ? (
        <div role="group" aria-label={`Remove ${name}?`} className="flex flex-col gap-2 border border-dashed border-strong p-3 text-sm">
          <p>
            Remove {name}? They lose access right away. Everything they added stays, and you can invite them back.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="button-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeMember(userId).catch(unreachable);
                  setState(r);
                  if (!r.error) setConfirming(false);
                })
              }
            >
              {pending ? "Removing…" : `Remove ${name}`}
            </button>
            <button type="button" className="button-secondary" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </div>
        </div>
      ) : null}
      <Note state={state} />
    </div>
  );
}

export function InviteForm({ canInviteOwners, bandName }: { canInviteOwners: boolean; bandName: string }) {
  const [state, action, pending] = useActionState(createInvite, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-muted">
        They&rsquo;ll see that you invited them to {bandName}, and that Seeens is in beta. Any member can invite.
      </p>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-email" className="label">
            Email
          </label>
          <input {...noAutofill} id="invite-email" name="email" type="email" className="field" placeholder="sam@example.com" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-name" className="label">
            Name (Optional)
          </label>
          <input {...noAutofill} id="invite-name" name="name" className="field" placeholder="Sam" maxLength={80} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-role" className="label">
            Role
          </label>
          <select {...noAutofill} id="invite-role" name="role" className="field" defaultValue="member">
            <option value="member">Member</option>
            {canInviteOwners ? <option value="owner">Owner</option> : null}
          </select>
        </div>
      </div>
      <Note state={state} />
      {state.link ? <LinkBox key={state.link} link={state.link} /> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="mode" value="email" className="button-primary" disabled={pending}>
          {pending ? "Working…" : "Send Invite"}
        </button>
        <button type="submit" name="mode" value="link" className="button-secondary" disabled={pending} formNoValidate>
          Copy Invite Link
        </button>
      </div>
    </form>
  );
}

export function PendingInviteActions({ id, hasEmail, label }: { id: string; hasEmail: boolean; label: string }) {
  const [state, setState] = useState<BandState>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<BandState>) =>
    start(async () => {
      setState(await fn().catch(unreachable));
    });
  return (
    <div className="flex basis-full flex-col gap-2 sm:basis-auto sm:items-end">
      <div className="flex flex-wrap gap-3 sm:justify-end">
        {hasEmail ? (
          <button type="button" className="button-secondary" disabled={pending} onClick={() => run(() => resendInvite(id))}>
            Resend<span className="sr-only"> to {label}</span>
          </button>
        ) : null}
        <button type="button" className="button-secondary" disabled={pending} onClick={() => run(() => renewInviteLink(id))}>
          New Link<span className="sr-only"> for {label}</span>
        </button>
        <button type="button" className="button-secondary" disabled={pending} onClick={() => run(() => revokeInvite(id))}>
          Revoke<span className="sr-only"> {label}</span>
        </button>
      </div>
      <Note state={state} />
      {state.link ? <LinkBox key={state.link} link={state.link} /> : null}
    </div>
  );
}
