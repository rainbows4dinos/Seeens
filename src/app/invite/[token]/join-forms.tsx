"use client";

import { useActionState, useState, useTransition } from "react";
import { acceptInvite, optOut, signInAndJoin, signUpAndJoin, type JoinState } from "@/lib/band/actions";
import { offline } from "@/lib/offline";

function Err({ state, id }: { state: JoinState; id: string }) {
  return (
    <p id={id} role="alert" className="text-sm font-medium text-error empty:hidden">
      {state.error ? <>Error: {state.error}</> : null}
    </p>
  );
}

/** Signed in already: join as you. */
export function AcceptForm({ token, band, email }: { token: string; band: string; email: string | null }) {
  const [state, action, pending] = useActionState(acceptInvite, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted">You&rsquo;re signed in{email ? ` as ${email}` : ""}.</p>
      <Err state={state} id="accept-error" />
      <button type="submit" className="button-primary self-start" disabled={pending}>
        {pending ? "Joining…" : `Join ${band}`}
      </button>
    </form>
  );
}

/** Signed out: make an account (the default), or sign in to one you have. */
export function JoinForms({
  token,
  band,
  inviteEmail,
  name,
}: {
  token: string;
  band: string;
  inviteEmail: string | null;
  name: string | null;
}) {
  const [up, upAction, upPending] = useActionState(signUpAndJoin, {});
  const [inState, inAction, inPending] = useActionState(signInAndJoin, {});
  const [mode, setMode] = useState<"new" | "existing">("new");
  // The server can send you to the other form (an account already exists).
  const shown = up.mode === "existing" && mode === "new" ? "existing" : mode;
  const email = inviteEmail ?? up.email ?? inState.email ?? "";

  const emailField = (id: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label">
        Email
      </label>
      {inviteEmail ? (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
          The invite is for this address.
        </p>
      ) : null}
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={email}
        readOnly={Boolean(inviteEmail)}
        aria-describedby={inviteEmail ? `${id}-hint` : undefined}
        className="field"
      />
    </div>
  );

  if (shown === "existing")
    return (
      <form key="existing" action={inAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="token" value={token} />
        <p className="text-sm text-muted">Sign in, and you&rsquo;ll join {band} with the account you have.</p>
        {up.mode === "existing" && up.error ? (
          <p role="status" className="text-sm font-medium">
            {up.error}
          </p>
        ) : null}
        {emailField("in-email")}
        <div className="flex flex-col gap-2">
          <label htmlFor="in-password" className="label">
            Password
          </label>
          <input
            id="in-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
          />
        </div>
        <Err state={inState} id="in-error" />
        <button type="submit" className="button-primary" disabled={inPending}>
          {inPending ? "Joining…" : `Sign In and Join ${band}`}
        </button>
        <button type="button" className="link self-start text-sm" onClick={() => setMode("new")}>
          New to Seeens? Make an account
        </button>
      </form>
    );

  return (
    <form key="new" action={upAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <label htmlFor="up-name" className="label">
          Your Name
        </label>
        <p id="up-name-hint" className="-mt-1 text-sm text-muted">
          How bandmates see you. You can change it later.
        </p>
        <input
          id="up-name"
          name="display_name"
          autoComplete="name"
          required
          maxLength={80}
          defaultValue={name ?? ""}
          aria-describedby="up-name-hint"
          className="field"
        />
      </div>
      {emailField("up-email")}
      <div className="flex flex-col gap-2">
        <label htmlFor="up-password" className="label">
          Password
        </label>
        <input
          id="up-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="At least 8 characters"
          required
          className="field"
        />
      </div>
      <Err state={up.mode === "existing" ? {} : up} id="up-error" />
      <button type="submit" className="button-primary" disabled={upPending}>
        {upPending ? "Joining…" : `Make Account and Join ${band}`}
      </button>
      <button type="button" className="link self-start text-sm" onClick={() => setMode("existing")}>
        Already on Seeens? Sign in instead
      </button>
    </form>
  );
}

export function OptOutButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-1 text-sm text-muted">
      <p>Not interested?</p>
      <button
        type="button"
        className="link"
        disabled={pending}
        onClick={() => start(async () => void (await optOut(token).catch(offline({}))))}
      >
        {pending ? "Saving…" : "Don't email me again"}
      </button>
    </div>
  );
}
