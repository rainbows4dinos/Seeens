"use client";

import Link from "next/link";
import { useActionState, useId, useMemo, useRef, useState, useTransition } from "react";
import { addLink, removeLink, updateLink, type LinkState } from "@/lib/affiliations/actions";
import {
  SECTION_ORDER,
  fitsTarget,
  newGroupTypes,
  type AddOption,
} from "@/lib/affiliations/options";
import {
  GROUP_TYPE_LABELS,
  formatType,
  type ConnectionKind,
  type GroupType,
} from "@/lib/connections/labels";

export type LinkRow = {
  id: string;
  section: string;
  otherId: string;
  otherName: string;
  otherArchived: boolean;
  role: string | null;
  isCurrent: boolean;
  notes: string | null;
};

export type Candidate = {
  id: string;
  name: string;
  kind: ConnectionKind;
  group_type: GroupType | null;
};

export function LinksPanel({
  subjectId,
  rows,
  options,
  candidates,
}: {
  subjectId: string;
  rows: LinkRow[];
  options: AddOption[];
  candidates: Candidate[];
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const sections = SECTION_ORDER.map((title) => ({
    title,
    rows: rows.filter((r) => r.section === title),
  })).filter((s) => s.rows.length);

  return (
    <section aria-labelledby="links-heading" className="flex flex-col gap-4">
      <h2 id="links-heading" className="text-xl leading-6 font-bold">
        Connections
      </h2>

      {sections.length === 0 ? (
        <p className="text-muted">No links yet. Add bandmates, labels, or the places they work.</p>
      ) : (
        sections.map((s) => (
          <div key={s.title} className="flex flex-col gap-1">
            <h3 className="label text-muted">{s.title}</h3>
            <ul className="rows flex flex-col">
              {[...s.rows]
                .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
                .map((r) => (
                  <LinkItem key={r.id} row={r} />
                ))}
            </ul>
          </div>
        ))
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="button-secondary"
            aria-expanded={adding === o.id}
            onClick={() => setAdding(adding === o.id ? null : o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {options
        .filter((o) => o.id === adding)
        .map((o) => (
          <AddLinkForm
            key={o.id}
            subjectId={subjectId}
            option={o}
            candidates={candidates.filter((c) => fitsTarget(o.target, c))}
            onDone={() => setAdding(null)}
          />
        ))}
    </section>
  );
}

function LinkItem({ row }: { row: LinkRow }) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [state, action, saving] = useActionState<LinkState, FormData>(async (prev, fd) => {
    const result = await updateLink(row.id, prev, fd).catch(() => ({ error: "Couldn't reach Seeens. Try again.", attempt: Date.now() }) as LinkState);
    if (result.ok) setMode("view");
    return result;
  }, {});
  const editRef = useRef<HTMLButtonElement>(null);
  const formId = useId();

  return (
    <li className="flex flex-col gap-2 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p>
          <Link href={`/connections/${row.otherId}`} className="link font-medium">
            {row.otherName}
          </Link>
          {row.role ? <span> · {row.role}</span> : null}
          {!row.isCurrent ? <span className="text-muted"> (former)</span> : null}
          {row.otherArchived ? <span className="text-muted"> (archived)</span> : null}
          {row.notes ? <span className="block text-sm text-muted">{row.notes}</span> : null}
        </p>
        {mode === "view" ? (
          <span className="flex gap-3 text-sm">
            <button ref={editRef} type="button" className="action-link" onClick={() => setMode("edit")}>
              Edit<span className="sr-only"> link to {row.otherName}</span>
            </button>
            <button type="button" className="action-link" onClick={() => setMode("remove")}>
              Remove<span className="sr-only"> link to {row.otherName}</span>
            </button>
          </span>
        ) : null}
      </div>

      {mode === "edit" ? (
        <form action={action} className="flex flex-col gap-3 panel p-3">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${formId}-role`} className="text-sm font-medium">
              Role or detail
            </label>
            <input id={`${formId}-role`} name="role" defaultValue={row.role ?? ""} className="field" autoFocus />
          </div>
          <label className="choice self-start">
            <input type="checkbox" name="former" defaultChecked={!row.isCurrent} />
            <span>Former</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setMode("view");
                requestAnimationFrame(() => editRef.current?.focus());
              }}
            >
              Cancel
            </button>
          </div>
          <p role="alert" className="text-sm font-medium text-error">
            {state.error ? `Error: ${state.error}` : null}
          </p>
        </form>
      ) : null}

      {mode === "remove" ? (
        <div role="group" aria-label={`Remove link to ${row.otherName}`} className="flex flex-col gap-2 panel p-3">
          <p className="text-sm">
            Remove the link to {row.otherName}? Both connections stay in the directory.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button-primary"
              disabled={pending}
              autoFocus
              onClick={() =>
                startTransition(async () => {
                  const r = await removeLink(row.id).catch(() => ({ error: "Couldn't reach Seeens. Try again." }));
                  if (r.error) setError(r.error);
                })
              }
            >
              {pending ? "Removing…" : "Remove"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
          <p role="alert" className="text-sm font-medium text-error">
            {error ? `Error: ${error}` : null}
          </p>
        </div>
      ) : null}
    </li>
  );
}

function AddLinkForm({
  subjectId,
  option,
  candidates,
  onDone,
}: {
  subjectId: string;
  option: AddOption;
  candidates: Candidate[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<LinkState, FormData>(async (prev, fd) => {
    const result = await addLink(subjectId, option.id, prev, fd).catch(() => ({ error: "Couldn't reach Seeens. Try again.", attempt: Date.now() }) as LinkState);
    if (result.ok) onDone();
    return result;
  }, {});
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const id = useId();
  const types = newGroupTypes(option.target);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates;
    return list.slice(0, 8);
  }, [candidates, query]);
  const exact = candidates.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim().length > 0 && !exact;

  return (
    <form action={action} className="flex flex-col gap-4 panel p-4">
      <h3 className="font-semibold">{option.label}</h3>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-search`} className="text-sm font-medium">
          Find in your directory, or type a new name
        </label>
        <input
          id={`${id}-search`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked("");
          }}
          autoComplete="off"
          autoFocus
          className="field"
          aria-describedby={`${id}-count`}
        />
        <p id={`${id}-count`} className="text-sm text-muted" aria-live="polite">
          {matches.length
            ? `${matches.length} match${matches.length === 1 ? "" : "es"}${canCreate ? ", or add new" : ""}`
            : canCreate
              ? "No matches. You can add them as new."
              : "Start typing a name."}
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Choose who to link</legend>
        {matches.map((c) => (
          <label key={c.id} className="choice self-start">
            <input
              type="radio"
              name="other_id"
              value={c.id}
              checked={picked === c.id}
              onChange={() => setPicked(c.id)}
            />
            <span>
              {c.name} <span className="font-normal text-muted">· {formatType({ ...c, person_roles: [] })}</span>
            </span>
          </label>
        ))}
        {canCreate ? (
          <label className="choice self-start">
            <input
              type="radio"
              name="other_id"
              value="__new__"
              checked={picked === "__new__"}
              onChange={() => setPicked("__new__")}
            />
            <span>Add new: {query.trim()}</span>
          </label>
        ) : null}
      </fieldset>
      <input type="hidden" name="new_name" value={picked === "__new__" ? query.trim() : ""} />

      {picked === "__new__" && types.length > 1 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-type`} className="text-sm font-medium">
            What is {query.trim()}?
          </label>
          <select id={`${id}-type`} name="new_group_type" className="field" defaultValue={types[0]}>
            {types.map((t) => (
              <option key={t} value={t}>
                {GROUP_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-role`} className="text-sm font-medium">
          Role or detail <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id={`${id}-role`} name="role" placeholder={option.rolePlaceholder} className="field" />
      </div>

      <label className="choice self-start">
        <input type="checkbox" name="former" />
        <span>Former</span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="button-primary" disabled={pending || !picked}>
          {pending ? "Saving…" : "Save link"}
        </button>
        <button type="button" className="button-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      <p role="alert" className="text-sm font-medium text-error">
        {state.error ? `Error: ${state.error}` : null}
      </p>
    </form>
  );
}
