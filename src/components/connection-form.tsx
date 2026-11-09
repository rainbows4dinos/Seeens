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
import { LinksEditor } from "@/components/links-editor";
import { ProfilePanel } from "@/components/profile/panel";
import { BasicInfoFields } from "@/components/profile/basic-info";
import { Field, invalid } from "@/components/form-field";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { readForm, type ConnectionFormState, type ConnectionFormValues } from "@/lib/connections/form";
import { GROUP_TYPES, type GroupType } from "@/lib/connections/labels";

type SceneOption = { id: string; name: string; parent_id: string | null };
type Action = (prev: ConnectionFormState, formData: FormData) => Promise<ConnectionFormState>;

// Next keeps a page you've left alive and reruns its effects when you come
// back. The Add form starts fresh after each save, so going back to it
// can't replay the last one's links or reopen it.
export function ConnectionForm(props: Omit<ComponentProps<typeof FormState>, "onFinished">) {
  const [round, setRound] = useState(0);
  return <FormState key={round} {...props} onFinished={() => setRound((r) => r + 1)} />;
}

function FormState({
  action,
  initial,
  scenes,
  submitLabel,
  cancelHref,
  photoSlot,
  create,
  onFinished,
}: {
  action: Action;
  initial: ConnectionFormValues;
  scenes: SceneOption[];
  submitLabel: string;
  cancelHref: string;
  // The edit page's photo, at the top of Who they are. It saves on its own.
  photoSlot?: ReactNode;
  // The Add page: a photo and links can be picked before the connection
  // exists. They wait here and are added right after it's saved.
  create?: { workspaceId: string; candidates: Candidate[]; photoDefaults: CopierSettings };
  onFinished: () => void;
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
  const replayed = useRef<string | null>(null);
  useEffect(() => {
    if (!created || !create || replayed.current === created) return;
    replayed.current = created;
    let missedPhoto = false;
    let missedLinks = 0;
    (async () => {
      const name = state.values.name;
      if (photo)
        missedPhoto = Boolean(await uploadCaptured(create.workspaceId, created, photo, name).catch(() => "failed"));
      for (const l of links) {
        const fd = new FormData();
        for (const [k, v] of l.entries) fd.append(k, v);
        const res = await addLink(created, l.optionId, {}, fd).catch(() => ({ ok: false }));
        if (!res.ok) missedLinks++;
      }
      const q = new URLSearchParams({ saved: "1" });
      if (missedPhoto) q.set("missed_photo", "1");
      if (missedLinks) q.set("missed_links", String(missedLinks));
      // Open the new page and clear this form together.
      startTransition(() => {
        router.push(`/connections/${created}?${q}`);
        onFinished();
      });
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
        create ? <NewPhotoPanel photo={photo} defaults={create.photoDefaults} onChange={setPhoto} /> : photoSlot
      }
      newLinks={create ? { candidates: create.candidates, pending: pendingLinks } : undefined}
      returnId={Boolean(create && (photo || links.length))}
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
  photoSlot?: ReactNode;
  newLinks?: { candidates: Candidate[]; pending: PendingLinks };
  returnId?: boolean;
}) {
  const { values: v, errors } = state;
  // The type decides which panels show (Venue Details) and what can be
  // linked, so it lives here and Basic Info reports changes.
  const [type, setType] = useState(v.kind === "person" ? "person" : v.groupType);
  const person = type === "person";
  const groupType = person ? "" : type;
  const errorCount =
    Object.keys(errors).filter((k) => k !== "form" && k !== "linkUrls").length +
    Object.keys(errors.linkUrls ?? {}).length;

  // The same panels as a connection's profile (#126), in the same order.
  // Nothing exists yet, so it all saves together with the button below.
  return (
    <form action={formAction} noValidate className="flex flex-col gap-8">
      {errors.form || errorCount > 0 ? (
        <div role="alert" className="border-2 border-error bg-surface p-3 text-sm">
          <p className="font-semibold text-error">
            {errors.form ??
              `Couldn't save yet. Fix ${errorCount === 1 ? "the field" : `${errorCount} fields`} marked below.`}
          </p>
        </div>
      ) : null}

      {photoSlot}

      <ProfilePanel id="add-basic" title="Basic Info">
        <BasicInfoFields values={v} scenes={scenes} errors={errors} type={type} onTypeChange={setType} withStatus />
      </ProfilePanel>

      {/* Venue details (#48), while the type is Venue. */}
      {groupType === "venue" ? (
        <ProfilePanel id="add-venue" title="Venue Details">
          <VenueFields values={v.venue} errors={errors.venue} legend={false} />
        </ProfilePanel>
      ) : null}

      {/* Links wait until the connection is saved. Their choices follow the type. */}
      {newLinks && (person || GROUP_TYPES.includes(groupType as GroupType)) ? (
        <ProfilePanel id="add-connections" title={groupType === "band" ? "Members & Connections" : "Connections"}>
          <LinksPanel
            subjectId=""
            rows={[]}
            options={addOptionsFor({
              kind: person ? "person" : "group",
              group_type: person ? null : (groupType as GroupType),
            })}
            candidates={newLinks.candidates}
            pending={newLinks.pending}
            heading={false}
          />
        </ProfilePanel>
      ) : null}

      <ProfilePanel id="add-contact" title="Contact & Links">
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="c-email" label="Email" error={errors.email}>
              <input
                {...noAutofill}
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
        </div>
      </ProfilePanel>

      <ProfilePanel id="add-notes" title="Notes">
        <div className="flex flex-col gap-5">
          <Field
            id="c-can_help_with"
            label="Can Help With"
            hint="Separate with commas, like: music videos, DJ sets, gear."
          >
            <input
              {...noAutofill}
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
        </div>
      </ProfilePanel>

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
