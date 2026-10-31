"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { closeNextAction, setNextAction, type NextActionState } from "@/lib/outreach/actions";
import { formatDay } from "@/lib/outreach/labels";

type Member = { user_id: string; display_name: string };
type Current = {
  id: string;
  description: string;
  due_on: string | null;
  assignee_id: string | null;
  assignee: { display_name: string } | null;
} | null;

// The current plan for a connection. Visually distinct from the outreach
// log: a single boxed "what's next", not a dated history list.
export function NextActionPanel({
  connectionId,
  current,
  members,
  me,
  today,
}: {
  connectionId: string;
  current: Current;
  members: Member[];
  me: string;
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [closeError, setCloseError] = useState<string>();
  const [closing, startClosing] = useTransition();
  const [message, setMessage] = useState("");
  const editRef = useRef<HTMLButtonElement>(null);

  const close = (how: "done" | "dropped") =>
    startClosing(async () => {
      setCloseError(undefined);
      const r = await closeNextAction(current!.id, how).catch(() => ({ error: "Couldn't reach Seeens. Try again." }));
      if (r.error) setCloseError(r.error);
      else setMessage(how === "done" ? "Marked done." : "Dropped. It's kept under earlier plans.");
    });

  return (
    <div className="flex flex-col gap-3 panel p-4">
      {editing ? (
        <PlanForm
          connectionId={connectionId}
          current={current}
          members={members}
          me={me}
          onDone={(saved) => {
            setEditing(false);
            if (saved) setMessage("Plan saved.");
            requestAnimationFrame(() => editRef.current?.focus());
          }}
        />
      ) : current ? (
        <>
          <p className="font-medium">{current.description}</p>
          <p className="text-sm text-muted">
            {[
              current.assignee?.display_name ?? "Anyone",
              current.due_on ? `planned for ${formatDay(current.due_on, today)}` : "no date set",
            ].join(" · ")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button ref={editRef} type="button" className="button-secondary" onClick={() => setEditing(true)}>
              Change plan
            </button>
            <button type="button" className="button-secondary" disabled={closing} onClick={() => close("done")}>
              Done
            </button>
            <button type="button" className="button-secondary" disabled={closing} onClick={() => close("dropped")}>
              Drop it
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted">Nothing planned.</p>
          <div>
            <button ref={editRef} type="button" className="button-secondary" onClick={() => setEditing(true)}>
              Plan a next step
            </button>
          </div>
        </>
      )}
      <p aria-live="polite" className="text-sm text-muted empty:hidden">
        {closing ? "Saving…" : message}
      </p>
      {closeError ? (
        <p role="alert" className="text-sm font-medium text-error">
          Error: {closeError}
        </p>
      ) : null}
    </div>
  );
}

function PlanForm({
  connectionId,
  current,
  members,
  me,
  onDone,
}: {
  connectionId: string;
  current: Current;
  members: Member[];
  me: string;
  onDone: (saved: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<NextActionState, FormData>(
    async (prev, fd) => {
      try {
        return await setNextAction(connectionId, prev, fd);
      } catch {
        return {
          values: {
            description: String(fd.get("description") ?? ""),
            dueOn: String(fd.get("due_on") ?? ""),
            assigneeId: String(fd.get("assignee_id") ?? ""),
          },
          errors: { form: "Couldn't reach Seeens. Your plan is still here; try again." },
          attempt: Date.now(),
        };
      }
    },
    {
      values: {
        description: current?.description ?? "",
        dueOn: current?.due_on ?? "",
        assigneeId: current ? (current.assignee_id ?? "") : me,
      },
      errors: {},
    },
  );
  const { values: v, errors } = state;
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.savedAt) onDone(true);
  }, [state.savedAt, onDone]);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  return (
    <form key={state.attempt ?? 0} action={formAction} noValidate className="flex flex-col gap-4">
      {errors.form ? (
        <p role="alert" className="text-sm font-semibold text-error">
          {errors.form}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor="na-description" className="text-sm font-medium">
          Next step
        </label>
        <input
          ref={firstRef}
          id="na-description"
          name="description"
          defaultValue={v.description}
          placeholder="Ask about a December date"
          autoComplete="off"
          className="field"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "na-description-error" : undefined}
        />
        {errors.description ? (
          <p id="na-description-error" className="text-sm font-medium text-error">
            Error: {errors.description}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="na-assignee" className="text-sm font-medium">
            Who&rsquo;s on it
          </label>
          <select
            id="na-assignee"
            name="assignee_id"
            defaultValue={v.assigneeId}
            className="field"
            aria-invalid={errors.assigneeId ? true : undefined}
            aria-describedby={errors.assigneeId ? "na-assignee-error" : undefined}
          >
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
                {m.user_id === me ? " (you)" : ""}
              </option>
            ))}
          </select>
          {errors.assigneeId ? (
            <p id="na-assignee-error" className="text-sm font-medium text-error">
              Error: {errors.assigneeId}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="na-due" className="text-sm font-medium">
            Follow up on <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="na-due"
            name="due_on"
            type="date"
            defaultValue={v.dueOn}
            className="field"
            aria-invalid={errors.dueOn ? true : undefined}
            aria-describedby={errors.dueOn ? "na-due-error" : undefined}
          />
          {errors.dueOn ? (
            <p id="na-due-error" className="text-sm font-medium text-error">
              Error: {errors.dueOn}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "Saving…" : "Save plan"}
        </button>
        <button type="button" className="button-secondary" onClick={() => onDone(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
