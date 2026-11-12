"use client";

import { ChevronDown, ChevronUp, Draggable, View, ViewOff } from "@carbon/icons-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { saveHomeLayout } from "@/lib/home/actions";

// Arrange Home (#313): an edit mode on Home itself. Drag a row by its handle,
// or use its arrows, and hide the ones you don't use. Just for you, in this
// band.
//
// Every row is on the page, hidden ones too, so edit mode can show them.
// Order is CSS `order` on a flex column: the server's rows never move in
// the DOM, so their state and Suspense boundaries stay put while you drag.

type Row = { key: string; label: string; shown: boolean };

type Arrange = {
  editing: boolean;
  rows: Row[];
  move: (key: string, to: number) => void;
  toggle: (key: string) => void;
  startDrag: (key: string, e: React.PointerEvent) => void;
  dragging: string | null;
};
const ArrangeContext = createContext<Arrange | null>(null);

export function HomeArrange({
  rows: initial,
  isDefault,
  children,
}: {
  rows: Row[];
  isDefault: boolean;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // A newer layout from the server (after a save) when not editing.
  const [prev, setPrev] = useState(initial);
  if (!editing && initial !== prev) {
    setPrev(initial);
    setRows(initial);
  }

  function move(key: string, to: number) {
    setRows((rs) => {
      const from = rs.findIndex((r) => r.key === key);
      if (from < 0 || to < 0 || to >= rs.length || to === from) return rs;
      const next = [...rs];
      const [r] = next.splice(from, 1);
      next.splice(to, 0, r);
      setSaid(`${r.label}, ${to + 1} of ${next.length}.`);
      return next;
    });
  }

  function toggle(key: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, shown: !r.shown } : r)));
  }

  // Drag by the handle: the row follows the pointer past its neighbors'
  // midpoints. Pointer capture keeps it going outside the handle.
  function startDrag(key: string, e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    setDragging(key);
    const onMove = (ev: PointerEvent) => {
      const els = [...(list.current?.querySelectorAll<HTMLElement>("[data-home-row]") ?? [])]
        .filter((el) => el.dataset.homeRow !== key)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      const to = els.filter((el) => {
        const r = el.getBoundingClientRect();
        return ev.clientY > r.top + r.height / 2;
      }).length;
      move(key, to);
      // Near the edges, scroll.
      if (ev.clientY < 80) scrollBy(0, -12);
      else if (ev.clientY > innerHeight - 60) scrollBy(0, 12);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setDragging(null);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  function finish(save: Row[] | null) {
    setError(false);
    if (!save) {
      setRows(initial);
      setEditing(false);
      requestAnimationFrame(() => opener.current?.focus());
      return;
    }
    startTransition(async () => {
      const res = await saveHomeLayout(
        save.filter((r) => r.shown).map((r) => r.key),
        save.filter((r) => !r.shown).map((r) => r.key),
      ).catch(() => ({ ok: false }));
      if (!res.ok) return setError(true);
      setEditing(false);
      router.refresh();
      requestAnimationFrame(() => opener.current?.focus());
    });
  }

  return (
    <ArrangeContext value={{ editing, rows, move, toggle, startDrag, dragging }}>
      <div ref={list} className="flex flex-col gap-10" data-arranging={editing || undefined}>
        {children}
      </div>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      {editing ? (
        <div className="save-bar home-arrange-bar" role="region" aria-label="Arrange Home">
          <p className="text-sm">
            <strong>Arranging Home.</strong> Drag rows by their handle, or use the arrows. Just for you.
          </p>
          {error ? (
            <p role="alert" className="text-sm font-medium text-error">
              Couldn&rsquo;t save. Try again.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="button-primary" disabled={pending} onClick={() => finish(rows)}>
              {pending ? "Saving…" : "Done"}
            </button>
            <button type="button" className="button-secondary" disabled={pending} onClick={() => finish(null)}>
              Cancel
            </button>
            {!isDefault ? (
              <button type="button" className="button-secondary" disabled={pending} onClick={() => finish([])}>
                Reset to Default
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <button
            ref={opener}
            type="button"
            className="button-secondary"
            onClick={() => {
              setRows(initial);
              setEditing(true);
              requestAnimationFrame(() => list.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
            }}
          >
            Arrange Home
          </button>
        </div>
      )}
    </ArrangeContext>
  );
}

// One row of Home. Out of edit mode it's just the row (or nothing, if
// hidden). In edit mode it gets a bar with a drag handle, arrows, and
// Show/Hide, and the row itself can't be clicked.
export function HomeRow({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(ArrangeContext)!;
  const index = ctx.rows.findIndex((r) => r.key === id);
  const row = ctx.rows[index];
  if (!row) return null;
  if (!ctx.editing && !row.shown) return null;

  return (
    <div
      data-home-row={id}
      style={{ order: index }}
      className="home-section"
      data-editing={ctx.editing || undefined}
      data-hidden={row.shown ? undefined : ""}
      data-dragging={ctx.dragging === id || undefined}
    >
      {ctx.editing ? (
        <div className="home-section-bar">
          <button
            type="button"
            className="home-section-handle"
            aria-label={`Drag ${row.label}`}
            onPointerDown={(e) => ctx.startDrag(id, e)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
              e.preventDefault();
              ctx.move(id, e.key === "ArrowUp" ? index - 1 : index + 1);
            }}
          >
            <Draggable aria-hidden size={16} />
          </button>
          <span className="font-medium">{row.label}</span>
          {row.shown ? null : <span className="text-sm text-muted">Hidden</span>}
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              className="button-secondary control-sm"
              disabled={index === 0}
              onClick={() => ctx.move(id, index - 1)}
            >
              <ChevronUp aria-hidden size={16} />
              <span className="sr-only">Move {row.label} up</span>
            </button>
            <button
              type="button"
              className="button-secondary control-sm"
              disabled={index === ctx.rows.length - 1}
              onClick={() => ctx.move(id, index + 1)}
            >
              <ChevronDown aria-hidden size={16} />
              <span className="sr-only">Move {row.label} down</span>
            </button>
            <button type="button" className="button-secondary control-sm" onClick={() => ctx.toggle(id)}>
              {row.shown ? <ViewOff aria-hidden size={16} /> : <View aria-hidden size={16} />}
              {row.shown ? "Hide" : "Show"}
              <span className="sr-only"> {row.label}</span>
            </button>
          </span>
        </div>
      ) : null}
      {/* While arranging, the row is a picture of itself. */}
      <div
        className="home-section-body"
        inert={ctx.editing || undefined}
        data-empty={`Nothing in ${row.label} right now.`}
      >
        {children}
      </div>
    </div>
  );
}
