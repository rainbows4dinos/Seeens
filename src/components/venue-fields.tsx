import { noAutofill } from "@/lib/no-autofill";
import type { VenueKey } from "@/lib/connections/form";
import { AGES, BOOK_VIA, CAPACITY, GEAR, SPACE, TEXT_LIMITS } from "@/lib/connections/venue-details";

// Venue details on the connection form (#48). Every field can stay blank
// ("Not sure"); only what's picked shows on the venue.
export function VenueFields({
  values,
  errors = {},
  legend = true,
}: {
  values: Record<VenueKey, string>;
  errors?: Partial<Record<VenueKey, string>>;
  /** Off in the profile's Venue Details panel, which has its own title. */
  legend?: boolean;
}) {
  const choice = (key: VenueKey, label: string, options: Record<string, string>) => (
    <Select key={key} name={key} label={label} value={values[key]} options={options} />
  );
  const text = (key: keyof typeof TEXT_LIMITS, label: string, placeholder: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={`c-venue_${key}`} className="label">
        {label}
      </label>
      <input
        {...noAutofill}
        id={`c-venue_${key}`}
        name={`venue_${key}`}
        defaultValue={values[key]}
        maxLength={TEXT_LIMITS[key] + 50}
        placeholder={placeholder}
        className="field"
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `c-venue_${key}-error` : undefined}
      />
      {errors[key] ? (
        <p id={`c-venue_${key}-error`} className="text-sm font-medium text-error">
          Error: {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <fieldset className="flex flex-col gap-5">
      {legend ? (
        <legend className="mb-3 text-lg leading-6 font-semibold">
          Venue details <span className="text-sm font-normal text-muted">(leave anything you&rsquo;re not sure of)</span>
        </legend>
      ) : (
        <legend className="sr-only">Venue details</legend>
      )}
      {text("address", "Address", "123 Main St, or Ask a punk")}
      <div className="grid gap-4 sm:grid-cols-3">
        {choice("ages", "Ages", AGES)}
        {choice("capacity", "Capacity", CAPACITY)}
        {choice("space", "Space", SPACE)}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.keys(GEAR) as (keyof typeof GEAR)[]).map((k) => choice(k, GEAR[k], { yes: "Yes", no: "No" }))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-1">
          {choice("book_via", "How to book", BOOK_VIA)}
        </div>
        <p className="text-sm text-muted sm:col-span-2 sm:self-end sm:pb-2">
          Uses the email and links under {legend ? "More details" : "Contact & Links"}. Who books it goes under Connections.
        </p>
      </div>
      {text("accessibility", "Accessibility", "Step-free entry, all-gender restrooms")}
      {text("special_terms", "Special terms", "Pay to play, door split, bring your own sound")}
    </fieldset>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: VenueKey;
  label: string;
  value: string;
  options: Record<string, string>;
}) {
  const id = `c-venue_${name}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} name={`venue_${name}`} defaultValue={value} className="field">
        <option value="">Not sure</option>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
