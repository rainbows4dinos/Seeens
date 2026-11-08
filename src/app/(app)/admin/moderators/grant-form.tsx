"use client";

import { useActionState, useState } from "react";
import { Combobox } from "@/components/combobox";
import { grantModerator, type ModeratorFormState } from "@/lib/auth/moderator-actions";

export type Account = { value: string; label: string };

// Make a moderator by picking them (#195): everyone on Seeens who isn't one
// yet, by name and band.
export function GrantForm({ accounts }: { accounts: Account[] }) {
  const [state, action, pending] = useActionState<ModeratorFormState, FormData>(grantModerator, {});
  const [pick, setPick] = useState<string | undefined>();
  // A new combobox after each save, so the last pick doesn't linger.
  const [round, setRound] = useState(0);
  const [prevDone, setPrevDone] = useState(state.done);
  if (state.done !== prevDone) {
    setPrevDone(state.done);
    setPick(undefined);
    setRound((r) => r + 1);
  }
  const picked = accounts.find((a) => a.value === pick);

  if (!accounts.length) return <p className="text-sm text-muted">Everyone on Seeens is already a moderator.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64 sm:max-w-sm">
          <Combobox
            key={round}
            label="Person"
            hint="Everyone on Seeens, with their bands."
            name="user_id"
            options={accounts}
            multiple={false}
            placeholder="Find someone"
            onChange={(values) => setPick(values[0])}
          />
        </div>
        <input type="hidden" name="user_name" value={picked?.label.split(" (")[0] ?? ""} />
        <button type="submit" className="button-primary" disabled={pending || !pick}>
          {pending ? "Saving…" : "Make Moderator"}
        </button>
      </div>
      <p role="alert" className="text-sm font-medium text-error empty:hidden">
        {state.error ? `Error: ${state.error}` : ""}
      </p>
      <p aria-live="polite" className="text-sm text-muted empty:hidden">
        {state.done ?? ""}
      </p>
    </form>
  );
}
