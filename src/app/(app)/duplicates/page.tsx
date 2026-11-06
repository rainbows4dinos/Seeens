import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { formatDate } from "@/lib/connections/labels";
import { loadDuplicateGroups } from "@/lib/connections/merge";
import { BackButton } from "@/components/back-button";
import { NoWorkspace } from "@/components/no-workspace";
import { NotDuplicatesButton } from "@/components/not-duplicates-button";

export const metadata: Metadata = { title: "Possible duplicates · Seeens" };

// Possible duplicates (#169): connections with matching names and the same
// type, grouped. Compare a group to merge it, or say they're different.
export default function DuplicatesPage() {
  return (
    <div className="page-measure flex flex-col gap-8">
      <BackButton href="/" />
      <div className="flex flex-col gap-2">
        <h1 className="display-l">Possible duplicates</h1>
        <p className="text-muted">
          Same name and type, ignoring case, &ldquo;The,&rdquo; and punctuation. Compare a group to merge it, or mark
          them as different.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Groups />
      </Suspense>
    </div>
  );
}

async function Groups() {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const groups = await loadDuplicateGroups();

  if (!groups.length) {
    return (
      <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
        <p className="font-medium">No possible duplicates.</p>
        <p className="text-muted">
          To merge two that don&rsquo;t match by name, use Merge with&hellip; at the bottom of either profile.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-6">
      {groups.map((g) => {
        const ids = g.map((c) => c.id);
        const compare = `/merge?${new URLSearchParams(ids.map((id) => ["ids", id]))}`;
        return (
          <li key={ids.join(",")} className="panel flex flex-col">
            <ul className="rows flex flex-col">
              {g.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-xs uppercase tracking-wide text-muted">
                      {c.type} · {c.catalog}
                    </p>
                    <Link href={`/connections/${c.id}`} className="display-s break-words hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted">Added {formatDate(c.created_at, membership.timeZone)}</p>
                  </div>
                  {c.place ? <p className="text-sm text-muted sm:shrink-0">{c.place}</p> : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 p-3">
              <Link href={compare} className="button-primary">
                Compare and Merge
              </Link>
              <NotDuplicatesButton ids={ids} names={g.map((c) => c.name)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
