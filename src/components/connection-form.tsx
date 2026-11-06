"use client";

import { noAutofill } from "@/lib/no-autofill";
import { VenueFields } from "@/components/venue-fields";
import { unstable_rethrow, useRouter } from "next/navigation";
import { LinksPanel, type Candidate, type PendingLink, type PendingLinks } from "@/components/links-panel";
import { NewPhotoPanel } from "@/components/photo-panel";
import { uploadCaptured, type CapturedPhoto } from "@/components/photo-copier";
import { addLink } from "@/lib/affiliations/actions";
import { addOptionsFor } from "@/lib/affiliations/options";
import type { CopierSettings } from "@/lib/photos/settings";
import Link from "next/link";
import { PlaceField } from "@/components/place-field";
import { Combobox } from "@/components/combobox";
import { LinksEditor } from "@/components/links-editor";
import { Field, invalid } from "@/components/form-field";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { readForm, type ConnectionFormState, type ConnectionFormValues } from "@/lib/connections/form";
import {
  GROUP_TYPES,
  GROUP_TYPE_LABELS,
  KINDS,
  KIND_LABELS,
  PERSON_ROLES,
  PERSON_ROLE_LABELS,
  STATUSES,
  playedWords,
  statusLabel,
  type GroupType,
  type PersonRole,
} from "@/lib/connections/labels";

type SceneOption = { id: string; name: string; parent_id: string | null };
type Action = (prev: ConnectionFormState, formData: FormData) => Promise<ConnectionFormState>;

export function ConnectionForm({
  action,
  initial,
  scenes,
  submitLabel,
  cancelHref,
  linksSlot,
  photoSlot,
  create,
}: {
  action: Action;
  initial: ConnectionFormValues;
  scenes: SceneOption[];
  submitLabel: string;
  cancelHref: string;
  // Shown in More details, above Can Help With (the edit page's Connections
  // block). It must not contain form fields of its own that belong to this
  // form; see DetachedForm in links-panel.tsx.
  linksSlot?: ReactNode;
  // The edit page's photo, at the top of Who they are. It saves on its own.
  photoSlot?: ReactNode;
  // The Add page: a photo and links can be picked before the connection
  // exists. They wait here and are added right after it's saved.
  create?: { workspaceId: string; candidates: Candidate[]; photoDefaults: CopierSettings };
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [links, setLinks] = useState<PendingLink[]>([]);
  const nextKey = useRef(0);
  const pendingLinks: PendingLinks = {
    items: links,
    add: (l) => setLinks((ls) => [...ls, { ...l, key: nextKey.current++ }]),
    remove: (key) => setLinks((ls) => ls.filter((l) => l.key !== key)),
  };
  const [state, formAction, pending] = useActionState<ConnectionFormState, FormData>(
    async (prev, fd) => {
      try {
        return await action(prev, fd);
      } catch (e) {
        unstable_rethrow(e);
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

  // Saved with a photo or links waiting: add them, then open the new page.
  // Anything that doesn't go through is named there, so it can be added again.
  const created = state.createdId;
  // Saved, and adding the photo and links: keep Save disabled until the page opens.
  const finishing = Boolean(created);
  useEffect(() => {
    if (!created || !create) return;
    let missedPhoto = false;
    let missedLinks = 0;
    (async () => {
      const name = state.values.name;
      if (photo) missedPhoto = Boolean(await uploadCaptured(create.workspaceId, created, photo, name).catch(() => "failed"));
      for (const l of links) {
        const fd = new FormData();
        for (const [k, v] of l.entries) fd.append(k, v);
        const res = await addLink(created, l.optionId, {}, fd).catch(() => ({ ok: false }));
        if (!res.ok) missedLinks++;
      }
      const q = new URLSearchParams({ saved: "1" });
      if (missedPhoto) q.set("missed_photo", "1");
      if (missedLinks) q.set("missed_links", String(missedLinks));
      router.push(`/connections/${created}?${q}`);
    })();
    // Runs once per new connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);

  // Remount after each failed save so fields show what was submitted.
  return (
    <FormBody
      key={state.attempt ?? 0}
      state={state}
      formAction={formAction}
      pending={pending || finishing}
      photoSlot={
        create ? (
          <NewPhotoPanel photo={photo} defaults={create.photoDefaults} onChange={setPhoto} />
        ) : (
          photoSlot
        )
      }
      newLinks={create ? { candidates: create.candidates, pending: pendingLinks } : undefined}
      returnId={Boolean(create && (photo || links.length))}
      scenes={scenes}
      submitLabel={submitLabel}
      cancelHref={cancelHref}
      linksSlot={linksSlot}
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
  linksSlot,
  photoSlot,
  newLinks,
  returnId,
}: {
  state: ConnectionFormState;
  formAction: (fd: FormData) => void;
  pending: boolean;
  scenes: SceneOption[];
  submitLabel: string;
  cancelHref: string;
  linksSlot?: ReactNode;
  photoSlot?: ReactNode;
  newLinks?: { candidates: Candidate[]; pending: PendingLinks };
  returnId?: boolean;
}) {
  const { values: v, errors } = state;
  const [kind, setKind] = useState(v.kind === "person" ? "person" : "group");
  const [isUs, setIsUs] = useState(v.isUs);
  // Status words follow the type as it's picked (#139). Roles only change
  // the played label, so the saved roles are enough for that.
  const [groupType, setGroupType] = useState(v.groupType);
  const typed = {
    kind: kind as "person" | "group",
    group_type: (GROUP_TYPES.includes(groupType as GroupType) ? groupType : null) as GroupType | null,
    person_roles: v.personRoles.filter((r): r is PersonRole => PERSON_ROLES.includes(r as PersonRole)),
  };
  const us = kind === "group" && groupType === "band" && isUs;
  const errorCount =
    Object.keys(errors).filter((k) => k !== "form" && k !== "linkUrls").length +
    Object.keys(errors.linkUrls ?? {}).length;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="updated_at" value={v.updatedAt} />
      {state.conflict ? (
        <div role="alert" className="flex flex-col gap-2 border-2 border-error bg-surface p-3 text-sm">
          <p className="font-semibold text-error">A bandmate saved changes here while you were editing.</p>
          <p>
            Nothing was saved, and your edits are still below. Compare them with their version, then save again to
            replace theirs with yours.
          </p>
          <p>
            <a href={cancelHref} target="_blank" rel="noopener" className="link">
              Open Their Version
            </a>{" "}
            <span className="text-muted">(opens in a new tab)</span>
          </p>
        </div>
      ) : null}
      {errors.form || errorCount > 0 ? (
        <div role="alert" className="border-2 border-error bg-surface p-3 text-sm">
          <p className="font-semibold text-error">
            {errors.form ?? `Couldn't save yet. Fix ${errorCount === 1 ? "the field" : `${errorCount} fields`} marked below.`}
          </p>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg leading-6 font-semibold">Who they are</legend>

        {photoSlot}

        <Field id="c-name" label="Name" error={errors.name}>
          <input {...noAutofill}
            id="c-name"
            name="name"
            required
            defaultValue={v.name}
            className="field"
            {...invalid("c-name", errors.name)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="c-kind" label="Person or group?" error={errors.kind}>
            <select
              id="c-kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value === "person" ? "person" : "group")}
              className="field"
              {...invalid("c-kind", errors.kind)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>

          {kind === "group" ? (
            <Field id="c-group_type" label="What is it?" error={errors.groupType}>
              <select
                id="c-group_type"
                name="group_type"
                defaultValue={v.groupType}
                onChange={(e) => setGroupType(e.target.value)}
                className="field"
                {...invalid("c-group_type", errors.groupType)}
              >
                <option value="" disabled>
                  Choose one
                </option>
                {GROUP_TYPES.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_TYPE_LABELS[g]}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        {kind === "person" ? (
          <Combobox
            label="What do they do?"
            hint="Any that apply."
            name="person_roles"
            options={PERSON_ROLES.map((r) => ({ value: r, label: PERSON_ROLE_LABELS[r] }))}
            defaultValue={v.personRoles}
            error={errors.personRoles}
          />
        ) : null}

        {/* Only a band can be us. Our own band keeps the box even if its type
            changes, so the save can say why instead of quietly dropping it. */}
        {kind === "group" && (groupType === "band" || v.isUs) ? (
          <div className="flex flex-col gap-1">
            <label className="choice self-start">
              <input
                type="checkbox"
                name="is_us"
                value="on"
                checked={isUs}
                onChange={(e) => setIsUs(e.target.checked)}
              />
              <span>This is our band</span>
            </label>
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

        <Combobox
          label="Scenes (Optional)"
          hint="Pick any they're part of, or type a new one, like Portland DIY."
          name="scene_ids"
          options={orderScenes(scenes).map((s) => ({
            value: s.id,
            label: s.name,
            depth: s.parent_id && scenes.some((p) => p.id === s.parent_id) ? 1 : 0,
          }))}
          defaultValue={v.sceneIds}
          create={{ name: "new_scenes", defaultValue: splitNames(v.newScenes), verb: "New Scene" }}
          error={errors.newScenes}
        />
      </fieldset>

      {/* Status is how we relate to others; it doesn't apply to us. Hidden,
          not removed, so the saved value still submits. */}
      <fieldset className="flex flex-col gap-5" hidden={us}>
        <legend className="mb-3 text-lg leading-6 font-semibold">Where things stand</legend>

        <div className="flex flex-col gap-2">
          <label htmlFor="c-status" className="label">
            Status
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="c-status"
              name="status"
              defaultValue={v.status}
              className="field w-full sm:w-80"
              {...invalid("c-status", errors.status)}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {statusLabel(st, typed)}
                </option>
              ))}
            </select>
            <Choice
              type="checkbox"
              name="played_together"
              value="on"
              label={playedWords(typed).label}
              defaultChecked={v.playedTogether}
            />
          </div>
          {errors.status ? (
            <p id="c-status-error" className="text-sm font-medium text-error">
              Error: {errors.status}
            </p>
          ) : null}
        </div>
      </fieldset>

      {/* Venue details (#48), while the type is Venue. */}
      {kind === "group" && groupType === "venue" ? <VenueFields values={v.venue} errors={errors.venue} /> : null}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg leading-6 font-semibold">
          More details <span className="text-sm font-normal text-muted">(all optional)</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="c-email" label="Email" error={errors.email}>
            <input {...noAutofill}
              id="c-email"
              name="email"
              type="email"
              inputMode="email"
              defaultValue={v.email}
              className="field"
              {...invalid("c-email", errors.email)}
            />
          </Field>
          <Field id="c-phone" label="Phone">
            <input {...noAutofill} id="c-phone" name="phone" type="tel" defaultValue={v.phone} className="field" />
          </Field>
        </div>

        <LinksEditor initial={v.links} errors={errors.linkUrls} />

        {linksSlot}
        {/* Add: links wait until the connection is saved. Their choices follow the type. */}
        {newLinks && !us && (kind === "person" || GROUP_TYPES.includes(groupType as GroupType)) ? (
          <LinksPanel
            subjectId=""
            rows={[]}
            options={addOptionsFor({ kind: kind as "person" | "group", group_type: kind === "group" ? (groupType as GroupType) : null })}
            candidates={newLinks.candidates}
            pending={newLinks.pending}
            note="Added when you save."
          />
        ) : null}

        <Field id="c-can_help_with" label="Can Help With" hint="Separate with commas, like: music videos, DJ sets, gear.">
          <input {...noAutofill}
            id="c-can_help_with"
            name="can_help_with"
            defaultValue={v.canHelpWith}
            className="field"
            aria-describedby="c-can_help_with-hint"
          />
        </Field>

        <Field id="c-notes" label="Notes">
          <textarea {...noAutofill} id="c-notes" name="notes" rows={5} defaultValue={v.notes} className="field" />
        </Field>
      </fieldset>

      {returnId ? <input type="hidden" name="return_id" value="1" /> : null}
      <div className="save-bar flex flex-wrap gap-3">
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

function splitNames(list: string) {
  return list
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
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
