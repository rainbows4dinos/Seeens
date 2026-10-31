"use client";

import Link from "next/link";
import { PlaceField } from "@/components/place-field";
import { useActionState, useState } from "react";
import { readForm, type ConnectionFormState, type ConnectionFormValues } from "@/lib/connections/form";
import {
  GROUP_TYPES,
  GROUP_TYPE_LABELS,
  KINDS,
  KIND_LABELS,
  PERSON_ROLES,
  PERSON_ROLE_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "@/lib/connections/labels";

type SceneOption = { id: string; name: string; parent_id: string | null };
type Action = (prev: ConnectionFormState, formData: FormData) => Promise<ConnectionFormState>;

export function ConnectionForm({
  action,
  initial,
  scenes,
  submitLabel,
  cancelHref,
}: {
  action: Action;
  initial: ConnectionFormValues;
  scenes: SceneOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<ConnectionFormState, FormData>(
    async (prev, fd) => {
      try {
        return await action(prev, fd);
      } catch {
        // The request itself failed (offline, server down): keep what they typed.
        return {
          values: readForm(fd),
          errors: { form: "Couldn't reach Seeens. Your changes are still here; try again." },
          attempt: Date.now(),
        };
      }
    },
    { values: initial, errors: {} },
  );

  // Remount after each failed save so fields show what was submitted.
  return (
    <FormBody
      key={state.attempt ?? 0}
      state={state}
      formAction={formAction}
      pending={pending}
      scenes={scenes}
      submitLabel={submitLabel}
      cancelHref={cancelHref}
    />
  );
}

function FormBody({
  state,
  formAction,
  pending,
  scenes,
  submitLabel,
  cancelHref,
}: {
  state: ConnectionFormState;
  formAction: (fd: FormData) => void;
  pending: boolean;
  scenes: SceneOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const { values: v, errors } = state;
  const [links, setLinks] = useState(() =>
    (v.links.length ? v.links : [{ label: "", url: "" }]).map((l, i) => ({ ...l, key: i })),
  );
  const [nextKey, setNextKey] = useState(links.length);
  const [kind, setKind] = useState(v.kind === "person" ? "person" : "group");
  // Open "More details" when it has content or an error to show.
  const detailsOpen = Boolean(
    errors.email ||
      errors.linkUrls ||
      v.email ||
      v.phone ||
      v.notes ||
      v.canHelpWith ||
      v.links.some((l) => l.url || l.label),
  );
  const errorCount =
    Object.keys(errors).filter((k) => k !== "form" && k !== "linkUrls").length +
    Object.keys(errors.linkUrls ?? {}).length;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-8">
      {errors.form || errorCount > 0 ? (
        <div role="alert" className="border-2 border-error bg-surface p-3 text-sm">
          <p className="font-semibold text-error">
            {errors.form ?? `Couldn't save yet. Fix ${errorCount === 1 ? "the field" : `${errorCount} fields`} marked below.`}
          </p>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg leading-6 font-semibold">Who they are</legend>

        <Field id="c-name" label="Name" error={errors.name}>
          <input
            id="c-name"
            name="name"
            required
            defaultValue={v.name}
            autoComplete="off"
            className="field"
            {...invalid("c-name", errors.name)}
          />
        </Field>

        <ChoiceGroup legend="Is this a person or a group?" error={errors.kind} errorId="kind-error">
          {KINDS.map((k) => (
            <label key={k} className="choice">
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
              />
              <span>{KIND_LABELS[k]}</span>
            </label>
          ))}
        </ChoiceGroup>

        {kind === "person" ? (
          <ChoiceGroup legend="What do they do?" hint="Any that apply." error={errors.personRoles} errorId="personRoles-error">
            {PERSON_ROLES.map((r) => (
              <Choice
                key={r}
                type="checkbox"
                name="person_roles"
                value={r}
                label={PERSON_ROLE_LABELS[r]}
                defaultChecked={v.personRoles.includes(r)}
              />
            ))}
          </ChoiceGroup>
        ) : (
          <ChoiceGroup legend="What is it?" error={errors.groupType} errorId="groupType-error">
            {GROUP_TYPES.map((g) => (
              <Choice
                key={g}
                type="radio"
                name="group_type"
                value={g}
                label={GROUP_TYPE_LABELS[g]}
                defaultChecked={v.groupType === g}
              />
            ))}
          </ChoiceGroup>
        )}

        {kind === "group" ? (
          <div className="flex flex-col gap-1">
            <Choice
              type="checkbox"
              name="is_us"
              value="on"
              label="This is our band"
              defaultChecked={v.isUs}
            />
            <p className="text-sm text-muted">Lets Seeens spot label mates and shared members.</p>
            {errors.isUs ? (
              <p id="isUs-error" className="text-sm font-medium text-error">
                Error: {errors.isUs}
              </p>
            ) : null}
          </div>
        ) : null}

        <PlaceField
          initialId={v.placeId ? Number(v.placeId) : null}
          initialLabel={v.placeText}
          keepLocalityId={v.keepLocalityId || null}
          error={errors.placeText}
        />

        <ChoiceGroup
          legend="Scenes"
          hint={scenes.length ? "Any they're part of." : "None yet. Add one below."}
        >
          {orderScenes(scenes).map((s) => (
            <Choice
              key={s.id}
              type="checkbox"
              name="scene_ids"
              value={s.id}
              label={s.name}
              defaultChecked={v.sceneIds.includes(s.id)}
            />
          ))}
        </ChoiceGroup>
        <Field
          id="c-new_scenes"
          label={scenes.length ? "Another scene (optional)" : "Scenes (optional)"}
          hint="Separate with commas, like: Portland DIY, Pacific Northwest."
          error={errors.newScenes}
        >
          <input
            id="c-new_scenes"
            name="new_scenes"
            defaultValue={v.newScenes}
            autoComplete="off"
            className="field"
            {...invalid("c-new_scenes", errors.newScenes, "c-new_scenes-hint")}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg leading-6 font-semibold">How you know them</legend>

        <ChoiceGroup legend="Status" error={errors.status} errorId="status-error">
          {STATUSES.map((st) => (
            <Choice
              key={st}
              type="radio"
              name="status"
              value={st}
              label={STATUS_LABELS[st]}
              defaultChecked={v.status === st}
            />
          ))}
        </ChoiceGroup>

        <div>
          <Choice
            type="checkbox"
            name="played_together"
            value="on"
            label="We've played together"
            defaultChecked={v.playedTogether}
          />
        </div>
      </fieldset>

      <details open={detailsOpen}>
        <summary className="cursor-pointer text-lg leading-6 font-semibold">
          More details <span className="text-sm font-normal text-muted">(all optional)</span>
        </summary>
        <div className="flex flex-col gap-5 pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="c-email" label="Email" error={errors.email}>
            <input
              id="c-email"
              name="email"
              type="email"
              inputMode="email"
              defaultValue={v.email}
              autoComplete="off"
              className="field"
              {...invalid("c-email", errors.email)}
            />
          </Field>
          <Field id="c-phone" label="Phone">
            <input id="c-phone" name="phone" type="tel" defaultValue={v.phone} autoComplete="off" className="field" />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Links</legend>
          {links.map((link, i) => {
            const err = errors.linkUrls?.[i];
            return (
              <div key={link.key} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <Field id={`c-link_label_${link.key}`} label={`Link ${i + 1} label`}>
                  <input
                    id={`c-link_label_${link.key}`}
                    name="link_label"
                    defaultValue={link.label}
                    placeholder="Bandcamp"
                    className="field"
                  />
                </Field>
                <Field id={`c-link_url_${link.key}`} label={`Link ${i + 1} URL`} error={err}>
                  <input
                    id={`c-link_url_${link.key}`}
                    name="link_url"
                    type="url"
                    inputMode="url"
                    defaultValue={link.url}
                    placeholder="yourband.bandcamp.com"
                    className="field"
                    {...invalid(`c-link_url_${link.key}`, err)}
                  />
                </Field>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setLinks((ls) => ls.filter((l) => l.key !== link.key))}
                  aria-label={`Remove link ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="button-secondary self-start"
            onClick={() => {
              setLinks((ls) => [...ls, { label: "", url: "", key: nextKey }]);
              setNextKey((k) => k + 1);
            }}
          >
            Add a link
          </button>
        </fieldset>

        <Field id="c-can_help_with" label="Can help with" hint="Separate with commas, like: music videos, DJ sets, gear.">
          <input
            id="c-can_help_with"
            name="can_help_with"
            defaultValue={v.canHelpWith}
            className="field"
            aria-describedby="c-can_help_with-hint"
          />
        </Field>

        <Field id="c-notes" label="Notes">
          <textarea id="c-notes" name="notes" rows={5} defaultValue={v.notes} className="field" />
        </Field>
        </div>
      </details>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="button-primary">
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className="button-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

// Bigger scenes first, each followed by the scenes inside it.
function orderScenes(scenes: SceneOption[]) {
  const top = scenes.filter((s) => !s.parent_id || !scenes.some((p) => p.id === s.parent_id));
  return top.flatMap((t) => [t, ...scenes.filter((c) => c.parent_id === t.id)]);
}

function invalid(id: string, error?: string, extraDescribedBy?: string) {
  const describedBy = [error ? `${id}-error` : null, extraDescribedBy].filter(Boolean).join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-error">
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceGroup({
  legend,
  hint,
  error,
  errorId,
  children,
}: {
  legend: string;
  hint?: string;
  error?: string;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset aria-describedby={error && errorId ? errorId : undefined} className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint ? <p className="-mt-1 text-sm text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">{children}</div>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-error">
          Error: {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Choice({
  type,
  name,
  value,
  label,
  defaultChecked,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="choice">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}
