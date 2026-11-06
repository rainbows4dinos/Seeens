import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password · Seeens" };

// Where a reset link lands (#67), signed in by the link: a new password, no
// old one. Only right after a link works; otherwise use Account Settings.
export default function ResetPasswordPage() {
  return (
    <div className="page-measure flex flex-col gap-8">
      <h1 className="display-l">Set a new password</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Reset />
      </Suspense>
    </div>
  );
}

async function Reset() {
  const ok = Boolean((await cookies()).get(RECOVERY_COOKIE));
  if (!ok)
    return (
      <div className="flex flex-col items-start gap-3">
        <p>This page only works right after you open a reset link, for 15 minutes.</p>
        <p className="text-muted">
          To change your password while signed in, use{" "}
          <Link href="/account" className="link">
            Account Settings
          </Link>
          .
        </p>
      </div>
    );
  return <ResetForm />;
}
