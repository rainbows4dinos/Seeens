"use client";

import { useEffect, useRef, useState } from "react";
import { COPY_MAX, ORIGINAL_MAX, copy, encode, isBlank, loadImage, resetCopier, resize } from "@/lib/photos/copier";
import { photoTargets, type PhotoTarget } from "@/lib/photos/actions";
import { defaultSettings } from "@/lib/photos/settings";
import { uploadCaptured } from "@/components/photo-copier";

// Import photos (#321): after an import, each row's photo link goes through
// the copier with the default settings, like a photo added by hand, and only
// for listings that don't have a photo yet. One at a time, in this tab.

type Wanted = { id: string; url: string };
type State =
  | { phase: "checking" }
  | { phase: "adding"; done: number; total: number; failed: number }
  | { phase: "finished"; added: number; failed: number }
  | { phase: "none" };

export function ImportPhotos({ wanted, onBusy }: { wanted: Wanted[]; onBusy?: (busy: boolean) => void }) {
  const [state, setState] = useState<State>({ phase: wanted.length ? "checking" : "none" });
  const started = useRef(false);
  const busy = state.phase === "checking" || state.phase === "adding";
  useEffect(() => onBusy?.(busy), [busy, onBusy]);

  useEffect(() => {
    if (started.current || !wanted.length) return;
    started.current = true;
    (async () => {
      const targets = await photoTargets(wanted.map((w) => w.id)).catch(() => [] as PhotoTarget[]);
      const byId = new Map(wanted.map((w) => [w.id, w.url]));
      const todo = targets.filter((t) => byId.has(t.id));
      if (!todo.length) return setState({ phase: "none" });
      let added = 0;
      let failed = 0;
      setState({ phase: "adding", done: 0, total: todo.length, failed });
      for (const t of todo) {
        const ok = await addPhoto(t, byId.get(t.id)!).catch(() => false);
        if (ok) added++;
        else failed++;
        setState({ phase: "adding", done: added + failed, total: todo.length, failed });
      }
      setState({ phase: "finished", added, failed });
    })();
  }, [wanted]);

  // Leaving mid-way stops the rest; say so before it happens.
  useEffect(() => {
    if (state.phase !== "adding") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.phase]);

  if (state.phase === "none") return null;
  const plural = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;
  return (
    <p className="text-sm" role="status" aria-live="polite">
      {state.phase === "checking" ? "Checking for photos…" : null}
      {state.phase === "adding"
        ? `Adding photos: ${state.done} of ${state.total}. Stay on this page until it’s done.${state.failed ? ` ${state.failed} couldn’t be added so far.` : ""}`
        : null}
      {state.phase === "finished"
        ? `Added ${plural(state.added)}.${state.failed ? ` ${plural(state.failed)} couldn’t be added; add those by hand.` : ""}`
        : null}
    </p>
  );
}

async function addPhoto(t: PhotoTarget, url: string): Promise<boolean> {
  const res = await fetch(`/api/photo-fetch?url=${encodeURIComponent(url)}`);
  if (!res.ok) return false;
  const original = await loadImage(await res.blob(), ORIGINAL_MAX);
  const source = resize(original, COPY_MAX);
  const settings = defaultSettings(t.status, t.isUs);
  const target = document.createElement("canvas");
  copy(source, target, settings);
  if (isBlank(target)) {
    resetCopier();
    copy(source, target, settings);
  }
  if (isBlank(target)) return false;
  const o = await encode(original, 0.85);
  const c = await encode(target, 0.9);
  const error = await uploadCaptured(
    t.workspaceId,
    t.id,
    {
      original: o.blob,
      originalExt: o.ext,
      copy: c.blob,
      copyExt: c.ext,
      settings,
      alt: "",
      copyUrl: "",
      originalUrl: "",
    },
    t.name,
  );
  return error === null;
}
