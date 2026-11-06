"use client";

import { useEffect, useRef, type ReactNode } from "react";

// One piece of feedback, folded to a single row (#71). The one an email
// links to (#f-<id>) opens by itself.
export function FeedbackItem({ id, summary, children }: { id: string; summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.location.hash === `#f-${id}` && ref.current) {
      ref.current.open = true;
      ref.current.scrollIntoView({ block: "start" });
    }
  }, [id]);
  return (
    <details ref={ref} id={`f-${id}`} className="feedback-item scroll-mt-28">
      <summary className="feedback-item-summary">{summary}</summary>
      <div className="flex flex-col gap-4 px-4 pt-1 pb-4">{children}</div>
    </details>
  );
}
