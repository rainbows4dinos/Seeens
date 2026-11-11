"use client";

import { useState } from "react";
import { Combobox } from "@/components/combobox";
import { SPACE, VENUE_TYPES, needsDiyToggle, readVenueTypes, type VenueType } from "@/lib/connections/venue-details";

const OPTIONS = (Object.keys(VENUE_TYPES) as VenueType[]).map((t) => ({
  value: t,
  label: VENUE_TYPES[t].label,
  hint: VENUE_TYPES[t].space === "either" ? undefined : SPACE[VENUE_TYPES[t].space],
}));

// What kind of room (#262): pick any that apply. DIY or licensed follows
// from the types; a DIY checkbox shows only when every pick could go either
// way (an art space, a park). Submits as venue_types ("a,b"), venue_diy, and
// the old venue_space, kept until a type is picked.
export function VenueTypeField({
  types: initial,
  diy: initialDiy,
  space,
}: {
  types: string;
  diy: string;
  space: string;
}) {
  const [types, setTypes] = useState<VenueType[]>(readVenueTypes(initial));
  const [diy, setDiy] = useState(initialDiy === "yes");
  // An old DIY/Licensed with no type yet carries over; once types are picked, they decide.
  const [legacy] = useState(readVenueTypes(initial).length ? "" : space);
  const either = needsDiyToggle(types);
  return (
    <div className="flex flex-col gap-2">
      <Combobox
        label="Type of Space"
        options={OPTIONS}
        defaultValue={types}
        placeholder="Dive bar, house shows, record store…"
        onChange={(values) => setTypes(readVenueTypes(values))}
      />
      <input type="hidden" name="venue_venue_types" value={types.join(",")} />
      <input type="hidden" name="venue_space" value={types.length ? "" : legacy} />
      {either ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="venue_diy"
            value="yes"
            checked={diy}
            onChange={(e) => setDiy(e.target.checked)}
          />
          DIY (not a licensed venue)
        </label>
      ) : null}
      <p className="text-sm text-muted">
        Pick any that apply. DIY or licensed comes from the type
        {legacy && !types.length ? `; for now it says ${legacy === "diy" ? "DIY" : "Licensed"}` : ""}.
      </p>
    </div>
  );
}
