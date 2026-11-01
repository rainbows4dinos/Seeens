"use client";

import { noAutofill } from "@/lib/no-autofill";
import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { id: number; label: string };

// Accessible combobox (ARIA 1.2 pattern): type to search towns, arrow keys
// to move, Enter to pick, Escape to close. Submits the chosen place's id.
export function PlaceField({
  initialId,
  initialLabel,
  keepLocalityId,
  error,
  label = "Where they\u2019re based",
  hint = "Their home town, not where you met them. Type a town, like \u201cWalla Walla\u201d or \u201cPortland, ME.\u201d",
}: {
  initialId: number | null;
  initialLabel: string;
  keepLocalityId: string | null;
  error?: string;
  label?: string;
  hint?: string;
}) {
  const id = useId();
  const [text, setText] = useState(initialLabel);
  const [placeId, setPlaceId] = useState<number | null>(initialId);
  // A pre-GeoNames place that couldn't be matched stays as-is until edited.
  const [keep, setKeep] = useState(keepLocalityId);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = text.trim();
    if (placeId !== null || keep || q.length < 2) return;
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setStatus("loading");
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error();
        const data: Suggestion[] = await res.json();
        setResults(data);
        setActive(data.length ? 0 : -1);
        setOpen(true);
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [text, placeId, keep]);

  const choose = (s: Suggestion) => {
    setText(s.label);
    setPlaceId(s.id);
    setKeep(null);
    setOpen(false);
    setResults([]);
  };

  const listId = `${id}-list`;
  const describedBy = [`${id}-hint`, `${id}-status`, error ? "c-place-error" : null].filter(Boolean).join(" ");

  return (
    <div className="relative flex flex-col gap-2">
      <label htmlFor="c-place" className="text-sm font-medium">
        {label}
      </label>
      <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
        {hint}
      </p>
      <input {...noAutofill}
        id="c-place"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPlaceId(null);
          setKeep(null);
          if (e.target.value.trim().length < 2) {
            setResults([]);
            setOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && results.length) {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === "ArrowUp" && results.length) {
            e.preventDefault();
            setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
          } else if (e.key === "Enter" && open && active >= 0 && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="field"
      />
      <input type="hidden" name="place_id" value={placeId ?? ""} />
      <input type="hidden" name="place_text" value={text.trim()} />
      <input type="hidden" name="keep_locality_id" value={keep ?? ""} />

      <ul
        id={listId}
        role="listbox"
        aria-label="Matching towns"
        hidden={!open || results.length === 0}
        className="absolute top-full z-10 mt-1 w-full overflow-hidden panel shadow-[var(--shadow-hard)]"
      >
        {results.map((s, i) => (
          <li
            key={s.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              choose(s);
            }}
            onMouseEnter={() => setActive(i)}
            className={`cursor-pointer px-3 py-2.5 ${i === active ? "bg-line/50 font-semibold" : ""}`}
          >
            {s.label}
          </li>
        ))}
      </ul>

      <p id={`${id}-status`} className="text-sm text-muted" aria-live="polite">
        {status === "loading"
          ? "Searching…"
          : status === "error"
            ? "Search isn't working right now. Try again."
            : placeId !== null
              ? `Selected: ${text}`
              : keep
                ? "Saved before town search existed. Pick a town to update it."
                : open && results.length === 0
                  ? "No towns match. Try a nearby bigger town."
                  : ""}
      </p>
      {error ? (
        <p id="c-place-error" className="text-sm font-medium text-error">
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}
