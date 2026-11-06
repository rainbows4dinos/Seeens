"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { initials } from "@/lib/connections/card";
import { markNotDuplicateOf, mergeConnections, type MergeState } from "@/lib/connections/merge-actions";
import type { MergeCandidate } from "@/lib/connections/merge";
import { offline } from "@/lib/offline";
import { Photo } from "@/components/photo";
import { joinNames } from "@/components/merged-notice";

type Candidate = MergeCandidate & { photo: string | null };

// The merge review (#169): every duplicate side by side, the one to keep,
// and what will happen. The kept one wins; the others fill its blanks.
export function MergeReview({
  candidates,
  defaultKeep,
  until,
}: {
  candidates: Candidate[];
  defaultKeep: string;
  until: string;
}) {
  const router = useRouter();
  const [keep, setKeep] = useState(defaultKeep);
  const [state, action, merging] = useActionState<MergeState, FormData>(mergeConnections, {});
  const [removing, startRemoving] = useTransition();
  const [removeError, setRemoveError] = useState<string>();
  const kept = candidates.find((c) => c.id === keep) ?? candidates[0];
  const others = candidates.filter((c) => c.id !== kept.id).sort((a, b) => b.weight - a.weight);
  const otherNames = joinNames(others.map((o) => o.name));
  const many = candidates.length > 3;

  const takeOut = (c: Candidate) =>
    startRemoving(async () => {
      setRemoveError(undefined);
      const rest = candidates.filter((x) => x.id !== c.id);
      const r = await markNotDuplicateOf(
        c.id,
        rest.map((x) => x.id),
      ).catch(offline({ error: "Couldn't reach Seeens. Try again." }));
      if (r.error) return setRemoveError(r.error);
      if (rest.length < 2) return router.push("/duplicates");
      const q = new URLSearchParams(rest.map((x) => ["ids", x.id]));
      q.set("keep", kept.id === c.id ? rest[0].id : kept.id);
      router.replace(`/merge?${q}`);
    });

  return (
    <form action={action} className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="display-l break-words">
          {candidates.length === 2 ? `Merge ${candidates[0].name} and ${candidates[1].name}` : `Merge ${candidates.length} duplicates`}
        </h1>
        <p className="text-muted">
          Pick the one to keep. Its details stay as they are; the others only fill in what&rsquo;s blank, the most
          complete first. Take out any that aren&rsquo;t the same.
        </p>
      </div>

      {candidates.map((c) => (
        <input key={c.id} type="hidden" name="ids" value={c.id} />
      ))}

      <fieldset
        className={many ? "merge-cards merge-cards-stacked" : "merge-cards"}
        data-count={candidates.length}
        disabled={merging || removing}
      >
        <legend className="sr-only">Keep which one?</legend>
        {candidates.map((c) => (
          <section key={c.id} className="profile-panel merge-card" aria-labelledby={`m-${c.id}`} data-kept={c.id === kept.id || undefined}>
            <div className="profile-panel-title merge-card-title">
              <span>{c.catalog}</span>
              {c.id === kept.id ? <span className="font-normal">Keeping</span> : null}
            </div>
            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
              <header className="flex items-center gap-4">
                <span className="quick-view-thumb" aria-hidden="true">
                  <span className="row-thumb-initials">{initials(c.name)}</span>
                  {c.photo ? <Photo src={c.photo} alt="" decoding="async" /> : null}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 id={`m-${c.id}`} className="display-m break-words">
                    <Link href={`/connections/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">{c.meta}</p>
                  {c.archived ? <p className="text-sm text-muted">Archived</p> : null}
                </div>
              </header>
              <dl className="quick-view-facts">
                {c.facts.map((f) => (
                  <div key={f.label} className="contents">
                    <dt className="text-muted">{f.label}</dt>
                    <dd className={f.value ? "min-w-0 break-words" : "text-muted"}>{f.value ?? "None"}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex flex-wrap gap-3">
                <label className="choice">
                  <input
                    type="radio"
                    name="keep"
                    value={c.id}
                    checked={c.id === kept.id}
                    onChange={() => setKeep(c.id)}
                  />
                  <span>Keep this one</span>
                </label>
                {c.id !== kept.id ? (
                  <button type="button" className="button-secondary" onClick={() => takeOut(c)}>
                    Not a Duplicate<span className="sr-only">: {c.name}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ))}
      </fieldset>

      <section className="panel flex flex-col gap-3 p-4" aria-labelledby="merge-what">
        <h2 id="merge-what" className="display-s">
          What happens
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {whatHappens(kept, others, until).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {state.error || removeError ? (
        <p role="alert" className="text-sm font-medium text-error">
          {state.error ?? removeError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="button-primary" disabled={merging || removing}>
          {merging ? "Merging…" : `Merge ${others.length === 1 ? otherNames : others.length} into ${kept.name}`}
        </button>
        <Link href="/duplicates" className="button-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

// Plain lines from the facts we already show: what fills in, what moves,
// and how long undo lasts. Each line names only the ones it's true of.
function whatHappens(kept: Candidate, others: Candidate[], until: string) {
  const val = (c: Candidate, label: string) => c.facts.find((f) => f.label === label)?.value ?? null;
  const names = (cs: Candidate[]) => joinNames(cs.map((o) => o.name));
  const lines = [`${kept.name} keeps its name, type, status, and ${kept.catalog}.`];

  const fills = ["Town", "Email", "Phone", "Notes"]
    .filter((l) => !val(kept, l))
    .map((l) => ({ label: l, from: others.find((o) => val(o, l)) }))
    .filter((f): f is { label: string; from: Candidate } => Boolean(f.from));
  for (const from of new Set(fills.map((f) => f.from))) {
    const labels = fills.filter((f) => f.from === from).map((f) => f.label);
    lines.push(`${joinNames(labels)} ${labels.length === 1 ? "fills" : "fill"} in from ${from.name}.`);
  }
  const notes = others.filter((o) => val(o, "Notes"));
  if (val(kept, "Notes") && notes.length) lines.push(`Notes from ${names(notes)} go below ${possessive(kept.name)}.`);

  lines.push(`Links, scenes, connections, and outreach from ${names(others)} move over. Repeats are dropped.`);

  const withPlans = others.filter((o) => val(o, "Plan"));
  if (withPlans.length && val(kept, "Plan")) {
    const one = withPlans.length === 1;
    lines.push(
      `${joinNames(withPlans.map((o) => possessive(o.name)))} plan${one ? " closes" : "s close"} as dropped; ${possessive(kept.name)} stays.`,
    );
  } else if (withPlans.length > 1) {
    lines.push(`${possessive(withPlans[0].name)} plan becomes the plan; the others close as dropped.`);
  }

  lines.push(
    `${names(others)} ${others.length === 1 ? "is" : "are"} hidden, then deleted after 30 days. You can undo until ${until}.`,
  );
  return lines;
}

function possessive(name: string) {
  return /s$/i.test(name) ? `${name}\u2019` : `${name}\u2019s`;
}
