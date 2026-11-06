"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type SignInState } from "@/lib/auth/actions";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const expired = params.get("link") === "expired";
  const deleted = params.get("deleted") === "1";
  const [state, action, pending] = useActionState<SignInState | undefined, FormData>(
    signIn,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {expired ? (
        <p role="status" className="text-sm font-medium">
          That link has run out or was already used. Sign in, or ask for a new reset link.
        </p>
      ) : null}
      {deleted ? (
        <p role="status" className="text-sm font-medium">
          Your account is deleted. Thanks for trying Seeens.
        </p>
      ) : null}

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
          defaultValue={state?.email}
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "signin-error" : undefined}
          className="field"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "signin-error" : undefined}
          className="field"
        />
      </div>

      <p
        id="signin-error"
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-sm font-medium text-error"
      >
        {state?.error ? <>Error: {state.error}</> : null}
      </p>

      <button type="submit" disabled={pending} className="button-primary">
        {pending ? "Signing In…" : "Sign In"}
      </button>
      <Link href="/forgot-password" className="link self-start text-sm">
        Forgot your password?
      </Link>
    </form>
  );
}
