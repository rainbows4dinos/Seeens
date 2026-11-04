"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ConnectionCard } from "@/components/connection-card";
import { DateLines } from "@/components/date-line";
import { useLayout } from "@/components/layout-toggle";
import { loadMoreConnections } from "@/lib/connections/directory-actions";
import type { Cursor, DirectoryItem, GroupCounts } from "@/lib/connections/directory";
import { STATUSES, STATUS_LABELS, formatLocality, formatType } from "@/lib/connections/labels";
import { catalogNo, initials } from "@/lib/connections/card";

// The directory's rows or cards, grouped by status, a page at a time.
// "Show More" fetches the next page and appends it in place; a group that
// runs across pages just keeps going. Group headings count the whole group,
// not just what's loaded.
//
// Show More is a real link (?after=…) so it still works before the page's
// script loads; with script it loads in place and the URL stays put.
export function DirectoryResults({
  initialItems,
  initialNext,
  groups,
  matched,
  query,
  today,
}: {
  initialItems: DirectoryItem[];
  initialNext: Cursor | null;
  groups: GroupCounts;
  matched: number;
  /** The directory URL's query string, without layout or after. */
  query: string;
  today: string;
}) {
  const { layout } = useLayout();
  const [items, setItems] = useState(initialItems);
  const [next, setNext] = useState(initialNext);

  // Next keeps this page's state when you navigate away and back (Activity).
  // When the server sends a fresh first page (say, after adding a photo),
  // take it, and keep any pages already loaded with Show More after it.
  const [shown, setShown] = useState(initialItems);
  if (shown !== initialItems) {
    const extra = items.slice(shown.length);
    const fresh = new Set(initialItems.map((c) => c.id));
    setShown(initialItems);
    setItems([...initialItems, ...extra.filter((c) => !fresh.has(c.id))]);
    if (!extra.length) setNext(initialNext);
  }
  const [pending, startTransition] = useTransition();
  const [announce, setAnnounce] = useState("");
  const [failed, setFailed] = useState(false);
  // After loading more, focus moves to the first new connection.
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    if (!focusId.current) return;
    document.querySelector<HTMLElement>(`main a[href="/connections/${focusId.current}"]`)?.focus();
    focusId.current = null;
  }, [items]);

  const moreHref = next ? `/?${query ? `${query}&` : ""}after=${encodeURIComponent(JSON.stringify(next))}` : null;

  function loadMore(e: React.MouseEvent) {
    if (!next || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setFailed(false);
    startTransition(async () => {
      try {
        const page = await loadMoreConnections(query, next);
        const seen = new Set(items.map((c) => c.id));
        const fresh = page.items.filter((c) => !seen.has(c.id));
        focusId.current = fresh[0]?.id ?? null;
        setItems([...items, ...fresh]);
        setNext(page.next);
        setAnnounce(`${fresh.length} more loaded, ${items.length + fresh.length} of ${matched}.`);
      } catch {
        setFailed(true);
        setAnnounce("Couldn't load more. Try again.");
      }
    });
  }

  const sections = [
    { id: "us", label: "Us", tag: "tag-ink", count: groups.us, rows: items.filter((c) => c.is_us), counted: false },
    ...STATUSES.map((status) => ({
      id: status,
      label: STATUS_LABELS[status],
      tag: `tag-${status}`,
      count: groups[status],
      rows: items.filter((c) => !c.is_us && c.status === status),
      counted: true,
    })),
  ].filter((s) => s.rows.length);

  return (
    <>
      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`group-${s.id}`} className="flex flex-col gap-2">
          <h2 id={`group-${s.id}`} className="label">
            <span className={`tag ${s.tag}`}>{s.label}</span>
            {s.counted ? (
              <>
                {" "}
                <span className="text-muted">({s.count})</span>
              </>
            ) : null}
          </h2>
          {layout === "list" ? (
            <ConnectionRows connections={s.rows} today={today} />
          ) : (
            <ConnectionCards connections={s.rows} today={today} />
          )}
        </section>
      ))}

      {moreHref ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link href={moreHref} onClick={loadMore} className="button-secondary" aria-disabled={pending || undefined}>
            {pending ? "Loading…" : "Show More"}
          </Link>
          <span className="text-sm text-muted">
            {items.length} of {matched} loaded
          </span>
          {failed ? <span className="text-sm">Couldn&rsquo;t load more. Try again.</span> : null}
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </>
  );
}

function ConnectionRows({ connections, today }: { connections: DirectoryItem[]; today: string }) {
  return (
    <ul className="panel rows flex flex-col">
      {connections.map((c) => {
        const place = formatLocality(c.localities);
        return (
          <li key={c.id}>
            <Link
              href={`/connections/${c.id}`}
              className="flex flex-col gap-1 px-3 py-3 row-link sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <span className="flex min-w-0 items-start gap-3">
              {/* The copied photo, or initials on photo paper. Decorative: the name is right beside it. */}
              <span className="row-thumb" aria-hidden="true">
                <span className="row-thumb-initials">{initials(c.name)}</span>
                {c.photo_url ? (
                  // Signed storage links change on every load, so next/image's cache wouldn't help.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_url} alt="" loading="lazy" decoding="async" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col gap-2">
                {/* Name first for screen readers; type caption sits above it visually, like the Figma card. */}
                <span className="flex flex-col-reverse gap-1">
                  <span className="font-display text-xl leading-6 font-semibold tracking-[-0.03em] break-words">
                    {c.name}
                  </span>
                  <span className="caption">
                    {formatType(c)} · <span className="whitespace-nowrap">{catalogNo(c)}</span>
                  </span>
                </span>
                <DateLines lastOutreach={c.outreach_entries[0]} nextAction={c.next_actions[0]} today={today} />
              </span>
              </span>
              {/* Phones: town on the left, tags on the right (Figma Directory Row, Mobile). */}
              <span className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                {place ? <span className="text-sm text-muted">{place}</span> : null}
                {c.played_together || c.tags.length ? (
                  <span className="flex flex-wrap gap-2 max-sm:ml-auto">
                    {c.played_together ? <span className="tag">Played together</span> : null}
                    {c.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ConnectionCards({ connections, today }: { connections: DirectoryItem[]; today: string }) {
  return (
    <ul className="card-grid">
      {connections.map((c) => {
        const tags = [
          ...new Set([c.played_together ? "Played together" : null, ...c.tags, ...c.scenes]),
        ].filter((t): t is string => Boolean(t));
        return (
          <li key={c.id} className="flex">
            <ConnectionCard
              connection={c}
              today={today}
              tags={tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            />
          </li>
        );
      })}
    </ul>
  );
}
