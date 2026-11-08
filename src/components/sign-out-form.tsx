"use client";

import { useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { PageLoader } from "./metronome";

// Sign Out (#67) as a plain form post, so it works without JavaScript. With
// it, the metronome shows "signing out" while the page goes (the busy
// pointer carries it when there's a mouse).
export function SignOutForm({
  className,
  buttonClassName,
  next,
}: {
  className?: string;
  buttonClassName: string;
  next?: string;
}) {
  const [leaving, setLeaving] = useState(false);
  return (
    <form
      action="/auth/signout"
      method="post"
      className={className}
      onSubmit={(e) => {
        // Show it first: once the post is under way the page may not paint.
        e.preventDefault();
        const form = e.currentTarget;
        document.documentElement.setAttribute("data-navigating", "");
        flushSync(() => setLeaving(true));
        requestAnimationFrame(() => requestAnimationFrame(() => form.submit()));
      }}
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button type="submit" className={buttonClassName} disabled={leaving}>
        Sign Out
      </button>
      {/* On the page itself, not inside the menu it was opened from. */}
      {leaving
        ? createPortal(
            <div className="busy-overlay">
              <PageLoader label="signing out" />
            </div>,
            document.body,
          )
        : null}
    </form>
  );
}
