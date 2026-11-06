"use client";

import { noAutofill } from "@/lib/no-autofill";
import { Field, invalid } from "@/components/form-field";
import { LinksEditor } from "@/components/links-editor";
import { VenueFields } from "@/components/venue-fields";
import { useFieldErrors } from "@/components/profile/autosave";
import type { ConnectionFormValues } from "@/lib/connections/form";

// The profile page's panel fields (#126) that show save errors. They sit in
// an AutosaveForm and read its latest errors.

export function ContactFields({ values: v }: { values: ConnectionFormValues }) {
  const errors = useFieldErrors();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="p-email" label="Email" error={errors.email}>
          <input {...noAutofill} id="p-email" name="email" type="email" inputMode="email" defaultValue={v.email} className="field" {...invalid("p-email", errors.email)} />
        </Field>
        <Field id="p-phone" label="Phone">
          <input {...noAutofill} id="p-phone" name="phone" type="tel" defaultValue={v.phone} className="field" />
        </Field>
      </div>
      <LinksEditor initial={v.links} errors={errors.linkUrls} />
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
