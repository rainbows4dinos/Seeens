"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";

// Shown when a page in the app can't load. Plain words, a way to retry,
// and a way out. Nothing the person typed elsewhere is lost.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  // Refetch from the server, then re-render, so a retry really retries.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  useEffect(() => {
    headingRef.current?.focus();
    console.warn("Seeens page error", error.digest ?? "");
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-bold sm:text-[52px] sm:leading-[52px] outline-none">
        That didn&rsquo;t load.
      </h1>
      <p className="text-muted">
        Seeens couldn&rsquo;t reach your band&rsquo;s data just now. It&rsquo;s usually a dropped connection.
        Nothing saved is lost.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-primary" onClick={retry}>
          Try again
        </button>
        <Link href="/" className="button-secondary">
          Back to the directory
        </Link>
      </div>
      {error.digest ? <p className="text-sm text-muted">Reference: {error.digest}</p> : null}
    </div>
  );
}
