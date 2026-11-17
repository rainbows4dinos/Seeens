"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Checkmark } from "@carbon/icons-react";

export type Step = {
  done: boolean;
  title: string;
  body: string;
  /** What shows instead of the body once it's done, and why (#355). */
  doneNote?: string;
  /** How far along this step is, like "1 of 3". */
  progress?: string | null;
  /** Something to do right here, above the links. */
  extra?: ReactNode;
  links: { href: string; label: string; plain?: boolean }[];
};

// Getting Started shows one step at a time: the first one not done. Skip
// moves on to the next one not done (for this visit), and comes back around.
// The numbered blocks show where you are, check off what's done, and jump
// to any step, done or not. A done step says what did it, since some are
// done before you got here (#355).
export function GettingStartedSteps({
  welcome,
  note,
  steps,
  putAway,
}: {
  welcome: string;
  /** Shown above the welcome, like the admin preview's note. */
  note?: string | null;
  steps: Step[];
  putAway: ReactNode;
}) {
  const todo = steps.map((s, i) => (s.done ? -1 : i)).filter((i) => i >= 0);
  const [picked, setPicked] = useState<number | null>(null);
  const at = picked ?? todo[0] ?? 0;
  const s = steps[at];
  // The next step not done after this one, coming back around.
  const next = todo.find((i) => i > at) ?? todo[0];

  return (
    <div className="flex flex-col gap-5">
      {note ? <p className="border border-dashed border-strong p-3 text-sm font-medium">{note}</p> : null}
      <p className="text-muted">{welcome}</p>
      <section className="getting-started-step flex flex-col gap-3" aria-labelledby="getting-started-step">
        {/* The blocks and the count together: they say the same thing. */}
        <div className="flex flex-wrap items-center gap-3">
          <ol className="getting-started-blocks" aria-label="Steps">
            {steps.map((x, i) => (
              <li key={x.title}>
                <button
                  type="button"
                  className="step-block"
                  data-done={x.done ? "" : undefined}
                  aria-current={i === at ? "step" : undefined}
                  aria-label={`Step ${i + 1}${x.done ? ", done" : ""}: ${x.title}`}
                  title={x.title}
                  onClick={() => setPicked(i)}
                >
                  {x.done ? <Checkmark size={16} aria-hidden="true" /> : i + 1}
                </button>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted" aria-hidden="true">
            Step {at + 1} of {steps.length}
            {s.done ? " · Done" : s.progress ? ` · ${s.progress}` : ""}
          </p>
        </div>
        <h3 id="getting-started-step" className="text-lg font-medium">
          {s.title}
        </h3>
        {s.done ? (
          <p className="flex items-start gap-2">
            <Checkmark size={16} aria-hidden="true" className="mt-1 shrink-0" />
            <span>
              <span className="sr-only">Done. </span>
              {s.doneNote ?? s.body}
            </span>
          </p>
        ) : (
          <>
            <p className="text-muted">{s.body}</p>
            {s.extra}
          </>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          {s.links.map((l, j) => {
            const cls = j === 0 && !s.extra && !s.done ? "button-primary" : "button-secondary";
            return l.plain ? (
              <a key={l.href} href={l.href} className={cls}>
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className={cls}>
                {l.label}
              </Link>
            );
          })}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {s.done && next !== undefined ? (
          <button type="button" className="action-link link text-sm" onClick={() => setPicked(next)}>
            Next Step
          </button>
        ) : todo.length > 1 ? (
          <button type="button" className="action-link link text-sm" onClick={() => setPicked(next)}>
            Skip for Now
          </button>
        ) : (
          <span />
        )}
        {putAway}
      </div>
    </div>
  );
}
