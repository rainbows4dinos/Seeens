"use client";

import Link from "next/link";
import Papa from "papaparse";
import { Upload } from "@carbon/icons-react";
import { useId, useMemo, useState, useTransition } from "react";
import { STATUSES, STATUS_LABELS, formatType, type ConnectionStatus } from "@/lib/connections/labels";
import { venueLine } from "@/lib/connections/venue-details";
import { lookupTowns, runImport, type ImportResult, type TownMatches } from "@/lib/import/actions";
import {
  SHEET_KINDS,
  TARGETS,
  buildRows,
  guessMapping,
  matchKey,
  type DraftRow,
  type SheetKind,
  type Target,
} from "@/lib/import/rows";

type Existing = { id: string; name: string; kind: "person" | "group"; group_type: string | null };
type Sheet = { fileName: string; headers: string[]; data: string[][] };
type Step = "file" | "columns" | "towns" | "review" | "done";

// Spreadsheet import (#148): a CSV in, a review, then one save. Nothing is
// written until Import; the save is all or nothing.
export function ImportWizard({ existing }: { existing: Existing[] }) {
  const [step, setStep] = useState<Step>("file");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [kind, setKind] = useState<SheetKind>("venues");
  const [status, setStatus] = useState<ConnectionStatus>("neutral");
  const [mapping, setMapping] = useState<Target[]>([]);
  const [defaultTown, setDefaultTown] = useState("");
  const [towns, setTowns] = useState<TownMatches[]>([]);
  const [placeFor, setPlaceFor] = useState<Record<string, number | null>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const built = useMemo(
    () => (sheet && mapping.length ? buildRows(sheet.headers, sheet.data, mapping, kind, { status }) : null),
    [sheet, mapping, kind, status],
  );

  // Who each row fills in, if they're already here: same name and kind.
  const matches = useMemo(() => {
    const byKey = new Map<string, Existing[]>();
    for (const e of existing) byKey.set(matchKey(e.name), [...(byKey.get(matchKey(e.name)) ?? []), e]);
    const out = new Map<number, Existing>();
    for (const r of built?.rows ?? []) {
      const m = (byKey.get(matchKey(r.name)) ?? []).find(
        (e) => e.kind === r.kind && (!e.group_type || !r.group_type || e.group_type === r.group_type),
      );
      if (m) out.set(r.line, m);
    }
    return out;
  }, [built, existing]);

  function readFile(file: File) {
    setError("");
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: (res) => {
        const [headers = [], ...data] = res.data;
        if (!headers.length || !data.length) {
          setError("That file doesn't have a header row and at least one row under it.");
          return;
        }
        setSheet({ fileName: file.name, headers, data });
      },
      error: () => setError("Couldn't read that file. Save it as CSV and try again."),
    });
  }

  function toColumns() {
    if (!sheet) return;
    setMapping(guessMapping(sheet.headers, kind));
    setStep("columns");
  }

  function toTowns() {
    if (!built) return;
    const texts = [
      ...new Set(
        built.rows
          .map((r) => r.town ?? defaultTown)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ];
    if (!texts.length) {
      setTowns([]);
      setStep("review");
      return;
    }
    startTransition(async () => {
      const found = await lookupTowns(texts);
      setTowns(found);
      setPlaceFor((prev) => Object.fromEntries(found.map((t) => [t.text, prev[t.text] ?? t.options[0]?.id ?? null])));
      setStep("towns");
    });
  }

  function save() {
    if (!built) return;
    setError("");
    const rows = built.rows
      .filter((r) => !excluded.has(r.line))
      .map(({ line, town, ...r }) => ({
        ...r,
        place_id: placeFor[(town ?? defaultTown).trim()] ?? null,
        match_id: matches.get(line)?.id ?? null,
      }));
    startTransition(async () => {
      const res = await runImport(rows);
      if (res.ok) {
        setResult(res);
        setStep("done");
      } else setError(res.error);
    });
  }

  const included = (built?.rows ?? []).filter((r) => !excluded.has(r.line));
  const nNew = included.filter((r) => !matches.has(r.line)).length;
  const nFill = included.length - nNew;

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Steps">
        {(["file", "columns", "towns", "review"] as const).map((s, i) => (
          <li
            key={s}
            aria-current={step === s ? "step" : undefined}
            className={step === s ? "font-semibold text-primary" : ""}
          >
            {i + 1}. {{ file: "File", columns: "Columns", towns: "Towns", review: "Review" }[s]}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="border-2 border-error bg-surface p-3 text-sm font-medium text-error">
          {error}
        </p>
      ) : null}

      {step === "file" ? (
        <FileStep
          sheet={sheet}
          kind={kind}
          status={status}
          onFile={readFile}
          onKind={setKind}
          onStatus={setStatus}
          onNext={toColumns}
        />
      ) : null}

      {step === "columns" && sheet ? (
        <section className="flex flex-col gap-4" aria-labelledby="cols-h">
          <h2 id="cols-h" className="display-s">
            Where each column goes
          </h2>
          <p className="text-sm text-muted">
            Guessed from the headers. Anything Seeens can&rsquo;t read, or marked with a ? (&ldquo;Chris?&rdquo;), goes
            into notes instead of a field.
          </p>
          <div className="flex flex-col divide-y divide-[var(--color-border-subtle)] border border-strong bg-surface">
            {sheet.headers.map((h, i) => {
              const samples = sheet.data
                .map((row) => row[i]?.trim())
                .filter(Boolean)
                .slice(0, 3);
              return (
                <div key={i} className="grid gap-2 p-3 sm:grid-cols-[1fr_16rem] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{h.trim() || `Column ${i + 1}`}</p>
                    <p className="truncate text-sm text-muted">{samples.join(" · ") || "Empty"}</p>
                  </div>
                  <label className="sr-only" htmlFor={`col-${i}`}>
                    Where {h || `column ${i + 1}`} goes
                  </label>
                  <select
                    id={`col-${i}`}
                    className="field"
                    value={mapping[i]}
                    onChange={(e) => setMapping((m) => m.map((t, j) => (j === i ? (e.target.value as Target) : t)))}
                  >
                    {(Object.keys(TARGETS) as Target[])
                      .filter((t) => !("venue" in TARGETS[t]) || kind === "venues" || kind === "mixed")
                      .map((t) => (
                        <option key={t} value={t}>
                          {TARGETS[t].label}
                        </option>
                      ))}
                  </select>
                </div>
              );
            })}
          </div>
          {!mapping.includes("name") ? (
            <p className="text-sm font-medium text-error">Pick the column with names.</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <label htmlFor="default-town" className="label">
              Town for rows without one <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="default-town"
              className="field sm:max-w-80"
              value={defaultTown}
              onChange={(e) => setDefaultTown(e.target.value)}
              placeholder="Portland, OR"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button-primary"
              disabled={!mapping.includes("name") || pending}
              onClick={toTowns}
            >
              {pending ? "Looking up towns…" : "Next"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setStep("file")}>
              Back
            </button>
          </div>
        </section>
      ) : null}

      {step === "towns" ? (
        <section className="flex flex-col gap-4" aria-labelledby="towns-h">
          <h2 id="towns-h" className="display-s">
            Which towns?
          </h2>
          <p className="text-sm text-muted">Each town in the sheet, matched to a place. Change any that are wrong.</p>
          <div className="flex flex-col gap-3">
            {towns.map((t, i) => (
              <div key={t.text} className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
                <label htmlFor={`town-${i}`} className="font-medium break-words">
                  {t.text}
                </label>
                <select
                  id={`town-${i}`}
                  className="field"
                  value={placeFor[t.text] ?? ""}
                  onChange={(e) =>
                    setPlaceFor((p) => ({ ...p, [t.text]: e.target.value ? Number(e.target.value) : null }))
                  }
                >
                  {t.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                  <option value="">{t.options.length ? "None of these: leave blank" : "No match: leave blank"}</option>
                </select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="button-primary" onClick={() => setStep("review")}>
              Next
            </button>
            <button type="button" className="button-secondary" onClick={() => setStep("columns")}>
              Back
            </button>
          </div>
        </section>
      ) : null}

      {step === "review" && built ? (
        <section className="flex flex-col gap-4" aria-labelledby="review-h">
          <h2 id="review-h" className="display-s">
            Review
          </h2>
          <p className="text-sm">
            <strong>{nNew}</strong> new, <strong>{nFill}</strong> already here (only their blanks get filled in; nothing
            they have is changed)
            {built.skipped.length ? (
              <>
                , <strong>{built.skipped.length}</strong> skipped
              </>
            ) : null}
            . Untick any you don&rsquo;t want.
          </p>
          {built.skipped.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Skipped lines</summary>
              <ul className="flex flex-col gap-1 pt-2">
                {built.skipped.map((s) => (
                  <li key={s.line}>
                    Line {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] border border-strong bg-surface">
            {built.rows.map((r) => (
              <ReviewRow
                key={r.line}
                row={r}
                match={matches.get(r.line) ?? null}
                town={townLabel(r, defaultTown, towns, placeFor)}
                on={!excluded.has(r.line)}
                onToggle={(on) =>
                  setExcluded((x) => {
                    const next = new Set(x);
                    if (on) next.delete(r.line);
                    else next.add(r.line);
                    return next;
                  })
                }
              />
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="button-primary" disabled={pending || !included.length} onClick={save}>
              {pending ? "Importing…" : `Import ${included.length}`}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setStep(towns.length ? "towns" : "columns")}
            >
              Back
            </button>
          </div>
        </section>
      ) : null}

      {step === "done" && result ? (
        <section role="status" className="flex flex-col items-start gap-3 border border-strong bg-surface p-6">
          <p className="font-medium">
            Added {result.added}
            {result.filled ? `, filled in ${result.filled}` : ""}
            {result.bookersAdded
              ? `, and ${result.bookersAdded} new ${result.bookersAdded === 1 ? "booker" : "bookers"}`
              : ""}
            .
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/?type=${kind === "venues" ? "venues" : kind === "people" ? "people" : kind === "mixed" ? "all" : "bands"}`}
              className="button-primary"
            >
              See Them in the Directory
            </Link>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setSheet(null);
                setResult(null);
                setExcluded(new Set());
                setStep("file");
              }}
            >
              Import Another
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FileStep({
  sheet,
  kind,
  status,
  onFile,
  onKind,
  onStatus,
  onNext,
}: {
  sheet: Sheet | null;
  kind: SheetKind;
  status: ConnectionStatus;
  onFile: (f: File) => void;
  onKind: (k: SheetKind) => void;
  onStatus: (s: ConnectionStatus) => void;
  onNext: () => void;
}) {
  const fileId = useId();
  return (
    <section className="flex flex-col gap-5" aria-label="File">
      <p className="text-muted">
        Bring in a sheet of bands, venues, or people. From Google Sheets, Excel, or Numbers, download or export it as
        CSV first. You&rsquo;ll check everything before it&rsquo;s saved.
      </p>
      <div className="flex flex-col gap-2">
        {/* A real button: the file input sits inside it, out of sight but focusable. */}
        <label htmlFor={fileId} className="button-secondary file-button self-start">
          <Upload size={16} aria-hidden="true" />
          {sheet ? "Choose Another CSV" : "Upload CSV"}
          <input
            id={fileId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {sheet ? (
          <p className="text-sm text-muted">
            {sheet.fileName}: {sheet.data.length} rows, {sheet.headers.length} columns.
          </p>
        ) : null}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-2">What&rsquo;s in it?</legend>
        {(Object.keys(SHEET_KINDS) as SheetKind[]).map((k) => (
          <label key={k} className="choice self-start">
            <input type="radio" name="sheet-kind" checked={kind === k} onChange={() => onKind(k)} />
            <span>{SHEET_KINDS[k]}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="import-status" className="label">
          Status for everyone new
        </label>
        <p className="-mt-1 text-sm text-muted">A Status column overrides it. People already here keep theirs.</p>
        <select
          id="import-status"
          className="field sm:max-w-80"
          value={status}
          onChange={(e) => onStatus(e.target.value as ConnectionStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <button type="button" className="button-primary" disabled={!sheet} onClick={onNext}>
          Next
        </button>
      </div>
    </section>
  );
}

function ReviewRow({
  row: r,
  match,
  town,
  on,
  onToggle,
}: {
  row: DraftRow;
  match: Existing | null;
  town: string | null;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  const details = [
    formatType({ kind: r.kind, group_type: r.group_type as never, person_roles: r.person_roles as never }),
    town,
    venueLine(r.venue),
    r.venue.special_terms ? `Terms: ${r.venue.special_terms}` : null,
    r.booked_by.length ? `Booked by ${r.booked_by.join(", ")}` : null,
    r.links.length ? `${r.links.length} ${r.links.length === 1 ? "link" : "links"}` : null,
    r.email,
  ].filter(Boolean);
  return (
    <li className={`flex gap-3 p-3 ${on ? "" : "opacity-60"}`}>
      <input
        type="checkbox"
        className="mt-1 size-4.5 shrink-0 accent-[var(--color-accent-primary)]"
        checked={on}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Import ${r.name}`}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium break-words">{r.name}</span>
          {match ? <span className="tag">Already here: fill blanks</span> : <span className="tag">New</span>}
          <span className="text-sm text-muted">line {r.line}</span>
        </p>
        <p className="text-sm text-muted break-words">{details.join(" · ")}</p>
        {r.notes ? <p className="text-sm break-words whitespace-pre-line">{r.notes}</p> : null}
      </div>
    </li>
  );
}

function townLabel(r: DraftRow, fallback: string, towns: TownMatches[], placeFor: Record<string, number | null>) {
  const text = (r.town ?? fallback).trim();
  if (!text) return null;
  const id = placeFor[text];
  return towns.find((t) => t.text === text)?.options.find((o) => o.id === id)?.label ?? null;
}
