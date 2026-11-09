"use client";

import { useState } from "react";
import { AutosaveForm, AutosaveProvider, SaveStatus, useFieldErrors } from "@/components/profile/autosave";
import { PlaceAndScenes } from "@/components/profile/basic-info";
import type { ConnectionFormValues } from "@/lib/connections/form";

type SceneOption = { id: string; name: string; parent_id: string | null };

// Town and scenes, edited in the quick view (#253). Closed, it's one link
// under the header; open, the profile's own fields, saving as you go.
export function QuickPlaceEdit({
  connectionId,
  values,
  scenes,
}: {
  connectionId: string;
  values: ConnectionFormValues;
  scenes: SceneOption[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="link self-start text-sm" onClick={() => setOpen(true)} aria-expanded="false">
        Edit Town &amp; Scenes
      </button>
    );
  }
  return (
    <AutosaveProvider>
      <AutosaveForm connectionId={connectionId} className="quick-edit flex flex-col gap-4">
        <Fields values={values} scenes={scenes} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SaveStatus />
          <button type="button" className="button-secondary" onClick={() => setOpen(false)} aria-expanded="true">
            Done
          </button>
        </div>
      </AutosaveForm>
    </AutosaveProvider>
  );
}

function Fields({ values, scenes }: { values: ConnectionFormValues; scenes: SceneOption[] }) {
  const errors = useFieldErrors();
  return <PlaceAndScenes values={values} scenes={scenes} errors={errors} />;
}
