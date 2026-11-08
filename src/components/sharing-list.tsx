"use client";

import { useState, useTransition } from "react";
import { offline } from "@/lib/offline";
import { ProfilePanel } from "@/components/profile/panel";
import { setKeepPrivate, type SharingResult } from "@/lib/connections/sharing-actions";
import type { SharingSection } from "@/lib/connections/sharing";

// The review page (phase 2): every record the band added, by section, each
// with Keep Private. Changes save as you go.
export function SharingList({ sections, band }: { sections: SharingSection[]; band: string }) {
  const [kept, setKept] = useState(
    () => new Map(sections.flatMap((s) => s.rows.map((r) => [r.id, r.keepPrivate] as const))),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (ids: string[], keepPrivate: boolean, done: string) => {
    if (!ids.length) return;
    const before = new Map(kept);
    setKept((m) => {
      const next = new Map(m);
      for (const id of ids) next.set(id, keepPrivate);
      return next;
    });
    setError("");
    setMessage("Saving…");
    startTransition(async () => {
      const result: SharingResult = await setKeepPrivate(ids, keepPrivate).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
      if (result.error) {
        setKept(before);
        setMessage("");
        setError(result.error);
      } else if (result.refused) {
        setMessage("");
        setError(`${result.refused} couldn't change: someone else decides for them. Reload to see where they stand.`);
      } else {
        setMessage(done);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {pending ? "Saving…" : message}
      </p>
      <p role="alert" className="text-sm font-medium text-error empty:hidden">
        {error ? `Error: ${error}` : ""}
      </p>
      {sections
        .filter((s) => s.rows.length)
        .map((s) => {
          const priv = s.rows.filter((r) => kept.get(r.id)).length;
          // Only the ones this member may change (#195).
          const open = s.rows.filter((r) => !r.locked);
          return (
            <ProfilePanel
              key={s.key}
              id={`sharing-${s.key}`}
              title={`${s.title} (${s.rows.length})`}
              summary={`${s.rows.length - priv} shared · ${priv} private`}
            >
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={pending || !open.some((r) => kept.get(r.id))}
                  onClick={() =>
                    save(
                      open.filter((r) => kept.get(r.id)).map((r) => r.id),
                      false,
                      `Shared all ${s.title.toLowerCase()}.`,
                    )
                  }
                >
                  Share All
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={pending || open.every((r) => kept.get(r.id))}
                  onClick={() =>
                    save(
                      open.filter((r) => !kept.get(r.id)).map((r) => r.id),
                      true,
                      `Kept all ${s.title.toLowerCase()} private.`,
                    )
                  }
                >
                  Keep All Private
                </button>
              </div>
              <ul className="rows flex flex-col">
                {s.rows.map((r) => {
                  const on = kept.get(r.id) ?? false;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        {/* A full page, not the directory's quick view. */}
                        <a href={`/connections/${r.id}`} className="link font-medium break-words">
                          {r.name}
                        </a>
                        <p className="text-sm text-muted">
                          {r.type} · {r.catalog}
                          {r.archived ? " · Archived" : ""}
                        </p>
                      </div>
                      {r.locked ? (
                        <p className="text-sm text-muted">
                          {r.isUs ? r.locked : `${on ? "Private" : "Shared"} · ${r.locked}`}
                        </p>
                      ) : (
                        <label className="choice shrink-0">
                          <input
                            type="checkbox"
                            aria-label={`Keep ${r.name} private`}
                            checked={on}
                            onChange={(e) =>
                              save(
                                [r.id],
                                e.target.checked,
                                e.target.checked ? `${r.name}: only ${band} sees it.` : `${r.name}: shared.`,
                              )
                            }
                          />
                          <span>Keep Private</span>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ProfilePanel>
          );
        })}
    </div>
  );
}
