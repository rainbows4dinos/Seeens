"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { offline } from "@/lib/offline";
import {
  COPY_MAX,
  ORIGINAL_MAX,
  copy,
  encode,
  hasWebGL,
  isBlank,
  loadImage,
  resetCopier,
  resize,
} from "@/lib/photos/copier";
import { discardUpload, removePhoto, savePhoto } from "@/lib/photos/actions";
import { CONTRAST, EXPOSURE, GRIT, OFFSET, PLATES, type CopierSettings, type Plate } from "@/lib/photos/settings";

// Add or change a connection's photo (#37). Pick or drop a photo (phones get
// the camera or library), tune the copier, and save. The copier runs here;
// only the resized, EXIF-free original and the copy are uploaded.

export type PhotoProps = {
  connectionId: string;
  workspaceId: string;
  name: string;
  /** Signed links to the current copy and original, if there's a photo. */
  photoUrl: string | null;
  originalUrl: string | null;
  photoPath: string | null;
  originalPath: string | null;
  settings: CopierSettings | null;
  alt: string | null;
  /** Settings for a new photo: the plate follows the status. */
  defaults: CopierSettings;
  /**
   * A connection that isn't saved yet (the Add form): Save Photo hands the
   * encoded files back instead of uploading, and Remove clears them.
   * connectionId and workspaceId aren't used.
   */
  capture?: (photo: CapturedPhoto | null) => void;
};

/** A photo picked before its connection exists, uploaded once it's saved. */
export type CapturedPhoto = {
  original: Blob;
  originalExt: string;
  copy: Blob;
  copyExt: string;
  settings: CopierSettings;
  alt: string;
  /** Object URLs for the thumbnail and for re-copying. */
  copyUrl: string;
  originalUrl: string;
};

/**
 * Uploads a captured photo for a connection that now exists, and points the
 * connection at it. Returns an error message, or null.
 */
export async function uploadCaptured(workspaceId: string, connectionId: string, photo: CapturedPhoto, name: string) {
  const folder = `${workspaceId}/${connectionId}/`;
  const id = crypto.randomUUID();
  const bucket = createClient().storage.from("connection-photos");
  const originalPath = `${folder}${id}-original.${photo.originalExt}`;
  const path = `${folder}${id}.${photo.copyExt}`;
  const uploaded: string[] = [];
  try {
    for (const [p, blob] of [
      [originalPath, photo.original],
      [path, photo.copy],
    ] as const) {
      const { error } = await bucket.upload(p, blob, { contentType: blob.type, upsert: false });
      if (error) throw error;
      uploaded.push(p);
    }
    const result = await savePhoto(connectionId, {
      path,
      originalPath,
      settings: photo.settings,
      alt: photo.alt.trim() || `Photo of ${name}`,
    });
    if (result.error) throw new Error(result.error);
    return null;
  } catch {
    if (uploaded.length) await discardUpload(connectionId, uploaded).catch(() => {});
    return "Couldn't upload the photo.";
  }
}

const PLATE_LABELS: Record<Plate, string> = { none: "None", cyan: "C", magenta: "M", yellow: "Y" };
const PLATE_NAMES: Record<Plate, string> = { none: "No ink plate", cyan: "Cyan", magenta: "Magenta", yellow: "Yellow" };

export function PhotoCopier(props: PhotoProps & { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="dialog window"
      aria-labelledby="copier-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog itself, outside its box) closes it.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {open ? <CopierBody {...props} /> : null}
    </dialog>
  );
}

function CopierBody({
  connectionId,
  workspaceId,
  name,
  originalUrl,
  photoPath,
  originalPath,
  settings: saved,
  alt: savedAlt,
  defaults,
  capture,
  onClose,
}: PhotoProps & { onClose: () => void }) {
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const plain = useRef<HTMLCanvasElement>(null);

  const [original, setOriginal] = useState<HTMLCanvasElement | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [fileChanged, setFileChanged] = useState(false);
  const [settings, setSettings] = useState<CopierSettings>(saved ?? defaults);
  // Before the connection is saved, a blank alt becomes "Photo of <name>" on upload.
  const [alt, setAlt] = useState(savedAlt ?? (capture ? "" : `Photo of ${name}`));
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(Boolean(originalUrl));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const [webgl] = useState(() => hasWebGL());

  // Re-copying: start from the kept original.
  useEffect(() => {
    if (!originalUrl) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(originalUrl);
        if (!res.ok) throw new Error();
        const canvas = await loadImage(await res.blob(), ORIGINAL_MAX);
        if (!live) return;
        setOriginal(canvas);
        setSource(resize(canvas, COPY_MAX));
      } catch {
        if (live) setError("Couldn't load the original. Pick the photo again to re-copy it.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [originalUrl]);

  // Run the copier whenever the photo or a setting changes.
  useEffect(() => {
    if (!source || !preview.current) return;
    copy(source, preview.current, settings);
    if (isBlank(preview.current)) {
      resetCopier();
      copy(source, preview.current, settings);
    }
  }, [source, settings]);
  useEffect(() => {
    const c = plain.current;
    if (!source || !c) return;
    c.width = source.width;
    c.height = source.height;
    c.getContext("2d")!.drawImage(source, 0, 0);
  }, [source, showOriginal]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("That isn't a photo. Try a JPEG, PNG, or WebP.");
      return;
    }
    try {
      const canvas = await loadImage(file, ORIGINAL_MAX);
      setOriginal(canvas);
      setSource(resize(canvas, COPY_MAX));
      setFileChanged(true);
      setMessage("Photo loaded. Tune the copy, then save.");
    } catch {
      setError("Couldn't open that photo. Try a JPEG, PNG, or WebP.");
    }
  }

  const set = <K extends keyof CopierSettings>(key: K, value: CopierSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  function save() {
    if (!original || !source || !preview.current) return;
    setError("");
    if (capture) {
      startTransition(async () => {
        try {
          copy(source, preview.current!, settings);
          if (isBlank(preview.current!)) {
            resetCopier();
            copy(source, preview.current!, settings);
          }
          if (isBlank(preview.current!)) throw new Error("Couldn't run the copier. Try again.");
          const o = await encode(original, 0.85);
          const c = await encode(preview.current!, 0.9);
          capture({
            original: o.blob,
            originalExt: o.ext,
            copy: c.blob,
            copyExt: c.ext,
            settings,
            alt,
            copyUrl: URL.createObjectURL(c.blob),
            originalUrl: URL.createObjectURL(o.blob),
          });
          onClose();
        } catch (e) {
          setError(
            e instanceof Error && e.message.startsWith("Couldn") ? e.message : "Couldn't make the copy. Try again.",
          );
        }
      });
      return;
    }
    startTransition(async () => {
      const folder = `${workspaceId}/${connectionId}/`;
      const id = crypto.randomUUID();
      const uploaded: string[] = [];
      const bucket = createClient().storage.from("connection-photos");
      try {
        let nextOriginal = originalPath;
        if (fileChanged || !originalPath) {
          setMessage("Uploading the original…");
          const { blob, ext } = await encode(original, 0.85);
          nextOriginal = `${folder}${id}-original.${ext}`;
          const { error } = await bucket.upload(nextOriginal, blob, { contentType: blob.type, upsert: false });
          if (error) throw error;
          uploaded.push(nextOriginal);
        }
        // Always write a fresh copy: it's small, and saving again repairs a
        // copy that came out wrong (say, blank from a dropped WebGL context).
        setMessage("Uploading the copy…");
        // Make sure the canvas holds exactly what's saved, and never save
        // a blank copy: if the copier lost its context, start a fresh one.
        copy(source, preview.current!, settings);
        if (isBlank(preview.current!)) {
          resetCopier();
          copy(source, preview.current!, settings);
        }
        if (isBlank(preview.current!)) throw new Error("Couldn't run the copier. Try saving again.");
        const { blob, ext } = await encode(preview.current!, 0.9);
        const nextPath = `${folder}${id}.${ext}`;
        const { error } = await bucket.upload(nextPath, blob, { contentType: blob.type, upsert: false });
        if (error) throw error;
        uploaded.push(nextPath);
        setMessage("Saving…");
        const result = await savePhoto(connectionId, {
          path: nextPath,
          originalPath: nextOriginal!,
          settings,
          alt,
        }).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
        if (result.error) throw new Error(result.error);
        setMessage("Photo saved.");
        onClose();
      } catch (e) {
        if (uploaded.length) await discardUpload(connectionId, uploaded).catch(() => {});
        setMessage("");
        setError(
          e instanceof Error && e.message.startsWith("Couldn") ? e.message : "Couldn't save the photo. Try again.",
        );
      }
    });
  }

  function remove() {
    if (capture) {
      capture(null);
      onClose();
      return;
    }
    startTransition(async () => {
      setError("");
      const result = await removePhoto(connectionId).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  const hasPhoto = Boolean(photoPath);

  return (
    <div className="flex flex-col">
      <div className="dialog-title">
        <h2 id="copier-title">The copier · {name}</h2>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="copier">
        <div
          className="copier-stage"
          data-dragging={dragging || undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
        >
          {source ? (
            <>
              <canvas
                ref={preview}
                className="copier-canvas"
                hidden={showOriginal}
                role="img"
                aria-label={`Copy of the photo of ${name}`}
              />
              <canvas
                ref={plain}
                className="copier-canvas"
                hidden={!showOriginal}
                role="img"
                aria-label={`Original photo of ${name}`}
              />
            </>
          ) : (
            <div className="copier-empty">
              {loading ? (
                <p className="text-muted">Loading the photo…</p>
              ) : (
                <>
                  <button type="button" className="button-primary" onClick={() => fileInput.current?.click()}>
                    Choose a Photo
                  </button>
                  <p className="text-sm text-muted max-sm:hidden">or drop one here</p>
                </>
              )}
            </div>
          )}
          <p className="caption text-muted">
            Photos of people: press shots, or ones taken with their OK. Location data is removed before upload.
            <br />
            Not AI, just a shader effect.
          </p>
        </div>

        <div className="copier-controls">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <label htmlFor={`${ids}-exposure`} className="label">
                Lighter / Darker
              </label>
              <output htmlFor={`${ids}-exposure`} className="label tabular-nums">
                {settings.exposure > 0 ? "+" : ""}
                {settings.exposure.toFixed(2)}
              </output>
            </div>
            <input
              id={`${ids}-exposure`}
              type="range"
              className="range"
              {...EXPOSURE}
              value={settings.exposure}
              disabled={!source}
              aria-describedby={`${ids}-exposure-hint`}
              aria-valuetext={
                settings.exposure === 0
                  ? "Normal"
                  : `${Math.abs(settings.exposure).toFixed(2)} ${settings.exposure > 0 ? "lighter" : "darker"}`
              }
              onChange={(e) => set("exposure", Number(e.target.value))}
            />
            <p id={`${ids}-exposure-hint`} className="text-sm text-muted">
              Logos and colored artwork usually want it lighter.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <label htmlFor={`${ids}-contrast`} className="label">
                Contrast
              </label>
              <output htmlFor={`${ids}-contrast`} className="label tabular-nums">
                {settings.contrast.toFixed(1)}
              </output>
            </div>
            <input
              id={`${ids}-contrast`}
              type="range"
              className="range"
              {...CONTRAST}
              value={settings.contrast}
              disabled={!source}
              onChange={(e) => set("contrast", Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <label htmlFor={`${ids}-grit`} className="label">
                Toner grit
              </label>
              <output htmlFor={`${ids}-grit`} className="label tabular-nums">
                {settings.grit.toFixed(2)}
              </output>
            </div>
            <input
              id={`${ids}-grit`}
              type="range"
              className="range"
              {...GRIT}
              value={settings.grit}
              disabled={!source}
              onChange={(e) => set("grit", Number(e.target.value))}
            />
          </div>

          <fieldset className="flex flex-col gap-1" disabled={!source}>
            <legend className="label pb-1">Ink plate</legend>
            <div className="segmented segmented-radio">
              {PLATES.map((p) => (
                <label key={p} title={PLATE_NAMES[p]}>
                  <input
                    type="radio"
                    name={`${ids}-plate`}
                    value={p}
                    checked={settings.plate === p}
                    onChange={() => set("plate", p)}
                  />
                  {p === "none" ? null : <span className={`plate-chip plate-${p}`} aria-hidden="true" />}
                  <span aria-hidden={p === "none" ? undefined : "true"}>{PLATE_LABELS[p]}</span>
                  {p === "none" ? null : <span className="sr-only">{PLATE_NAMES[p]}</span>}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <label htmlFor={`${ids}-offset`} className="label">
                Plate offset
              </label>
              <output htmlFor={`${ids}-offset`} className="label tabular-nums">
                {settings.offset} px
              </output>
            </div>
            <input
              id={`${ids}-offset`}
              type="range"
              className="range"
              {...OFFSET}
              value={settings.offset}
              disabled={!source || settings.plate === "none"}
              aria-describedby={`${ids}-offset-hint`}
              onChange={(e) => set("offset", Number(e.target.value))}
            />
            <p id={`${ids}-offset-hint`} className="text-sm text-muted">
              How far the ink plate slips. At 0 it hides under the black.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOriginal}
              disabled={!source}
              onChange={(e) => setShowOriginal(e.target.checked)}
            />
            Show original
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="button-secondary"
              disabled={!source || !webgl}
              onClick={() => set("seed", (settings.seed + 1 + Math.floor(Math.random() * 997)) % 1000)}
            >
              New Grain
            </button>
            <button type="button" className="button-secondary" onClick={() => fileInput.current?.click()}>
              {source ? "Different Photo" : "Choose a Photo"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {webgl ? null : (
            <p className="text-sm text-muted">
              This browser can&rsquo;t run the copier, so photos get a plain black-and-white look.
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-alt`} className="label">
              Description
            </label>
            <input
              id={`${ids}-alt`}
              className="field"
              value={alt}
              maxLength={300}
              onChange={(e) => setAlt(e.target.value)}
              aria-describedby={`${ids}-alt-hint`}
            />
            <p id={`${ids}-alt-hint`} className="text-sm text-muted">
              Read out by screen readers.
            </p>
          </div>
        </div>
      </div>

      <div className="dialog-actions">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="button-primary" disabled={!source || pending} onClick={save}>
            {pending ? "Saving…" : "Save Photo"}
          </button>
          <button type="button" className="button-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <p role="status" className="text-sm empty:hidden">
            {error ? <span className="text-error">{error}</span> : message}
          </p>
        </div>
        {hasPhoto ? (
          confirmRemove ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">Remove the photo?</span>
              <button type="button" className="button-secondary" onClick={remove} disabled={pending}>
                Remove
              </button>
              <button type="button" className="action-link text-sm" onClick={() => setConfirmRemove(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="action-link text-sm" onClick={() => setConfirmRemove(true)}>
              Remove photo
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
