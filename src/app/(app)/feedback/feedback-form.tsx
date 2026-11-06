"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { sendFeedback, type SendState } from "@/lib/feedback/actions";
import { KINDS, describeBrowser, isKind, type Kind } from "@/lib/feedback/labels";
import { createClient } from "@/lib/supabase/client";
import { encode, loadImage } from "@/lib/photos/copier";

// Send Feedback (#71). What's sent along is shown before sending. The text
// is kept in this tab until it's sent, so a failed send or a reload doesn't
// lose it.

const DRAFT = "seeens:feedback-draft";
const BUCKET = "feedback-screenshots";

type Props = {
  userId: string;
  from: string;
  band: string;
  path: string | null;
  version: string;
  digest: string | null;
  initialKind: Kind | null;
};

export function FeedbackForm({ userId, from, band, path, version, digest, initialKind }: Props) {
  const [kind, setKind] = useState<Kind | "">(initialKind ?? "");
  const [body, setBody] = useState("");
  const [shot, setShot] = useState<{ blob: Blob; ext: string; url: string } | null>(null);
  const [shotError, setShotError] = useState<string>();
  const [env, setEnv] = useState({ browser: "", screen: "" });
  const [restored, setRestored] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, dispatch] = useActionState<SendState, FormData>(async (prev, fd) => {
    if (shot) {
      const p = `${userId}/${crypto.randomUUID()}.${shot.ext}`;
      const { error } = await createClient().storage.from(BUCKET).upload(p, shot.blob, { contentType: shot.blob.type });
      if (error) return { error: "Couldn't upload the screenshot. Remove it, or try again." };
      fd.set("screenshot_path", p);
    }
    return sendFeedback(prev, fd).catch(() => ({ error: "Couldn't reach Seeens. Your text is still here; try again." }));
  }, {});

  // Browser details and any saved draft, once in the browser.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading the browser once after mount */
    setEnv({ browser: describeBrowser(navigator.userAgent), screen: `${window.innerWidth}×${window.innerHeight}` });
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT) ?? "null") as { kind?: string; body?: string } | null;
      if (saved?.body) {
        setBody(saved.body);
        if (!initialKind && isKind(saved.kind)) setKind(saved.kind);
        setRestored(true);
      }
    } catch {
      // No storage: start empty.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialKind]);

  useEffect(() => {
    try {
      if (state.sent) sessionStorage.removeItem(DRAFT);
      else if (body) sessionStorage.setItem(DRAFT, JSON.stringify({ kind, body }));
    } catch {
      // No storage: the text still stays on screen.
    }
  }, [kind, body, state.sent]);

  useEffect(() => () => (shot ? URL.revokeObjectURL(shot.url) : undefined), [shot]);

  const pick = async (file: File | undefined) => {
    setShotError(undefined);
    if (!file) return;
    try {
      // Redrawn smaller as WebP: drops location and camera details from photos.
      const { blob, ext } = await encode(await loadImage(file, 2000), 0.85);
      if (blob.size > 5 * 1024 * 1024) return setShotError("That image is too big. Try a smaller screenshot.");
      setShot({ blob, ext, url: URL.createObjectURL(blob) });
    } catch {
      setShotError("Couldn't read that image. Try a PNG or JPEG.");
    }
  };

  if (state.sent)
    return (
      <div className="flex flex-col items-start gap-4" role="status">
        <p className="font-medium">Thanks. It&rsquo;s sent.</p>
        <p className="text-muted">You&rsquo;ll see it below, with where it&rsquo;s at.</p>
        <button type="button" className="button-secondary" onClick={() => window.location.reload()}>
          Send Another
        </button>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // Sent without the form's own reset, so the text stays if it fails.
        startTransition(() => dispatch(fd));
      }}
    >
      <input type="hidden" name="path" value={path ?? ""} />
      <input type="hidden" name="screen" value={env.screen} />
      <input type="hidden" name="digest" value={digest ?? ""} />

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-2">What Kind</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label key={k.value} className="choice">
              <input
                type="radio"
                name="kind"
                value={k.value}
                checked={kind === k.value}
                onChange={() => setKind(k.value)}
                required
              />
              <span>{k.label}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">{KINDS.find((k) => k.value === kind)?.hint ?? "Pick one."}</p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="feedback-body" className="label">
          What Happened
        </label>
        <p id="feedback-body-hint" className="-mt-1 text-sm text-muted">
          What you did, what you expected, what you got. Or the idea, in your words.
        </p>
        <textarea
          id="feedback-body"
          name="body"
          className="field min-h-40"
          maxLength={4000}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-describedby="feedback-body-hint"
        />
        {restored ? <p className="text-sm text-muted">Picked up where you left off.</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="label" id="feedback-shot-label">
          Screenshot (Optional)
        </p>
        {shot ? (
          <div className="flex flex-wrap items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview */}
            <img src={shot.url} alt="Your screenshot" className="max-h-48 max-w-full border border-strong" />
            <button type="button" className="button-secondary" onClick={() => setShot(null)}>
              Remove
            </button>
          </div>
        ) : (
          <label className="button-secondary file-button self-start">
            Add a Screenshot
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-describedby="feedback-shot-label"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
        )}
        {shotError ? (
          <p role="alert" className="text-sm font-medium text-error">
            Error: {shotError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border border-dashed border-strong p-3 text-sm">
        <p className="label">Sent With It</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
          <dt className="text-muted">From</dt>
          <dd className="break-words">
            {from}, {band}
          </dd>
          <dt className="text-muted">Page</dt>
          <dd className="break-all">{path ?? "None"}</dd>
          {digest ? (
            <>
              <dt className="text-muted">Error</dt>
              <dd className="break-all">{digest}</dd>
            </>
          ) : null}
          <dt className="text-muted">Browser</dt>
          <dd>{env.browser || "…"}</dd>
          <dt className="text-muted">Window</dt>
          <dd>{env.screen || "…"}</dd>
          <dt className="text-muted">Version</dt>
          <dd>{version}</dd>
        </dl>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-error">
          Error: {state.error}
        </p>
      ) : null}
      <button type="submit" className="button-primary self-start" disabled={pending}>
        {pending ? "Sending…" : "Send Feedback"}
      </button>
    </form>
  );
}
