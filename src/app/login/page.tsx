import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Seeens",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <header className="flex flex-col items-start gap-6">
        <h1 className="logo uppercase">Seeens</h1>
        <p className="font-display text-5xl leading-[44px] font-bold tracking-[-0.045em] sm:text-[96px] sm:leading-[88px]">
          Your people.
          <br />
          <span className="swipe">Your scenes.</span>
        </p>
      </header>

      <section
        aria-labelledby="signin-heading"
        className="window flex w-full max-w-sm flex-col"
      >
        <h2
          id="signin-heading"
          className="bg-inverse px-2 py-1 font-mono text-xs font-normal tracking-normal text-[var(--color-text-inverse)]"
        >
          Sign in
        </h2>
        <div className="flex flex-col gap-4 p-4">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <LoginForm />
          </Suspense>
          <p className="text-sm text-muted">
            Seeens is invite-only. Ask a bandmate to add you if you don&rsquo;t
            have an account.
          </p>
        </div>
      </section>
    </main>
  );
}
