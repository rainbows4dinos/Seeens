"use client";

import { useActionState, useState, useTransition } from "react";
import { logOutreach, removeOutreach, type OutreachState } from "@/lib/outreach/actions";
import { CHANNELS, CHANNEL_LABELS, formatDay, type OutreachChannel } from "@/lib/outreach/labels";

type Entry = {
  id: string;
  occurred_on: string;
  channel: OutreachChannel;
  summary: string;
  author_id: string | null;
  author: { display_name: string } | null;
};

// What already happened, newest first. Entries are history: only the
// author can remove one, and plans or status changes never edit them.
export function OutreachPanel({
  connectionId,
  entries,
  me,
  today,
}: {
  connectionId: string;
  entries: Entry[];
  me: string;
  today: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {adding ? (
        <LogForm connectionId={connectionId} today={today} onClose={() => setAdding(false)} />
      ) : (
        <div>
          <button type="button" className="button-secondary" onClick={() => setAdding(true)}>
            Log outreach
          </button>
        </div>
      )}
      {entries.length ? (
        <ol className="panel rows flex flex-col">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} mine={e.author_id === me} today={today} />
          ))}
        </ol>
      ) : (
        <p className="text-muted">No outreach logged yet.</p>
      )}
    </div>
  );
}

function EntryRow({ entry: e, mine, today }: { entry: Entry; mine: boolean; today: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-col gap-1 px-3 py-3">
      <p className="text-sm text-muted">
        <time dateTime={e.occurred_on} className="font-medium text-foreground">
          {formatDay(e.occurred_on, today)}
        </time>
        {" · "}
        {CHANNEL_LABELS[e.channel]}
        {" · "}
        {e.author?.display_name ?? "Former member"}
      </p>
      <p className="whitespace-pre-wrap">{e.summary}</p>
      {mine ? (
        confirming ? (
          <div role="group" aria-label="Remove this entry" className="flex flex-wrap items-center gap-2 pt-1 text-sm">
            <span>Remove this entry?</span>
            <button
              type="button"
              className="button-secondary"
              disabled={pending}
              autoFocus
              onClick={() =>
                startTransition(async () => {
                  const r = await removeOutreach(e.id).catch(() => ({ error: "Couldn't reach Seeens. Try again." }));
                  if (r.error) setError(r.error);
                })
              }
            >
              {pending ? "Removing…" : "Remove"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <div>
            <button type="button" className="action-link text-sm text-muted" onClick={() => setConfirming(true)}>
              Remove<span className="sr-only"> entry from {formatDay(e.occurred_on, today)}</span>
            </button>
          </div>
        )
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-error">
          Error: {error}
        </p>
      ) : null}
    </li>
  );
}

function LogForm({
  connectionId,
  today,
  onClose,
}: {
  connectionId: string;
  today: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<OutreachState, FormData>(
    async (prev, fd) => {
      try {
        return await logOutreach(connectionId, prev, fd);
      } catch {
        // Network or server failure: keep what they typed.
        return {
          values: {
            occurredOn: String(fd.get("occurred_on") ?? ""),
            channel: String(fd.get("channel") ?? ""),
            summary: String(fd.get("summary") ?? ""),
          },
          errors: { form: "Couldn't reach Seeens. Your note is still here; try again." },
          attempt: Date.now(),
        };
      }
    },
    { values: { occurredOn: today, channel: "", summary: "" }, errors: {} },
  );
  const { values: v, errors } = state;

  return (
    <>
    <form
      key={state.attempt ?? state.savedAt ?? 0}
      action={formAction}
      noValidate
      className="flex flex-col gap-4 panel p-4"
    >
      {errors.form ? (
        <p role="alert" className="text-sm font-semibold text-error">
          {errors.form}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="o-date" className="text-sm font-medium">
            When
          </label>
          <input
            id="o-date"
            name="occurred_on"
            type="date"
            max={today}
            defaultValue={v.occurredOn}
            className="field"
            autoFocus
            aria-invalid={errors.occurredOn ? true : undefined}
            aria-describedby={errors.occurredOn ? "o-date-error" : undefined}
          />
          {errors.occurredOn ? (
            <p id="o-date-error" className="text-sm font-medium text-error">
              Error: {errors.occurredOn}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="o-channel" className="text-sm font-medium">
            How
          </label>
          <select
            id="o-channel"
            name="channel"
            defaultValue={v.channel}
            className="field"
            aria-invalid={errors.channel ? true : undefined}
            aria-describedby={errors.channel ? "o-channel-error" : undefined}
          >
            <option value="" disabled>
              Choose one
            </option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
          {errors.channel ? (
            <p id="o-channel-error" className="text-sm font-medium text-error">
              Error: {errors.channel}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="o-summary" className="text-sm font-medium">
          What happened
        </label>
        <textarea
          id="o-summary"
          name="summary"
          rows={3}
          defaultValue={v.summary}
          className="field"
          aria-invalid={errors.summary ? true : undefined}
          aria-describedby={errors.summary ? "o-summary-error" : undefined}
        />
        {errors.summary ? (
          <p id="o-summary-error" className="text-sm font-medium text-error">
            Error: {errors.summary}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "Saving…" : "Save to log"}
        </button>
        <button type="button" className="button-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </form>
    <p aria-live="polite" className="text-sm text-muted empty:hidden">
      {state.savedAt && !pending ? "Logged. Add another or close." : ""}
    </p>
    </>
  );
}
