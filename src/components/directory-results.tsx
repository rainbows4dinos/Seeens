"use client";

import Link from "next/link";
import { photoUrl } from "@/lib/photos/urls";
import { Photo } from "@/components/photo";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { ConnectionCard } from "@/components/connection-card";
import { DateLines } from "@/components/date-line";
import { useLayout } from "@/components/layout-toggle";
import { loadMoreConnections } from "@/lib/connections/directory-actions";
import type { Cursor, DirectoryItem, GroupCounts } from "@/lib/connections/directory";
import { detailFor, wordSetForTab, type Tab } from "@/lib/connections/tabs";
import { STATUSES, STATUS_WORDS, formatLocality, formatType, playedWords } from "@/lib/connections/labels";
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
  tab,
}: {
  initialItems: DirectoryItem[];
  initialNext: Cursor | null;
  groups: GroupCounts;
  matched: number;
  /** The directory URL's query string, without layout or after. */
  query: string;
  today: string;
  /** Which tab: decides the detail line and whether scenes show. */
  tab: Tab;
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

  // Our own band isn't in the directory; the header's band chip opens it (#123).
  const sections = STATUSES.map((status) => ({
    id: status,
    label: STATUS_WORDS[wordSetForTab(tab)][status],
    tag: `tag-${status}`,
    count: groups[status],
    rows: items.filter((c) => c.status === status),
  })).filter((s) => s.rows.length);

  return (
    <>
      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`group-${s.id}`} className="flex flex-col gap-2">
          <h2 id={`group-${s.id}`} className="label">
            <span className={`tag ${s.tag}`}>{s.label}</span> <span className="text-muted">({s.count})</span>
          </h2>
          {layout === "list" ? (
            <ConnectionRows connections={s.rows} today={today} tab={tab} />
          ) : (
            <ConnectionCards connections={s.rows} today={today} tab={tab} />
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

// Tags: played together, the network tags, then scenes (not on All, which
// keeps to type, town, and latest).
function tagsFor(c: DirectoryItem, tab: Tab) {
  return [
    ...new Set([
      // "Close to us" (#140): which band a person's status comes from.
      c.via ? `Via ${c.via}` : null,
      c.played_together ? playedWords(c).tag : null,
      ...c.tags,
      ...(tab === "all" ? [] : c.scenes),
    ]),
  ].filter(
    (t): t is string => Boolean(t),
  );
}

// The connection open in the quick view (#126), from the URL: the panel's
// route is /connections/[id] while the list stays on screen.
function useOpenId() {
  return usePathname().match(/^\/connections\/([^/]+)$/)?.[1] ?? null;
}

// Opening a connection takes a moment. A second click on the same row in
// that time (a double-click) started a second navigation to the same
// intercepted route, and Next hid the directory behind the panel. So a row
// ignores clicks while its connection is opening, and once it's open.
function useOpenGuard(openId: string | null) {
  const opening = useRef<{ id: string; at: number } | null>(null);
  // Opened: clicks on it are the open row's now.
  useEffect(() => {
    if (openId && opening.current?.id === openId) opening.current = null;
  }, [openId]);
  return (id: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const now = performance.now();
    // 3s at most, in case a navigation never lands.
    if (id === openId || (opening.current?.id === id && now - opening.current.at < 3000)) {
      e.preventDefault();
      return;
    }
    opening.current = { id, at: now };
  };
}

function ConnectionRows({ connections, today, tab }: { connections: DirectoryItem[]; today: string; tab: Tab }) {
  const openId = useOpenId();
  const guard = useOpenGuard(openId);
  return (
    <ul className="panel rows flex flex-col">
      {connections.map((c) => {
        const place = formatLocality(c.localities);
        const tags = tagsFor(c, tab);
        const detail = detailFor(c, tab);
        return (
          <li key={c.id}>
            {/* Opens in the quick view. With one already open, switching
                replaces it, so Back (and Close) return to the directory. */}
            <Link
              href={`/connections/${c.id}`}
              replace={openId !== null}
              onClick={guard(c.id)}
              aria-current={c.id === openId ? "true" : undefined}
              className="flex flex-col gap-1 px-3 py-3 row-link @3xl:flex-row @3xl:items-start @3xl:justify-between @3xl:gap-4"
            >
              <span className="flex min-w-0 items-start gap-3">
              {/* The copied photo, or initials on photo paper. Decorative: the name is right beside it. */}
              <span className="row-thumb" aria-hidden="true">
                <span className="row-thumb-initials">{initials(c.name)}</span>
                {c.photo_path ? (
                  // A small copy at a stable, cached address.
                  <Photo src={photoUrl(c.photo_path, 160)!} alt="" loading="lazy" decoding="async" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col gap-2">
                {/* Name first for screen readers; type caption sits above it visually, like the Figma card. */}
                <span className="flex flex-col-reverse gap-1">
                  <span className="display-s break-words">
                    {c.name}
                  </span>
                  <span className="caption">
                    {formatType(c)} · <span className="whitespace-nowrap">{catalogNo(c)}</span>
                  </span>
                </span>
                {detail ? <span className="detail-line">{detail}</span> : null}
                <DateLines lastOutreach={c.outreach_entries[0]} nextAction={c.next_actions[0]} today={today} />
              </span>
              </span>
              {/* Narrow lists (phones, or beside the quick view): town on the
                  left, tags on the right (Figma Directory Row, Mobile). */}
              <span className="flex flex-wrap items-center justify-between gap-2 @3xl:justify-end">
                {place ? <span className="text-sm text-muted">{place}</span> : null}
                {tags.length ? (
                  <span className="flex flex-wrap gap-1 @max-3xl:ml-auto @3xl:justify-end">
                    {tags.map((t) => (
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

function ConnectionCards({ connections, today, tab }: { connections: DirectoryItem[]; today: string; tab: Tab }) {
  const openId = useOpenId();
  const guard = useOpenGuard(openId);
  return (
    <ul className="card-grid">
      {connections.map((c) => {
        const tags = tagsFor(c, tab);
        return (
          <li key={c.id} className="flex">
            <ConnectionCard
              connection={c}
              today={today}
              detail={detailFor(c, tab)}
              open={c.id === openId}
              replace={openId !== null}
              onClick={guard(c.id)}
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
