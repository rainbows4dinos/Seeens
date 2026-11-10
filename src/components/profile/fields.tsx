"use client";

import { noAutofill } from "@/lib/no-autofill";
import { Field, invalid } from "@/components/form-field";
import { LinksEditor } from "@/components/links-editor";
import { VenueFields } from "@/components/venue-fields";
import { useFieldErrors } from "@/components/profile/autosave";
import type { ConnectionFormValues } from "@/lib/connections/form";
import { BasicInfoFields } from "@/components/profile/basic-info";

// The profile page's panel fields (#126) that show save errors. They sit in
// an AutosaveForm and read its latest errors.

export function ContactFields({ values: v }: { values: ConnectionFormValues }) {
  const errors = useFieldErrors();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="p-email" label="Email" error={errors.email}>
          <input
            {...noAutofill}
            id="p-email"
            name="email"
            type="email"
            inputMode="email"
            defaultValue={v.email}
            className="field"
            {...invalid("p-email", errors.email)}
          />
        </Field>
        <Field id="p-phone" label="Phone">
          <input
            {...noAutofill}
            id="p-phone"
            name="phone"
            type="tel"
            maxLength={100}
            defaultValue={v.phone}
            className="field"
          />
        </Field>
      </div>
      <LinksEditor initial={v.links} errors={errors.linkUrls} />
    </>
  );
}

/** This band's own contacts and notes on another band's record (#185). */
export function BandNoteFields({ values: v }: { values: ConnectionFormValues }) {
  const errors = useFieldErrors();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="p-email" label="Email" error={errors.email}>
          <input
            {...noAutofill}
            id="p-email"
            name="email"
            type="email"
            inputMode="email"
            defaultValue={v.email}
            className="field"
            {...invalid("p-email", errors.email)}
          />
        </Field>
        <Field id="p-phone" label="Phone">
          <input
            {...noAutofill}
            id="p-phone"
            name="phone"
            type="tel"
            maxLength={100}
            defaultValue={v.phone}
            className="field"
          />
        </Field>
      </div>
      <Field id="p-notes" label="Notes">
        <textarea
          {...noAutofill}
          id="p-notes"
          name="notes"
          rows={5}
          maxLength={10000}
          defaultValue={v.notes}
          className="field"
        />
      </Field>
    </>
  );
}

/** A moderator fixing another band's record (#195): its shared details only. */
export function ModeratorFields({ values: v, venue }: { values: ConnectionFormValues; venue: boolean }) {
  const errors = useFieldErrors();
  return (
    <>
      <BasicInfoFields values={v} scenes={[]} sharedOnly />
      <Field id="p-can_help_with" label="Can Help With" hint="Separate with commas, like: music videos, DJ sets, gear.">
        <input
          {...noAutofill}
          id="p-can_help_with"
          name="can_help_with"
          defaultValue={v.canHelpWith}
          className="field"
          aria-describedby="p-can_help_with-hint"
        />
      </Field>
      <LinksEditor initial={v.links} errors={errors.linkUrls} />
      {venue ? <VenueDetailFields values={v.venue} /> : null}
    </>
  );
}

export function VenueDetailFields({ values }: { values: ConnectionFormValues["venue"] }) {
  const errors = useFieldErrors();
  return <VenueFields values={values} errors={errors.venue} legend={false} />;
}

/** Errors that aren't about one field (couldn't save, someone else's band is ours). */
export function FormError() {
  const { form } = useFieldErrors();
  return form ? (
    <p role="alert" className="text-sm font-semibold text-error">
      {form}
    </p>
  ) : null;
}
