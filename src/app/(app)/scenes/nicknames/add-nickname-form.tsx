"use client";

import { useActionState } from "react";
import { noAutofill } from "@/lib/no-autofill";
import { PlaceField } from "@/components/place-field";
import { addNickname } from "@/lib/scenes/nickname-actions";

export function AddNicknameForm() {
  const [state, action, pending] = useActionState(addNickname, {});
  return (
    // A fresh form after each one added.
    <form action={action} className="flex flex-col gap-4" key={state.done ?? "form"}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="nickname" className="label">
            Nickname
          </label>
          <p id="nickname-hint" className="-mt-1 text-sm text-muted">
            Like PDX or Sactown.
          </p>
          <input
            {...noAutofill}
            id="nickname"
            name="alias"
            className="field"
            placeholder="PDX"
            maxLength={40}
            aria-describedby="nickname-hint"
          />
        </div>
        <PlaceField
          initialId={null}
          initialLabel=""
          keepLocalityId={null}
          label="Town"
          hint="The town it means."
          placeholder={"Try \u201cPortland, OR\u201d"}
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      ) : null}
      {state.done ? (
        <p role="status" className="text-sm font-medium">
          {state.done}
        </p>
      ) : null}
      <div>
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "Adding…" : "Add Nickname"}
        </button>
      </div>
    </form>
  );
}
