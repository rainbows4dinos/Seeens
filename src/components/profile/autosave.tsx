"use client";

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { autosaveConnection } from "@/lib/connections/actions";
import { groupForField, type AutosaveGroup, type ConnectionFormErrors } from "@/lib/connections/form";

// Saving as you go on the profile page (#126). Each panel's fields sit in an
// AutosaveForm; when they change it sends just the groups of fields that
// changed. The page header's SaveStatus says how that's going.

type Status = { state: "idle" | "saving" | "saved" | "failed"; message?: string };

const StatusContext = createContext<{ status: Status; set: (s: Status) => void }>({
  status: { state: "idle" },
  set: () => {},
});

export function AutosaveProvider({ children }: { children: ReactNode }) {
  const [status, set] = useState<Status>({ state: "idle" });
  return <StatusContext value={{ status, set }}>{children}</StatusContext>;
}

/** "Saves as you go", then "Saving…", "Saved", or what went wrong. */
export function SaveStatus() {
  const { status } = useContext(StatusContext);
  const text =
    status.state === "saving"
      ? "Saving…"
      : status.state === "saved"
        ? "Saved"
        : status.state === "failed"
          ? status.message ?? "Couldn't save."
          : "Saves as you go";
  return (
    <p
      aria-live="polite"
      className={`text-sm ${status.state === "failed" ? "font-medium text-error" : "text-muted"}`}
    >
      {text}
    </p>
  );
}

// The latest field errors for the panel a field is in.
const ErrorsContext = createContext<ConnectionFormErrors>({});
export function useFieldErrors() {
  return useContext(ErrorsContext);
}

// What the form would post, for the fields autosave owns: field -> values.
function snapshot(form: HTMLFormElement) {
  const out = new Map<string, string[]>();
  for (const [k, v] of new FormData(form)) {
    if (!groupForField(k)) continue;
    out.set(k, [...(out.get(k) ?? []), String(v)]);
  }
  return out;
}

function changedGroups(before: Map<string, string[]>, after: Map<string, string[]>) {
  const groups = new Set<AutosaveGroup>();
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    if (JSON.stringify(before.get(k) ?? []) !== JSON.stringify(after.get(k) ?? [])) {
      const g = groupForField(k);
      if (g) groups.add(g);
    }
  }
  return [...groups];
}

// Typing saves after a pause; a pick (select, checkbox, a suggestion) saves
// right away; leaving a field saves what's there. Town and combobox text
// isn't posted until something's picked, so typing there waits.
const TYPING_PAUSE = 1000;

export function AutosaveForm({
  connectionId,
  className,
  children,
}: {
  connectionId: string;
  className?: string;
  children: ReactNode;
}) {
  const { set } = useContext(StatusContext);
  const form = useRef<HTMLFormElement>(null);
  const saved = useRef<Map<string, string[]> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  const [errors, setErrorsState] = useState<ConnectionFormErrors>({});
  const errorsRef = useRef<ConnectionFormErrors>({});
  const setErrors = (e: ConnectionFormErrors) => {
    errorsRef.current = e;
    setErrorsState(e);
  };

  async function save(target?: HTMLFormElement | null) {
    const el = target ?? form.current;
    if (!el || !saved.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    const now = snapshot(el);
    // A town still being typed (its box has focus, nothing picked yet) waits
    // for a pick or for leaving the box.
    const typingTown = document.activeElement?.closest("[data-place-field]") && !now.get("place_id")?.[0];
    const groups = changedGroups(saved.current, now).filter((g) => !(typingTown && g === "place"));
    if (!groups.length) {
      // Back to what's saved (an error undone): nothing to send, nothing wrong.
      if (Object.keys(errorsRef.current).length) {
        setErrors({});
        set({ state: "idle" });
      }
      return;
    }
    busy.current = true;
    set({ state: "saving" });
    try {
      const res = await autosaveConnection(connectionId, groups, new FormData(el));
      if (res.ok) {
        saved.current = now;
        setErrors({});
        set({ state: "saved" });
      } else {
        setErrors(res.errors);
        set({
          state: "failed",
          message: res.errors.form ?? "Couldn't save yet. Fix the field marked below.",
        });
      }
    } catch {
      set({ state: "failed", message: "Couldn't reach Seeens. Your changes are still here; they'll save when you edit again." });
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        void save(el);
      }
    }
  }

  function schedule(delay: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, delay);
  }

  // What's on screen at first is what's saved.
  useEffect(() => {
    // Kept here: by the time the cleanup runs, React has let go of the ref.
    const el = form.current;
    if (el) saved.current = snapshot(el);
    // Picks in the town and combobox fields land in hidden inputs, which
    // fire no events: watch them change, appear (a chip), or go.
    const watch = new MutationObserver((records) => {
      const hidden = (n: Node) => n instanceof HTMLInputElement && n.type === "hidden";
      if (
        records.some(
          (r) =>
            (r.type === "attributes" && hidden(r.target)) ||
            [...r.addedNodes, ...r.removedNodes].some((n) => hidden(n) || (n instanceof Element && n.querySelector('input[type="hidden"]'))),
        )
      ) {
        schedule(300);
      }
    });
    if (el) watch.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["value"] });

    // Switching tabs or closing the page: send what's waiting now. If a save
    // is still waiting as the page unloads, the browser asks first.
    const flush = () => {
      if (document.visibilityState === "hidden" && timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void save(el);
      }
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (timer.current || busy.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", warn);
    // Leaving the page with a change still waiting: send it.
    return () => {
      watch.disconnect();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", warn);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void save(el);
      }
    };
    // Runs once; save reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const named = (e: { target: EventTarget }) => {
    const name = (e.target as HTMLInputElement).name;
    return Boolean(name && groupForField(name));
  };

  return (
    <form
      ref={form}
      noValidate
      className={className}
      // Enter in a field saves now instead of submitting.
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        schedule(0);
      }}
      onInput={(e) => {
        if (named(e)) schedule(TYPING_PAUSE);
      }}
      // React's onChange is every keystroke in a text field; picks only here.
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "radio") schedule(150);
      }}
      // A suggestion or option clicked, a link row added or removed.
      onClick={() => schedule(300)}
      // A suggestion picked or a chip removed from the keyboard, in a
      // combobox (whose text box has no name; its picks are hidden inputs).
      onKeyUp={(e) => {
        if (!named(e) && (e.key === "Enter" || e.key === "Backspace" || e.key === "Delete")) schedule(300);
      }}
      // Leaving a field. A little later, so a suggestion click lands first.
      onBlur={() => schedule(300)}
    >
      <ErrorsContext value={errors}>{children}</ErrorsContext>
    </form>
  );
}
