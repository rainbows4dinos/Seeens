"use client";

import { useState, useTransition } from "react";
import { Combobox, type ComboOption } from "@/components/combobox";
import { offline } from "@/lib/offline";
import { linkMe, makeMyPage, unlinkMe, type LinkState } from "@/lib/auth/person-actions";

// Account Settings > You (#44): which person in the directory is you.
export function YourPage({
  linked,
  people,
  band,
  hasBandPage,
}: {
  linked: { id: string; name: string } | null;
  people: ComboOption[];
  band: string;
  /** Whether there's a page marked "us" to add you to. */
  hasBandPage: boolean;
}) {
  const [pick, setPick] = useState<string>();
  const [state, setState] = useState<LinkState>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<LinkState>) =>
    start(async () => setState(await fn().catch(offline<LinkState>({ error: "Couldn't reach Seeens. Try again." }))));

  return (
    <div className="rule-top relative mt-2 flex flex-col gap-3 pt-5">
      <p className="label">Your Page</p>
      {linked ? (
        <>
          <p className="-mt-1 text-sm text-muted">
            You in {band}&rsquo;s directory. Bandmates see you use Seeens there.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {/* A full page load, not the directory's quick view. */}
            <a href={`/connections/${linked.id}`} className="button-secondary">
              {linked.name}
            </a>
            <button type="button" className="action-link text-sm" disabled={pending} onClick={() => run(unlinkMe)}>
              Not you? Unlink
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="-mt-1 text-sm text-muted">
            Link yourself to your person in the directory, so bandmates know it&rsquo;s you and you can find your page
            from the menu. If another band already added you, pick that one: you&rsquo;re one person everywhere.
          </p>
          {people.length ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-64 sm:max-w-sm">
                <Combobox
                  label="I'm Already in the Directory"
                  labelClassName="text-sm"
                  options={people}
                  multiple={false}
                  placeholder="Find yourself"
                  onChange={(values) => setPick(values[0])}
                />
              </div>
              <button
                type="button"
                className="button-secondary"
                disabled={pending || !pick}
                onClick={() => pick && run(() => linkMe(pick))}
              >
                This Is Me
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="button-secondary" disabled={pending} onClick={() => run(makeMyPage)}>
              {pending ? "Working…" : "Make My Page"}
            </button>
            <p className="text-sm text-muted">
              A new person, named as you are here{hasBandPage ? `, added as a member of ${band}` : ""}.
            </p>
          </div>
        </>
      )}
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-error">
          Error: {state.error}
        </p>
      ) : null}
    </div>
  );
}
