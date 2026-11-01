"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { noAutofill } from "@/lib/no-autofill";

export type ComboOption = { value: string; label: string; hint?: string; depth?: number };

type Item = { kind: "option"; option: ComboOption } | { kind: "create"; label: string };

// A text box with a list that filters as you type (WAI-ARIA combobox).
// Multiple: picks show as removable tags and stay in the list, checked.
// Single: the pick fills the box; typing again clears it.
// With `create`, typed names that aren't options can be added as new.
// Picks are submitted as hidden inputs named `name` (and `create.name`,
// comma-joined), so it works in any form.
export function Combobox({
  label,
  hint,
  name,
  options,
  defaultValue = [],
  multiple = true,
  create,
  error,
  autoSubmit = false,
  onChange,
  autoFocus,
  labelClassName = "text-sm font-medium",
}: {
  label: string;
  hint?: string;
  name?: string;
  options: ComboOption[];
  defaultValue?: string[];
  multiple?: boolean;
  create?: { name?: string; defaultValue?: string[]; verb?: string };
  error?: string;
  /** Submit the surrounding form whenever the picks change. */
  autoSubmit?: boolean;
  onChange?: (values: string[], created: string[]) => void;
  autoFocus?: boolean;
  labelClassName?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [created, setCreated] = useState<string[]>(create?.defaultValue ?? []);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [announce, setAnnounce] = useState("");

  // Pick up new defaults from the server (filters cleared, URL changed).
  const defaultKey = defaultValue.join("\u0000");
  const [prevKey, setPrevKey] = useState(defaultKey);
  if (defaultKey !== prevKey) {
    setPrevKey(defaultKey);
    setSelected(defaultValue);
  }

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const singlePicked = !multiple && selected[0] && byValue.get(selected[0])?.label === query;
    const list: Item[] = options
      .filter((o) => !q || singlePicked || o.label.toLowerCase().includes(q))
      .map((option) => ({ kind: "option", option }));
    const exists =
      options.some((o) => o.label.toLowerCase() === q) || created.some((c) => c.toLowerCase() === q);
    if (create && q && !exists) list.push({ kind: "create", label: query.trim() });
    return list;
  }, [options, query, created, create, multiple, selected, byValue]);

  // Tell the parent, and submit the form if asked, after picks change.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange?.(selected, created);
    if (autoSubmit) wrapRef.current?.closest("form")?.requestSubmit();
    // onChange is a callback prop; only react to the picks themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, created, autoSubmit]);

  function choose(item: Item) {
    if (item.kind === "create") {
      // "Portland DIY, PNW" adds two.
      const names = item.label
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (multiple) {
        setCreated((c) => [...c, ...names.filter((n) => !c.includes(n))]);
        setQuery("");
      } else {
        setSelected([]);
        setCreated([item.label]);
        setQuery(item.label);
        setOpen(false);
      }
      setAnnounce(`Added ${names.join(", ")}.`);
      return;
    }
    const { value, label: l } = item.option;
    if (multiple) {
      const on = selected.includes(value);
      setSelected((s) => (on ? s.filter((v) => v !== value) : [...s, value]));
      setQuery("");
      setAnnounce(on ? `Removed ${l}.` : `Added ${l}.`);
    } else {
      setSelected([value]);
      setCreated([]);
      setQuery(l);
      setOpen(false);
      setAnnounce(`${l} picked.`);
    }
  }

  function removeValue(value: string) {
    setSelected((s) => s.filter((v) => v !== value));
    setAnnounce(`Removed ${byValue.get(value)?.label ?? value}.`);
    inputRef.current?.focus();
  }
  function removeCreated(n: string) {
    setCreated((c) => c.filter((x) => x !== n));
    setAnnounce(`Removed ${n}.`);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && items[active]) {
        e.preventDefault();
        choose(items[active]);
      } else if (open || query) {
        // Don't submit the form from a half-typed search.
        e.preventDefault();
        if (items.length === 1) choose(items[0]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (query) {
        setQuery("");
      }
    } else if (e.key === "Backspace" && multiple && !query) {
      if (created.length) removeCreated(created[created.length - 1]);
      else if (selected.length) removeValue(selected[selected.length - 1]);
    }
  }

  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  const activeId = open && items[active] ? `${id}-opt-${active}` : undefined;
  const hasTags = multiple && (selected.length > 0 || created.length > 0);

  return (
    <div
      ref={wrapRef}
      className="relative flex flex-col gap-2"
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <label htmlFor={`${id}-input`} className={labelClassName}>
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}

      <div className="relative">
      <div className="combo field" data-invalid={error ? true : undefined}>
        {hasTags ? (
          <ul className="contents" aria-label={`${label}: picked`}>
            {selected.map((v) => (
              <li key={v} className="combo-tag">
                {byValue.get(v)?.label ?? v}
                <button type="button" onClick={() => removeValue(v)} aria-label={`Remove ${byValue.get(v)?.label ?? v}`}>
                  ×
                </button>
              </li>
            ))}
            {created.map((n) => (
              <li key={`new:${n}`} className="combo-tag">
                {n} <span className="font-normal opacity-70">(new)</span>
                <button type="button" onClick={() => removeCreated(n)} aria-label={`Remove ${n}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          {...noAutofill}
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          autoFocus={autoFocus}
          value={query}
          placeholder={hasTags ? "" : multiple ? "Type or pick" : "Type a name"}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(e.target.value.trim() ? 0 : -1);
            if (!multiple && (selected.length || created.length)) {
              setSelected([]);
              setCreated([]);
            }
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        aria-multiselectable={multiple || undefined}
        hidden={!open || items.length === 0}
        className="combo-list"
      >
        {items.map((item, i) => {
          const isSel =
            item.kind === "option" &&
            (multiple ? selected.includes(item.option.value) : selected[0] === item.option.value);
          return (
            <li
              key={item.kind === "option" ? item.option.value : "__create__"}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={isSel}
              data-active={i === active || undefined}
              className="combo-option"
              style={item.kind === "option" && item.option.depth ? { paddingLeft: `${0.625 + item.option.depth}rem` } : undefined}
              // Keep focus in the text box.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
              onMouseMove={() => setActive(i)}
            >
              <span aria-hidden="true" className="combo-check">
                {isSel ? "✓" : item.kind === "create" ? "+" : ""}
              </span>
              {item.kind === "option" ? (
                <span>
                  {item.option.label}
                  {item.option.hint ? <span className="text-muted"> · {item.option.hint}</span> : null}
                </span>
              ) : (
                <span>
                  {create?.verb ?? "Add new"}: {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-error">
          Error: {error}
        </p>
      ) : null}

      {name ? selected.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
      {create?.name ? <input type="hidden" name={create.name} value={created.join(", ")} /> : null}
    </div>
  );
}
