"use client";

import { useState, useTransition } from "react";
import { noAutofill } from "@/lib/no-autofill";
import { tellTester, updateFeedback, type AdminState } from "@/lib/feedback/actions";
import { STATUSES, type Status } from "@/lib/feedback/labels";

// Sorting one piece of feedback (#71): status, the issue it became, a draft
// issue to edit on GitHub, and telling the tester when it's done.
export function FeedbackControls({
  id,
  status,
  githubUrl,
  draftUrl,
  sender,
  canTell,
  toldOn,
}: {
  id: string;
  status: Status;
  githubUrl: string;
  draftUrl: string;
  sender: string;
  canTell: boolean;
  toldOn: string | null;
}) {
  const [current, setCurrent] = useState<Status>(status);
  const [url, setUrl] = useState(githubUrl);
  const [note, setNote] = useState("");
  const [telling, setTelling] = useState(false);
  const [state, setState] = useState<AdminState>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<AdminState>) =>
    start(async () => setState(await fn().catch(() => ({ error: "Couldn't reach Seeens. Try again." }))));
  const dirty = current !== status || url.trim() !== githubUrl;

  return (
    <div className="flex flex-col gap-4 border-t border-strong pt-4">
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <label htmlFor={`status-${id}`} className="label">
            Status
          </label>
          <select
            id={`status-${id}`}
            className="field"
            value={current}
            onChange={(e) => setCurrent(e.target.value as Status)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`issue-${id}`} className="label">
            GitHub Issue (Optional)
          </label>
          <input
            {...noAutofill}
            id={`issue-${id}`}
            type="url"
            className="field"
            placeholder="https://github.com/rainbows4dinos/seeens/issues/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="button-primary"
          disabled={pending || !dirty}
          onClick={() => run(() => updateFeedback(id, current, url))}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <a href={draftUrl} target="_blank" rel="noopener noreferrer" className="button-secondary">
          Draft an Issue
        </a>
        <p className="text-sm text-muted">
          Opens GitHub with the text filled in. Check it for real names before you post.
        </p>
      </div>

      {status === "done" && canTell ? (
        toldOn ? (
          <p className="text-sm text-muted">
            Told {sender} it shipped, {toldOn}.
          </p>
        ) : telling ? (
          <div className="flex flex-col gap-3 border border-dashed border-strong p-3">
            <label htmlFor={`note-${id}`} className="label">
              A Note for {sender} (Optional)
            </label>
            <textarea
              {...noAutofill}
              id={`note-${id}`}
              className="field min-h-24"
              maxLength={2000}
              placeholder="What changed, or where to find it."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-sm text-muted">They get an email with what they sent and this note.</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="button-primary"
                disabled={pending}
                onClick={() => run(() => tellTester(id, note))}
              >
                {pending ? "Sending…" : `Email ${sender}`}
              </button>
              <button type="button" className="button-secondary" onClick={() => setTelling(false)}>
                Not Now
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="button-secondary self-start" onClick={() => setTelling(true)}>
            Tell {sender} It Shipped
          </button>
        )
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-error">
          Error: {state.error}
        </p>
      ) : (
        <p role="status" className="text-sm empty:hidden">
          {state.done ?? ""}
        </p>
      )}
    </div>
  );
}
