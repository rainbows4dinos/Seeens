import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password · Seeens" };

// Forgot password (#67): email a reset link. Signed-out only.
export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <header className="flex flex-col items-start gap-6">
        <Link href="/login" className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/seeens-logo.svg" alt="Seeens" width={75} height={18} />
        </Link>
      </header>
      <section aria-labelledby="forgot-heading" className="window flex w-full max-w-sm flex-col">
        <h1
          id="forgot-heading"
          className="bg-inverse px-2 py-1 font-mono text-xs font-normal tracking-normal text-[var(--color-text-inverse)]"
        >
          Reset your password
        </h1>
        <div className="flex flex-col gap-4 p-4">
          <ForgotForm />
          <Link href="/login" className="link self-start text-sm">
            Back to Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
