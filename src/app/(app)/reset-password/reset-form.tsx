"use client";

import { useActionState } from "react";
import { resetPassword } from "@/lib/auth/account-actions";

export function ResetForm() {
  const [state, action, pending] = useActionState(resetPassword, {});
  return (
    <form action={action} className="window flex flex-col gap-4 p-4 sm:max-w-md">
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
          placeholder="At least 8 characters"
          className="field"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="confirm-password" className="label">
          Confirm New Password
        </label>
        <input id="confirm-password" name="confirm_password" type="password" autoComplete="new-password" className="field" required />
      </div>
      <p role="alert" className="min-h-6 text-sm font-medium text-error">
        {state.error ? <>Error: {state.error}</> : null}
      </p>
      <button type="submit" className="button-primary self-start" disabled={pending}>
        {pending ? "Saving…" : "Set Password"}
      </button>
    </form>
  );
}
