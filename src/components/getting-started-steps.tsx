"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Checkmark } from "@carbon/icons-react";

export type Step = {
  done: boolean;
  title: string;
  body: string;
  /** How far along this step is, like "1 of 3". */
  progress?: string | null;
  /** Something to do right here, above the links. */
  extra?: ReactNode;
  links: { href: string; label: string; plain?: boolean }[];
};

// Getting Started shows one step at a time: the first one not done. Skip
// moves on to the next one not done (for this visit), and comes back around.
// The numbered blocks show where you are, check off what's done, and jump
// to any step that isn't.
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
  const [pos, setPos] = useState(0);
  const at = todo[pos % todo.length];
  const s = steps[at];

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
                {x.done ? (
                  <span className="step-block" data-done="">
                    <Checkmark size={16} aria-hidden="true" />
                    <span className="sr-only">
                      Step {i + 1}, done: {x.title}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="step-block"
                    aria-current={i === at ? "step" : undefined}
                    aria-label={`Step ${i + 1}: ${x.title}`}
                    title={x.title}
                    onClick={() => setPos(todo.indexOf(i))}
                  >
                    {i + 1}
                  </button>
                )}
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted" aria-hidden="true">
            Step {at + 1} of {steps.length}
            {s.progress ? ` · ${s.progress}` : ""}
          </p>
        </div>
        <h3 id="getting-started-step" className="text-lg font-medium">
          {s.title}
        </h3>
        <p className="text-muted">{s.body}</p>
        {s.extra}
        <div className="flex flex-wrap gap-3 pt-1">
          {s.links.map((l, j) => {
            const cls = j === 0 && !s.extra ? "button-primary" : "button-secondary";
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
        {todo.length > 1 ? (
          <button
            type="button"
            className="action-link link text-sm"
            onClick={() => setPos((n) => (n % todo.length) + 1)}
          >
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
