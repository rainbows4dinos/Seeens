"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { noAutofill } from "@/lib/no-autofill";
import { offline } from "@/lib/offline";
import {
  changeEmail,
  changePassword,
  leaveBand,
  signOutOtherDevices,
  updateDisplayName,
  type FormState,
} from "@/lib/auth/account-actions";

// The forms on Account Settings (#67). The name saves as you go, like the
// profile; email, password, and signing out are deliberate, with a button.

function Message({ state, id }: { state: FormState; id: string }) {
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

export function DisplayNameField({ initial }: { initial: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const saved = useRef(initial);
  const save = (value: string) => {
    if (value.trim() === saved.current) return;
    startTransition(async () => {
      const r = await updateDisplayName(value).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
      if (!r.error) saved.current = value.trim();
      setState(r);
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="display-name" className="label">
        Display Name
      </label>
      <p id="display-name-hint" className="-mt-1 text-sm text-muted">
        How bandmates see you on plans, outreach, and status changes, in every band you&rsquo;re in.
      </p>
      <input
        {...noAutofill}
        id="display-name"
        className="field sm:max-w-sm"
        defaultValue={initial}
        maxLength={80}
        required
        aria-describedby="display-name-hint display-name-msg"
        aria-invalid={state.error ? true : undefined}
        onBlur={(e) => save(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save(e.currentTarget.value);
          }
        }}
      />
      {pending ? (
        <p id="display-name-msg" role="status" className="text-sm text-muted">
          Saving…
        </p>
      ) : (
        <Message state={state} id="display-name-msg" />
      )}
    </div>
  );
}

export function EmailForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(changeEmail, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="label">
          Email
        </label>
        <p id="email-hint" className="-mt-1 text-sm text-muted">
          We&rsquo;ll email the new address a link. Nothing changes until you open it.
        </p>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="field sm:max-w-sm"
          defaultValue={current}
          required
          aria-describedby="email-hint email-msg"
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      <Message state={state} id="email-msg" />
      <button type="submit" className="button-secondary self-start" disabled={pending}>
        {pending ? "Sending…" : "Change Email"}
      </button>
    </form>
  );
}

export function PasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(changePassword, {});
  // React clears the fields after each try, so passwords don't linger.
  return (
    <form action={action} className="flex flex-col gap-4">
      {/* For password managers: which account this is. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="flex flex-col gap-2 sm:max-w-sm">
        <label htmlFor="current-password" className="label">
          Current Password
        </label>
        <input
          id="current-password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          className="field"
          required
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="new-password" className="label">
            New Password
          </label>
          <input
            id="new-password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="field"
            placeholder="At least 8 characters"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-password" className="label">
            Confirm New Password
          </label>
          <input
            id="confirm-password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            className="field"
            placeholder="Type it again"
            required
          />
        </div>
      </div>
      <Message state={state} id="password-msg" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="button-secondary" disabled={pending}>
          {pending ? "Changing…" : "Change Password"}
        </button>
        <p className="text-sm text-muted">
          Forgot it?{" "}
          <Link href="/forgot-password" className="link" prefetch={false}>
            Get a reset link
          </Link>
        </p>
      </div>
    </form>
  );
}

export function SignOutOthersForm() {
  const [state, action, pending] = useActionState(signOutOtherDevices, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <p>Signed in on a shared or lost device? This signs you out everywhere except here.</p>
      <Message state={state} id="devices-msg" />
      <button type="submit" className="button-secondary self-start" disabled={pending}>
        {pending ? "Signing Out…" : "Sign Out of Other Devices"}
      </button>
    </form>
  );
}

export function LeaveBand({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  if (!confirming)
    return (
      <button type="button" className="button-secondary" onClick={() => setConfirming(true)}>
        Leave<span className="sr-only"> {name}</span>
      </button>
    );
  return (
    <div className="flex basis-full flex-col gap-3 border border-dashed border-strong p-3" role="group" aria-label={`Leave ${name}?`}>
      <p className="text-sm">
        Leave {name}? You&rsquo;ll lose access to its directory. Everything you added stays with the band, and a
        bandmate can invite you back.
      </p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-error">
          Error: {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="button-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const r = await leaveBand(workspaceId).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
              if (r?.error) setError(r.error);
            })
          }
        >
          {pending ? "Leaving…" : `Leave ${name}`}
        </button>
        <button type="button" className="button-secondary" onClick={() => setConfirming(false)}>
          Stay
        </button>
      </div>
    </div>
  );
}
