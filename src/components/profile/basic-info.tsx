"use client";

import { noAutofill } from "@/lib/no-autofill";
import { useState } from "react";
import { Combobox } from "@/components/combobox";
import { Field, invalid } from "@/components/form-field";
import { PlaceField } from "@/components/place-field";
import type { ConnectionFormValues } from "@/lib/connections/form";
import { useFieldErrors } from "@/components/profile/autosave";
import {
  GROUP_TYPES,
  GROUP_TYPE_LABELS,
  PERSON_ROLES,
  PERSON_ROLE_LABELS,
} from "@/lib/connections/labels";

type SceneOption = { id: string; name: string; parent_id: string | null };

// Basic Info on the profile page (#126): name and type on one row, then
// what a person does, "This is our band", the town, and scenes. One Type
// select stands in for "Person or group?" and "What is it?"; it posts the
// kind and group type the save expects.
export function BasicInfoFields({ values: v, scenes }: { values: ConnectionFormValues; scenes: SceneOption[] }) {
  const errors = useFieldErrors();
  const [type, setType] = useState(v.kind === "person" ? "person" : v.groupType);
  const [isUs, setIsUs] = useState(v.isUs);
  const person = type === "person";
  const typeError = errors.kind ?? errors.groupType;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field id="p-name" label="Name" error={errors.name}>
          <input {...noAutofill} id="p-name" name="name" required defaultValue={v.name} className="field" {...invalid("p-name", errors.name)} />
        </Field>
        <Field id="p-type" label="Type" error={typeError}>
          <select
            id="p-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field"
            {...invalid("p-type", typeError)}
          >
            {GROUP_TYPES.map((g) => (
              <option key={g} value={g}>
                {GROUP_TYPE_LABELS[g]}
              </option>
            ))}
            <option value="person">Person</option>
          </select>
        </Field>
        <input type="hidden" name="kind" value={person ? "person" : "group"} />
        <input type="hidden" name="group_type" value={person ? "" : type} />
      </div>

      {person ? (
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
      {type === "band" || (v.isUs && !person) ? (
        <div className="flex flex-col gap-1">
          <label className="choice self-start">
            <input type="checkbox" name="is_us" value="on" checked={isUs} onChange={(e) => setIsUs(e.target.checked)} />
            <span>This is our band</span>
          </label>
          <p className="text-sm text-muted">Lets Seeens spot label mates and shared members.</p>
          {errors.isUs ? <p className="text-sm font-medium text-error">Error: {errors.isUs}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <PlaceField
          initialId={v.placeId ? Number(v.placeId) : null}
          initialLabel={v.placeText}
          keepLocalityId={v.keepLocalityId || null}
          error={errors.placeText}
        />
        <Combobox
          label="Scenes (Optional)"
          hint="Pick any, or type a new one."
          name="scene_ids"
          options={orderScenes(scenes).map((s) => ({
            value: s.id,
            label: s.name,
            depth: s.parent_id && scenes.some((p) => p.id === s.parent_id) ? 1 : 0,
          }))}
          defaultValue={v.sceneIds}
          create={{ name: "new_scenes", defaultValue: [], verb: "New Scene" }}
          error={errors.newScenes}
        />
      </div>
    </div>
  );
}

// Bigger scenes first, each followed by the scenes inside it.
function orderScenes(scenes: SceneOption[]) {
  const top = scenes.filter((s) => !s.parent_id || !scenes.some((p) => p.id === s.parent_id));
  return top.flatMap((t) => [t, ...scenes.filter((c) => c.parent_id === t.id)]);
}

