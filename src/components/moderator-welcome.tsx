"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { dismissModeratorWelcome } from "@/lib/auth/moderator-actions";

// Once, for someone just made a moderator (#195): what that means, until
// they dismiss it.
export function ModeratorWelcome() {
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();
  if (!open) return null;
  const dismiss = () => {
    setOpen(false);
    startTransition(() => dismissModeratorWelcome().catch(() => {}));
  };
  return (
    <div role="status" className="page-measure mb-8">
      <div className="window flex flex-col gap-3 p-4">
        <p className="font-medium">You’re a moderator now.</p>
        <p className="text-sm">
          You can fix the details on any listing another band shares, like its name, town, links, and venue details, and
          keep a listing private when it shouldn’t be shared. Every edit is logged. Each band’s statuses and notes stay
          their own.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="button-primary" onClick={dismiss}>
            Got It
          </button>
          <Link href="/directory" className="link text-sm" onClick={dismiss}>
            Open Explore
          </Link>
        </div>
      </div>
    </div>
  );
}
