"use client";

import { useActionState } from "react";
import { Field } from "@/components/form-field";
import { grantModerator, type ModeratorFormState } from "@/lib/auth/moderator-actions";

// Make a moderator by the email they sign in with (#195).
export function GrantForm() {
  const [state, action, pending] = useActionState<ModeratorFormState, FormData>(grantModerator, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="m-email" label="Email" error={state.error}>
          <input
            id="m-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            data-1p-ignore
            defaultValue={state.email}
            className="field w-72 max-w-full"
          />
        </Field>
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "Saving…" : "Make Moderator"}
        </button>
      </div>
      <p aria-live="polite" className="text-sm text-muted empty:hidden">
        {state.done ?? ""}
      </p>
    </form>
  );
}
