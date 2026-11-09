"use client";

import { noAutofill } from "@/lib/no-autofill";
import { useState } from "react";
import { Combobox } from "@/components/combobox";
import { Field, invalid } from "@/components/form-field";
import { PlaceField } from "@/components/place-field";
import { splitList, type ConnectionFormErrors, type ConnectionFormValues } from "@/lib/connections/form";
import { useFieldErrors } from "@/components/profile/autosave";
import {
  GROUP_TYPES,
  GROUP_TYPE_LABELS,
  PERSON_ROLES,
  PERSON_ROLE_LABELS,
  STATUSES,
  playedWords,
  statusLabel,
  type GroupType,
  type PersonRole,
} from "@/lib/connections/labels";

type SceneOption = { id: string; name: string; parent_id: string | null };

// Basic Info on the profile page (#126) and the Add form: name and type on
// one row, then what a person does, "This is our band", the town, and
// scenes. One Type select stands in for "Person or group?" and "What is
// it?"; it posts the kind and group type the save expects.
//
// On the profile, errors come from its AutosaveForm and status saves on its
// own (QuickStatus). The Add form passes its errors, keeps the type (other
// panels follow it), and asks for the status fields here.
export function BasicInfoFields({
  values: v,
  scenes,
  errors: passed,
  type: typeProp,
  onTypeChange,
  withStatus = false,
  sharedOnly = false,
}: {
  values: ConnectionFormValues;
  scenes: SceneOption[];
  errors?: ConnectionFormErrors;
  /** "person", a group type, or "" before one is picked. */
  type?: string;
  onTypeChange?: (type: string) => void;
  withStatus?: boolean;
  /** A moderator on another band's record (#195): no scenes or Our band, which stay each band's. */
  sharedOnly?: boolean;
}) {
  const fromAutosave = useFieldErrors();
  const errors = passed ?? fromAutosave;
  const [ownType, setOwnType] = useState(v.kind === "person" ? "person" : v.groupType);
  const type = typeProp ?? ownType;
  const setType = (t: string) => {
    setOwnType(t);
    onTypeChange?.(t);
  };
  const [isUs, setIsUs] = useState(v.isUs);
  const person = type === "person";
  const typeError = errors.kind ?? errors.groupType;
  const us = type === "band" && isUs;
  // Status words follow the type as it's picked (#139).
  const typed = {
    kind: (person ? "person" : "group") as "person" | "group",
    group_type: (GROUP_TYPES as string[]).includes(type) ? (type as GroupType) : null,
    person_roles: v.personRoles.filter((r): r is PersonRole => (PERSON_ROLES as string[]).includes(r)),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field id="p-name" label="Name" error={errors.name}>
          <input
            {...noAutofill}
            id="p-name"
            name="name"
            required
            defaultValue={v.name}
            className="field"
            {...invalid("p-name", errors.name)}
          />
        </Field>
        <Field id="p-type" label="Type" error={typeError}>
          <select
            id="p-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field"
            {...invalid("p-type", typeError)}
          >
            {type === "" ? (
              <option value="" disabled>
                Choose one
              </option>
            ) : null}
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
      {sharedOnly ? null : type === "band" || (v.isUs && !person) ? (
        <div className="flex flex-col gap-1">
          <label className="choice self-start">
            <input type="checkbox" name="is_us" value="on" checked={isUs} onChange={(e) => setIsUs(e.target.checked)} />
            <span>This is our band</span>
          </label>
          <p className="text-sm text-muted">Lets Seeens spot label mates and shared members.</p>
          {errors.isUs ? <p className="text-sm font-medium text-error">Error: {errors.isUs}</p> : null}
        </div>
      ) : null}

      <PlaceAndScenes values={v} scenes={scenes} errors={errors} sharedOnly={sharedOnly} />

      {/* Add only. Status is how we relate to others; it doesn't apply to
          us. Hidden, not removed, so the default still submits. */}
      {withStatus ? (
        <div className="flex flex-col gap-2" hidden={us}>
          <label htmlFor="p-status" className="label">
            Status
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="p-status"
              name="status"
              defaultValue={v.status}
              className="field min-w-28 flex-1 basis-28 sm:max-w-80"
              {...invalid("p-status", errors.status)}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {statusLabel(st, typed)}
                </option>
              ))}
            </select>
            <label className="choice shrink-0">
              <input type="checkbox" name="played_together" value="on" defaultChecked={v.playedTogether} />
              <span>{playedWords(typed).label}</span>
            </label>
          </div>
          {errors.status ? (
            <p id="p-status-error" className="text-sm font-medium text-error">
              Error: {errors.status}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Town and scenes, lined up (.field-pair). Also in the quick view (#253). */
export function PlaceAndScenes({
  values: v,
  scenes,
  errors,
  sharedOnly = false,
}: {
  values: ConnectionFormValues;
  scenes: SceneOption[];
  errors: ConnectionFormErrors;
  sharedOnly?: boolean;
}) {
  return (
    <div className="field-pair grid gap-5">
      <PlaceField
        initialId={v.placeId ? Number(v.placeId) : null}
        initialLabel={v.placeText}
        keepLocalityId={v.keepLocalityId || null}
        error={errors.placeText}
      />
      {sharedOnly ? null : (
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
          create={{ name: "new_scenes", defaultValue: splitList(v.newScenes), verb: "New Scene" }}
          error={errors.newScenes}
        />
      )}
    </div>
  );
}

// Bigger scenes first, each followed by the scenes inside it.
function orderScenes(scenes: SceneOption[]) {
  const top = scenes.filter((s) => !s.parent_id || !scenes.some((p) => p.id === s.parent_id));
  return top.flatMap((t) => [t, ...scenes.filter((c) => c.parent_id === t.id)]);
}
