"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth/account-actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  if (state.done)
    return (
      <p role="status" className="font-medium">
        {state.done}
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">Enter your email and we&rsquo;ll send a link to set a new password.</p>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "forgot-error" : undefined}
          className="field"
        />
      </div>
      <p id="forgot-error" role="alert" className="min-h-6 text-sm font-medium text-error">
        {state.error ? <>Error: {state.error}</> : null}
      </p>
      <button type="submit" disabled={pending} className="button-primary">
        {pending ? "Sending…" : "Send Reset Link"}
      </button>
    </form>
  );
}
