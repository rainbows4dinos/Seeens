import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { PreviewWall } from "@/components/preview-wall";
import { getPreviewCards } from "@/lib/preview/cards";

export const metadata: Metadata = {
  title: "Sign in · Seeens",
};

export default async function LoginPage() {
  // A few real cards beside the form (#255), when there are enough to fill it.
  const cards = await getPreviewCards();
  const preview = cards.length >= 6;
  return (
    <main className={`login-page${preview ? " has-preview" : ""}`}>
      <div className="login-side">
        {/* One block, centered on the page; everything in it lines up on the left. */}
        <div className="flex w-fit max-w-full flex-col items-start gap-10">
          <header className="flex flex-col items-start gap-6">
            <h1 className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/seeens-logo.svg" alt="Seeens" width={75} height={18} />
            </h1>
            <p className="font-display text-5xl leading-[44px] font-bold tracking-[-0.045em] sm:display-xxl">
              Your people.
              <br />
              <span className="swipe">Your scenes.</span>
            </p>
          </header>

          <section aria-labelledby="signin-heading" className="window flex w-full max-w-sm flex-col">
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
                Seeens is invite-only. Ask a bandmate to add you if you don&rsquo;t have an account.
              </p>
            </div>
          </section>
          <Link href="/about" className="button-secondary">
            What&rsquo;s Seeens?
          </Link>
        </div>
      </div>
      {preview ? <PreviewWall cards={cards} /> : null}
    </main>
  );
}
