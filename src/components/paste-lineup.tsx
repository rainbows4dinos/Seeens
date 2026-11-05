"use client";

import { noAutofill } from "@/lib/no-autofill";
import { offline } from "@/lib/offline";
import { useId, useRef, useState, useTransition } from "react";
import { DetachedForm } from "@/components/detached-form";
import { addBandMembers, type AddMembersResult } from "@/lib/affiliations/actions";
import { CarryFields, hasCarry, pickAll, type Carry } from "@/components/carry-fields";
import { MAX_NAME_LENGTH, MAX_ROLE_LENGTH, MAX_ROWS, parseLineup } from "@/lib/affiliations/lineup";

type Person = { id: string; name: string; catalog: string };

type Row = {
  key: number;
  include: boolean;
  name: string;
  roles: string;
  former: boolean;
  // People in the directory with the same name, and which one (if any) to link.
  matches: Person[];
  personId: string; // "" adds a new person
  alreadyMember: boolean;
};

const EXAMPLE = "Jo Example - vocals, guitar\nRiley Sample - drums\nSam Placeholder - bass (former)";

// Paste a band's lineup, check it, and add everyone as members in one save.
export function PasteLineup({
  bandId,
  people,
  memberIds,
  carry = null,
  onDone,
}: {
  bandId: string;
  people: Person[];
  memberIds: string[];
  /** What new people can take from the band (#124). */
  carry?: Carry | null;
  onDone: () => void;
}) {
  const [pick, setPick] = useState(() => (hasCarry(carry) ? pickAll(carry) : null));
  const id = useId();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const included = rows?.filter((r) => r.include).length ?? 0;

  const preview = () => {
    const parsed = parseLineup(text);
    if (!parsed.length) {
      setError("Couldn't find any names. Put one person per line, like “Jo Example - vocals, guitar.”");
      textRef.current?.focus();
      return;
    }
    setError(undefined);
    setRows(
      parsed.map((p, key) => {
        const matches = people.filter((c) => c.name.trim().toLowerCase() === p.name.toLowerCase());
        const personId = matches[0]?.id ?? "";
        const alreadyMember = Boolean(personId && memberIds.includes(personId));
        return { key, ...p, matches, personId, alreadyMember, include: !alreadyMember };
      }),
    );
  };

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) =>
      rs!.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if ("personId" in patch) {
          next.alreadyMember = Boolean(next.personId && memberIds.includes(next.personId));
          next.include = !next.alreadyMember;
        }
        return next;
      }),
    );

  const save = () => {
    if (!rows) return;
    const picked = rows.filter((r) => r.include);
    const missing = picked.find((r) => !r.personId && !r.name.trim());
    if (missing) {
      setError("Every new person needs a name. Fill it in or uncheck the row.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result: AddMembersResult = await addBandMembers(
        bandId,
        picked.map((r) => ({ name: r.name, roles: r.roles, former: r.former, personId: r.personId || null })),
        pick,
      ).catch(offline({ ok: false, error: "Couldn't reach Seeens. Nothing was saved; try again." } as AddMembersResult));
      if (result.ok) onDone();
      else setError(result.error);
    });
  };

  return (
    <div role="group" aria-labelledby={`${id}-title`} className="flex flex-col gap-4 panel p-4">
      <DetachedForm id={id} action={() => (rows ? save() : preview())} />
      <h3 id={`${id}-title`} className="font-semibold">
        Paste Members
      </h3>

      {!rows ? (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-text`} className="label">
              Lineup
            </label>
            <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
              Paste it from their site, Bandcamp, or a press kit. One person per line, with roles after a dash.
              Nothing is saved until you check it.
            </p>
            <textarea
              {...noAutofill}
              ref={textRef}
              id={`${id}-text`}
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              aria-invalid={error ? true : undefined}
              className="field font-mono"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" form={id} className="button-primary" disabled={!text.trim()}>
              Check Names
            </button>
            <button type="button" className="button-secondary" onClick={onDone}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Fix any names or roles, and uncheck anyone you don&rsquo;t want to add.
            {rows.length >= MAX_ROWS ? ` Only the first ${MAX_ROWS} lines are shown.` : ""}
          </p>
          <ul className="rows flex flex-col">
            {rows.map((r) => (
              <PreviewRow key={r.key} row={r} formId={id} onChange={(patch) => update(r.key, patch)} />
            ))}
          </ul>
          {/* Only people new to the directory take these; others keep their own. */}
          {hasCarry(carry) && pick && rows.some((r) => r.include && !r.personId) ? (
            <CarryFields carry={carry} value={pick} onChange={setPick} who="the new people" />
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" form={id} className="button-primary" disabled={pending || included === 0}>
              {pending ? "Adding…" : included === 1 ? "Add 1 Member" : `Add ${included} Members`}
            </button>
            <button type="button" className="button-secondary" onClick={() => setRows(null)} disabled={pending}>
              Back
            </button>
            <button type="button" className="button-secondary" onClick={onDone} disabled={pending}>
              Cancel
            </button>
          </div>
        </>
      )}

      <p id={`${id}-error`} role="alert" className="text-sm font-medium text-error">
        {error ? `Error: ${error}` : null}
      </p>
    </div>
  );
}

function PreviewRow({
  row: r,
  formId,
  onChange,
}: {
  row: Row;
  formId: string;
  onChange: (patch: Partial<Row>) => void;
}) {
  const id = `${formId}-${r.key}`;
  const who = r.name || "this person";
  return (
    <li className="flex flex-col gap-3 py-3 sm:grid sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end sm:gap-3">
      <label className="choice self-start sm:self-end">
        <input
          type="checkbox"
          form={formId}
          checked={r.include}
          onChange={(e) => onChange({ include: e.target.checked })}
        />
        <span>
          Add<span className="sr-only"> {who}</span>
        </span>
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-name`} className="label">
          Name
        </label>
        <input
          {...noAutofill}
          id={`${id}-name`}
          form={formId}
          value={r.name}
          maxLength={MAX_NAME_LENGTH}
          disabled={!r.include || Boolean(r.personId)}
          onChange={(e) => onChange({ name: e.target.value })}
          className="field"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-roles`} className="label">
          Roles
        </label>
        <input
          {...noAutofill}
          id={`${id}-roles`}
          form={formId}
          value={r.roles}
          maxLength={MAX_ROLE_LENGTH}
          disabled={!r.include}
          placeholder="vocals, guitar"
          onChange={(e) => onChange({ roles: e.target.value })}
          className="field"
        />
      </div>

      <label className="choice self-start sm:self-end">
        <input
          type="checkbox"
          form={formId}
          checked={r.former}
          disabled={!r.include}
          onChange={(e) => onChange({ former: e.target.checked })}
        />
        <span>
          Former<span className="sr-only"> member, {who}</span>
        </span>
      </label>

      <div className="text-sm sm:col-span-4">
        {r.matches.length ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-match`} className="label">
              Already in Your Directory
            </label>
            <select
              id={`${id}-match`}
              form={formId}
              value={r.personId}
              onChange={(e) => onChange({ personId: e.target.value })}
              className="field"
            >
              {r.matches.map((m) => (
                <option key={m.id} value={m.id}>
                  Link to {m.name} ({m.catalog})
                </option>
              ))}
              <option value="">Add as a New Person</option>
            </select>
            {r.alreadyMember ? <p className="text-muted">Already a member of this band, so they&rsquo;ll be skipped.</p> : null}
          </div>
        ) : (
          <p className="text-muted">New to your directory. They&rsquo;ll be added as a musician.</p>
        )}
      </div>
    </li>
  );
}
