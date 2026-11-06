"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

// Send Feedback (#71), from anywhere: it carries the page you were on (the
// path only; a query string can hold names).
export function FeedbackLink({ className }: { className: string }) {
  return (
    <Suspense
      fallback={
        <Link href="/feedback" className={className}>
          Send Feedback
        </Link>
      }
    >
      <Current className={className} />
    </Suspense>
  );
}

function Current({ className }: { className: string }) {
  const pathname = usePathname();
  const href = pathname && pathname !== "/feedback" ? `/feedback?from=${encodeURIComponent(pathname)}` : "/feedback";
  return (
    <Link href={href} className={className} aria-current={pathname === "/feedback" ? "page" : undefined}>
      Send Feedback
    </Link>
  );
}
