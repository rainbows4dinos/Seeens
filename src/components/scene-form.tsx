"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { removeScene, type SceneFormState, type SceneFormValues } from "@/lib/scenes/actions";
import { PlaceField } from "@/components/place-field";

type Action = (prev: SceneFormState, formData: FormData) => Promise<SceneFormState>;

export function SceneForm({
  action,
  initial,
  parents,
  submitLabel,
  sceneId,
  sceneName,
}: {
  action: Action;
  initial: SceneFormValues;
  parents: { id: string; name: string }[];
  submitLabel: string;
  sceneId?: string;
  sceneName?: string;
}) {
  const [state, formAction, pending] = useActionState<SceneFormState, FormData>(
    async (prev, fd) => {
      try {
        return await action(prev, fd);
      } catch {
        const get = (k: string) => String(fd.get(k) ?? "").trim();
        return {
          values: {
            name: get("name"),
            description: get("description"),
            parentId: get("parent_id"),
            placeId: get("place_id"),
            placeText: get("place_text"),
            keepLocalityId: get("keep_locality_id"),
          },
          errors: { form: "Couldn't reach Seeens. Your changes are still here; try again." },
          attempt: Date.now(),
        };
      }
    },
    { values: initial, errors: {} },
  );
  const { values: v, errors } = state;
  const count = Object.keys(errors).filter((k) => k !== "form").length;

  return (
    <div className="flex flex-col gap-8">
      <form key={state.attempt ?? 0} action={formAction} noValidate className="flex flex-col gap-5">
        {errors.form || count ? (
          <div role="alert" className="border-2 border-error bg-surface p-3 text-sm font-semibold text-error">
            {errors.form ?? `Couldn't save yet. Fix ${count === 1 ? "the field" : `${count} fields`} marked below.`}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="s-name" className="text-sm font-medium">
            Name
          </label>
          <p id="s-name-hint" className="-mt-1 text-sm text-muted">
            Like &ldquo;Portland DIY&rdquo; or, for a bigger region, &ldquo;Pacific Northwest.&rdquo;
          </p>
          <input
            id="s-name"
            name="name"
            defaultValue={v.name}
            className="field"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "s-name-hint s-name-error" : "s-name-hint"}
          />
          {errors.name ? (
            <p id="s-name-error" className="text-sm font-medium text-error">
              Error: {errors.name}
            </p>
          ) : null}
        </div>

        <PlaceField
          initialId={v.placeId ? Number(v.placeId) : null}
          initialLabel={v.placeText}
          keepLocalityId={v.keepLocalityId || null}
          error={errors.placeText}
          label="Town (optional)"
          hint="Where the scene is centered. Leave empty for a region like the Pacific Northwest."
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="s-parent" className="text-sm font-medium">
            Part of a bigger scene? <span className="font-normal text-muted">(optional)</span>
          </label>
          <select
            id="s-parent"
            name="parent_id"
            defaultValue={v.parentId}
            className="field"
            aria-invalid={errors.parentId ? true : undefined}
            aria-describedby={errors.parentId ? "s-parent-error" : undefined}
          >
            <option value="">No, it stands on its own</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.parentId ? (
            <p id="s-parent-error" className="text-sm font-medium text-error">
              Error: {errors.parentId}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="s-description" className="text-sm font-medium">
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea id="s-description" name="description" rows={3} defaultValue={v.description} className="field" />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="button-primary" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </button>
          <Link href="/scenes" className="button-secondary">
            Cancel
          </Link>
        </div>
      </form>

      {sceneId ? <RemoveScene id={sceneId} name={sceneName ?? "this scene"} /> : null}
    </div>
  );
}

function RemoveScene({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rule-top pt-6">
      {!confirming ? (
        <button type="button" className="button-secondary self-start" onClick={() => setConfirming(true)}>
          Remove scene
        </button>
      ) : (
        <div role="group" aria-label={`Remove ${name}`} className="flex flex-col gap-3 panel p-4">
          <p className="font-medium">Remove {name}?</p>
          <p className="text-sm text-muted">
            Connections in it stay in the directory; they just lose this scene tag. Scenes inside it become
            stand-alone.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button-primary"
              disabled={pending}
              autoFocus
              onClick={() =>
                startTransition(async () => {
                  const r = await removeScene(id).catch(() => ({ error: "Couldn't reach Seeens. Try again." }));
                  if (r?.error) setError(r.error);
                })
              }
            >
              {pending ? "Removing…" : "Remove"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <p role="alert" className="text-sm font-medium text-error">
        {error ? `Error: ${error}` : null}
      </p>
    </div>
  );
}
