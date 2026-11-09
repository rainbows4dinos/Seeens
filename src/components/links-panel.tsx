"use client";

import { noAutofill } from "@/lib/no-autofill";
import { Combobox } from "@/components/combobox";
import { offline } from "@/lib/offline";
import Link from "next/link";
import { useActionState, useId, useRef, useState, useTransition } from "react";
import { DetachedForm } from "@/components/detached-form";
import { PasteLineup } from "@/components/paste-lineup";
import { CarryFields, hasCarry, pickAll, type Carry } from "@/components/carry-fields";
import { INSTRUMENTS, instrumentsFromRole, type Instrument } from "@/lib/affiliations/instruments";

const QUICK_INSTRUMENTS: Instrument[] = ["vocals", "guitar", "bass", "drums", "keyboards", "synth"];
import { addLink, removeLink, updateLink, type LinkState } from "@/lib/affiliations/actions";
import { SECTION_ORDER, fitsTarget, newGroupTypes, type AddOption } from "@/lib/affiliations/options";
import {
  GROUP_TYPE_LABELS,
  formatType,
  type ConnectionKind,
  type GroupType,
  type PersonRole,
} from "@/lib/connections/labels";

export type LinkRow = {
  id: string;
  section: string;
  otherId: string;
  otherName: string;
  /** "BND-0042" */
  otherCatalog: string;
  otherArchived: boolean;
  role: string | null;
  isCurrent: boolean;
  notes: string | null;
};

/**
 * A link picked on the Add form, before the connection exists: the add
 * form's fields, replayed through addLink once it's saved.
 */
export type PendingLink = {
  key: number;
  optionId: string;
  optionLabel: string;
  name: string;
  role: string;
  former: boolean;
  entries: [string, string][];
};
export type PendingLinks = {
  items: PendingLink[];
  add: (link: Omit<PendingLink, "key">) => void;
  remove: (key: number) => void;
};

export type Candidate = {
  id: string;
  name: string;
  kind: ConnectionKind;
  group_type: GroupType | null;
  person_roles: PersonRole[];
  /** "BND-0042" */
  catalog: string;
};

export function LinksPanel({
  subjectId,
  rows,
  options,
  candidates,
  memberIds,
  note,
  carry,
  pending,
  heading = true,
  usesSeeens,
}: {
  subjectId: string;
  rows: LinkRow[];
  options: AddOption[];
  candidates: Candidate[];
  // Set on a band: who's already in it, for Paste Members.
  memberIds?: string[];
  // Optional line under the heading, such as how saving works on the edit page.
  note?: string;
  // Set on a band: what a new member can take from it (#124).
  carry?: Carry | null;
  // The Add form: links wait here until the connection is saved.
  pending?: PendingLinks;
  /** Off on the profile page, where the panel's title bar says it (#126). */
  heading?: boolean;
  /** On the band marked "us": people with a login get a mark (#44). */
  usesSeeens?: string[];
}) {
  const [adding, setAdding] = useState<string | null>(null);
  // Bands can take a pasted lineup (once they exist).
  const canPaste = !pending && Boolean(memberIds) && options.some((o) => o.id === "member");
  const waiting = (pending?.items ?? []).filter((p) => options.some((o) => o.id === p.optionId));
  const sections = SECTION_ORDER.map((title) => ({
    title,
    rows: rows.filter((r) => r.section === title),
  })).filter((s) => s.rows.length);

  return (
    <section aria-labelledby="links-heading" className="flex flex-col gap-4">
      <h2 id="links-heading" className={heading ? "display-s" : "sr-only"}>
        Connections
      </h2>
      {note ? <p className="-mt-2 text-sm text-muted">{note}</p> : null}

      {pending ? (
        waiting.length ? (
          <ul className="rows flex flex-col">
            {waiting.map((p) => (
              <li key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 break-words">
                  <span className="text-sm text-muted">{p.optionLabel}: </span>
                  {p.name}
                  {p.role ? <span className="text-muted"> · {p.role}</span> : null}
                  {p.former ? <span className="text-muted"> (former)</span> : null}
                </span>
                <button type="button" className="action-link text-sm" onClick={() => pending.remove(p.key)}>
                  Remove<span className="sr-only"> {p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No links yet. They&rsquo;re added when you save.</p>
        )
      ) : sections.length === 0 ? (
        <p className="text-muted">No links yet. Add bandmates, labels, or the places they work.</p>
      ) : (
        sections.map((s) => (
          <div key={s.title} className="flex flex-col gap-1">
            <h3 className="label text-muted">{s.title}</h3>
            <ul className="rows flex flex-col">
              {[...s.rows]
                .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
                .map((r) => (
                  <LinkItem key={r.id} row={r} usesSeeens={usesSeeens?.includes(r.otherId) ?? false} />
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
        {canPaste ? (
          <button
            type="button"
            className="button-secondary"
            aria-expanded={adding === "paste"}
            onClick={() => setAdding(adding === "paste" ? null : "paste")}
          >
            Paste Members
          </button>
        ) : null}
      </div>

      {canPaste && adding === "paste" ? (
        <PasteLineup
          bandId={subjectId}
          people={candidates.filter((c) => c.kind === "person").map(({ id, name, catalog }) => ({ id, name, catalog }))}
          memberIds={memberIds ?? []}
          carry={carry ?? null}
          onDone={() => setAdding(null)}
        />
      ) : null}

      {options
        .filter((o) => o.id === adding)
        .map((o) => (
          <AddLinkForm
            key={o.id}
            subjectId={subjectId}
            option={o}
            candidates={candidates.filter((c) => fitsTarget(o.target, c))}
            carry={o.id === "member" ? (carry ?? null) : null}
            onPending={pending?.add}
            onDone={() => setAdding(null)}
          />
        ))}
    </section>
  );
}

function LinkItem({ row, usesSeeens }: { row: LinkRow; usesSeeens: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [state, action, saving] = useActionState<LinkState, FormData>(async (prev, fd) => {
    const result = await updateLink(row.id, prev, fd).catch(
      offline({ error: "Couldn't reach Seeens. Try again.", attempt: Date.now() } as LinkState),
    );
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
          </Link>{" "}
          <span className="text-xs text-muted whitespace-nowrap">{row.otherCatalog}</span>
          {usesSeeens ? <span className="tag ml-2 align-middle">Uses Seeens</span> : null}
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
        <div role="group" aria-label={`Edit link to ${row.otherName}`} className="flex flex-col gap-3 panel p-3">
          <DetachedForm id={formId} action={action} />
          <div className="flex flex-col gap-2">
            <label htmlFor={`${formId}-role`} className="label">
              Role or Detail
            </label>
            <input
              {...noAutofill}
              id={`${formId}-role`}
              form={formId}
              name="role"
              defaultValue={row.role ?? ""}
              className="field"
              autoFocus
            />
          </div>
          <label className="choice self-start">
            <input type="checkbox" form={formId} name="former" defaultChecked={!row.isCurrent} />
            <span>Former</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" form={formId} className="button-primary" disabled={saving}>
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
        </div>
      ) : null}

      {mode === "remove" ? (
        <div role="group" aria-label={`Remove link to ${row.otherName}`} className="flex flex-col gap-2 panel p-3">
          <p className="text-sm">Remove the link to {row.otherName}? Both listings stay in the directory.</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button-primary"
              disabled={pending}
              autoFocus
              onClick={() =>
                startTransition(async () => {
                  const r = await removeLink(row.id).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
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
  carry,
  onPending,
  onDone,
}: {
  subjectId: string;
  option: AddOption;
  candidates: Candidate[];
  carry: Carry | null;
  onPending?: PendingLinks["add"];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<LinkState, FormData>(async (prev, fd) => {
    // Not saved yet: keep the fields, and add the link with the connection.
    if (onPending) {
      const other = String(fd.get("other_id") ?? "");
      const name =
        other === "__new__" ? String(fd.get("new_name") ?? "") : (candidates.find((c) => c.id === other)?.name ?? "");
      if (!other || !name) return { error: "Pick someone, or type a name to add someone new.", attempt: Date.now() };
      onPending({
        optionId: option.id,
        optionLabel: option.label.replace(/^Add /, ""),
        name,
        role: String(fd.get("role") ?? "").trim(),
        former: fd.get("former") === "on",
        entries: [...fd.entries()].map(([k, v]) => [k, String(v)]),
      });
      onDone();
      return { ok: true, attempt: Date.now() };
    }
    const result = await addLink(subjectId, option.id, prev, fd).catch(
      offline({ error: "Couldn't reach Seeens. Try again.", attempt: Date.now() } as LinkState),
    );
    if (result.ok) onDone();
    return result;
  }, {});
  const [picked, setPicked] = useState("");
  const [newName, setNewName] = useState("");
  const id = useId();
  const types = newGroupTypes(option.target);
  const [pick, setPick] = useState(() => (hasCarry(carry) ? pickAll(carry) : null));
  const [role, setRole] = useState("");
  const roleRef = useRef<HTMLInputElement>(null);

  return (
    <div role="group" aria-labelledby={`${id}-title`} className="flex flex-col gap-4 panel p-4">
      <DetachedForm id={id} action={action} />
      <h3 id={`${id}-title`} className="font-semibold">
        {option.label}
      </h3>

      <Combobox
        label="Find in your directory, or type a new name"
        form={id}
        multiple={false}
        autoFocus
        options={candidates.map((c) => ({
          value: c.id,
          label: c.name,
          // The number tells apart two people with the same name, and you can
          // type it to find someone.
          hint: `${formatType(c)} · ${c.catalog}`,
          search: c.catalog,
        }))}
        create={{ verb: "Add New" }}
        onChange={(values, created) => {
          setPicked(values[0] ?? (created[0] ? "__new__" : ""));
          setNewName(created[0] ?? "");
        }}
      />
      <input type="hidden" form={id} name="other_id" value={picked} />
      <input type="hidden" form={id} name="new_name" value={picked === "__new__" ? newName : ""} />

      {picked === "__new__" && types.length > 1 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-type`} className="label">
            What is {newName}?
          </label>
          <select id={`${id}-type`} form={id} name="new_group_type" className="field" defaultValue={types[0]}>
            {types.map((t) => (
              <option key={t} value={t}>
                {GROUP_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {picked === "__new__" && hasCarry(carry) && pick ? (
        <>
          <CarryFields carry={carry} value={pick} onChange={setPick} who={newName || "the new person"} />
          <input type="hidden" form={id} name="carry" value="1" />
          {pick.town ? <input type="hidden" form={id} name="carry_town" value="on" /> : null}
          {pick.sceneIds.map((sid) => (
            <input key={sid} type="hidden" form={id} name="carry_scene" value={sid} />
          ))}
          {pick.played ? <input type="hidden" form={id} name="carry_played" value="on" /> : null}
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-role`} className="label">
          Role or Detail <span className="font-normal text-muted">(Optional)</span>
        </label>
        <input
          {...noAutofill}
          ref={roleRef}
          id={`${id}-role`}
          form={id}
          name="role"
          placeholder={option.rolePlaceholder}
          className="field"
          onChange={(e) => setRole(e.target.value)}
        />
        {/* Members: one tap for the usual instruments, so roles come out tidy
            and "Plays" can read them (#140). Typing still works for anything else. */}
        {option.kind === "member" ? (
          <div role="group" aria-label="Common instruments" className="flex flex-wrap gap-2">
            {QUICK_INSTRUMENTS.map((i) => {
              const on = instrumentsFromRole(role).includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  className="tag tag-button"
                  aria-pressed={on}
                  onClick={() => {
                    const parts = role
                      .split(",")
                      .map((p) => p.trim())
                      .filter(Boolean);
                    const next = on
                      ? parts.filter((p) => !instrumentsFromRole(p).includes(i))
                      : [...parts, INSTRUMENTS[i]];
                    const value = next.join(", ");
                    setRole(value);
                    if (roleRef.current) roleRef.current.value = value;
                  }}
                >
                  {INSTRUMENTS[i]}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <label className="choice self-start">
        <input type="checkbox" form={id} name="former" />
        <span>Former</span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="submit" form={id} className="button-primary" disabled={pending || !picked}>
          {pending ? "Saving…" : onPending ? "Add Link" : "Save Link"}
        </button>
        <button type="button" className="button-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
      <p role="alert" className="text-sm font-medium text-error">
        {state.error ? `Error: ${state.error}` : null}
      </p>
    </div>
  );
}
