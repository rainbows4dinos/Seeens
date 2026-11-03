import { noAutofill } from "@/lib/no-autofill";
import Link from "next/link";
import { Combobox } from "@/components/combobox";
import { AutoFilterForm, FilterDisclosure } from "@/components/filter-form";
import { Add, Search as SearchIcon } from "@carbon/icons-react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { ConnectionCard } from "@/components/connection-card";
import { LayoutProvider, LayoutSlot, LayoutToggle } from "@/components/layout-toggle";
import { PinWatch } from "@/components/pin-watch";
import { LAYOUT_COOKIE, readLayout, type DirectoryLayout } from "@/lib/connections/card";
import { getMembership } from "@/lib/auth/dal";
import { loadDirectory } from "@/lib/connections/queries";
import {
  STATUSES,
  STATUS_LABELS,
  formatLocality,
  formatType,
} from "@/lib/connections/labels";
import type { ConnectionListItem } from "@/lib/connections/queries";
import type { ConnectionStatus } from "@/lib/connections/labels";
import { NoWorkspace } from "@/components/no-workspace";
import { DateLines } from "@/components/date-line";
import { todayISO } from "@/lib/outreach/labels";
import { listSceneOptions, nestScenes, sceneAndChildren } from "@/lib/scenes/queries";
import {
  TYPE_OPTIONS,
  hasFilters,
  matches,
  readFilters,
  type DirectoryFilters,
} from "@/lib/connections/filters";

export default function DirectoryPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the directory…</p>}>
      <Directory searchParams={searchParams} />
    </Suspense>
  );
}

async function Directory({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const today = todayISO(new Date(), membership.timeZone);

  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const view = readView(params.view);
  // List or cards: the URL wins (shared links), then this device's last choice.
  const layout: DirectoryLayout =
    readLayout(params.layout) ?? readLayout(cookieStore.get(LAYOUT_COOKIE)?.value) ?? "list";
  const layoutHrefs = {
    list: withLayout(params, "list"),
    cards: withLayout(params, "cards"),
  };
  const archived = view === "archived";
  const list = LISTS[view as ListView] ?? null;
  const asked = readFilters(params);
  // The Let's play and Prospects views are the directory with one status.
  const filters = list ? { ...asked, statuses: [list.status] } : asked;
  const filtering = hasFilters(asked);
  // "all" is everyone in this view (current or archived).
  const [{ list: all, network }, scenes] = await Promise.all([
    loadDirectory({ archived }),
    listSceneOptions(),
  ]);
  const sceneIds = filters.scene
    ? sceneAndChildren(scenes, filters.scene)
    : null;
  const connections = all.filter((c) =>
    matches(c, filters, { sceneIds, hideAvoid: !archived }),
  );
  const hiddenAvoid =
    view === "current" && !filters.statuses.length
      ? all.filter(
          (c) =>
            c.status === "avoid" &&
            !c.is_us &&
            matches(
              c,
              { ...filters, statuses: ["avoid"] },
              { sceneIds, hideAvoid: false },
            ),
        ).length
      : 0;
  const towns = [
    ...new Map(
      all
        .filter((c) => c.locality_id && c.localities)
        .map((c) => [c.locality_id!, formatLocality(c.localities)!] as const),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  // In Let's play and Prospects, "of Y" counts that list, not everyone.
  const total = list ? all.filter((c) => c.status === list.status).length : all.length;
  const us = connections.filter((c) => c.is_us);
  const sceneNames = new Map(scenes.map((sc) => [sc.id, sc.name]));
  const tagsFor = (id: string) =>
    [
      network.isLabelMateWithUs(id) ? "Label mate" : null,
      network.sharedMembersWithUs(id).length ? "Shares a member" : null,
    ].filter((t): t is string => Boolean(t));

  const filtersOpen = Boolean(asked.statuses.length || filters.type || filters.scene || filters.town);
  const clearable = hasFilters(list ? { ...asked, statuses: [] } : asked);

  return (
    // key: a server render with a different layout (a shared link) resets it.
    <LayoutProvider key={layout} initial={layout}>
      <div className="flex flex-col gap-6">
        <h1 className="display-l sm:display-xl">Directory</h1>

        {/* Every directory control in one bar, pinned while the list scrolls.
            Phones pin only the search row. */}
        <PinWatch selector=".directory-bar, .bar-search" />
        <div className="directory-bar">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Directory views" className="segmented">
              {VIEWS.map((v) => (
                <ViewLink key={v.id} href={viewHref(v.id)} current={view === v.id}>
                  {v.label}
                </ViewLink>
              ))}
            </nav>
            <Link href="/connections/new" className="button-primary">
              <Add size={16} aria-hidden="true" />
              Add Connection
            </Link>
          </div>

          {all.length ? (
            <FilterForm
              filters={filters}
              view={view}
              scenes={nestScenes(scenes)}
              towns={towns}
              open={filtersOpen}
              layoutToggle={<LayoutToggle hrefs={layoutHrefs} />}
            />
          ) : null}
        </div>

        {list ? <p className="page-measure text-muted">{list.intro}</p> : null}

        {all.length === 0 ? (
          archived ? (
            <p className="text-muted">Nothing archived.</p>
          ) : list ? (
            <p className="text-muted">{list.empty}</p>
          ) : (
            <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
              <p className="font-medium">No connections yet.</p>
              <p className="text-muted">
                Start with a band you&rsquo;ve shared a bill with, a venue
                you&rsquo;ve played, or someone you&rsquo;d like to meet.
              </p>
              <Link href="/connections/new" className="button-secondary">
                Add Your First Connection
              </Link>
            </div>
          )
        ) : (
          <>
            <div
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted"
              aria-live="polite"
            >
              <p>
                {filtering || connections.length !== total
                  ? `Showing ${connections.length} of ${total}`
                  : `${total} ${total === 1 ? "connection" : "connections"}`}
              </p>
              {hiddenAvoid ? (
                <Link
                  href={filterHref({ ...filters, statuses: ["avoid"] }, view)}
                  className="link"
                >
                  {hiddenAvoid} in Avoid, hidden. Show them
                </Link>
              ) : null}
              {clearable ? (
                <Link href={viewHref(view)} className="link">
                  Clear filters
                </Link>
              ) : null}
            </div>

            {connections.length === 0 && list && !filtering ? (
              <p className="text-muted">{list.empty}</p>
            ) : connections.length === 0 ? (
              <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
                <p className="font-medium">Nothing matches.</p>
                <p className="text-muted">
                  Try fewer filters or a shorter search.
                </p>
                <Link href={viewHref(view)} className="button-secondary">
                  Clear Filters
                </Link>
              </div>
            ) : null}

            {us.length ? (
              <section aria-labelledby="group-us" className="flex flex-col gap-2">
                <h2
                  id="group-us"
                  className="label"
                >
                  <span className="tag tag-ink">Us</span>
                </h2>
                <ConnectionGroup connections={us} tagsFor={tagsFor} sceneNames={sceneNames} today={today} />
              </section>
            ) : null}
            {STATUSES.map((status) => {
              const group = connections.filter(
                (c) => c.status === status && !c.is_us,
              );
              if (!group.length) return null;
              return (
                <section
                  key={status}
                  aria-labelledby={`group-${status}`}
                  className="flex flex-col gap-2"
                >
                  <h2
                    id={`group-${status}`}
                    className="label"
                  >
                    <span className={`tag tag-${status}`}>{STATUS_LABELS[status]}</span>{" "}
                    <span className="text-muted">({group.length})</span>
                  </h2>
                  <ConnectionGroup connections={group} tagsFor={tagsFor} sceneNames={sceneNames} today={today} />
                </section>
              );
            })}
          </>
        )}

        {all.length ? (
          <p className="rule-top pt-4">
            <Link href="/export" className="action-link text-sm">
              Export the directory as CSV
            </Link>
          </p>
        ) : null}
      </div>
    </LayoutProvider>
  );
}

type View = "current" | "lets_play" | "prospects" | "archived";
type ListView = "lets_play" | "prospects";

const VIEWS: { id: View; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "lets_play", label: "Let's play" },
  { id: "prospects", label: "Prospects" },
  { id: "archived", label: "Archived" },
];

// Plain lists, no ranking: the order is alphabetical on purpose.
const LISTS: Record<ListView, { status: ConnectionStatus; intro: string; empty: string }> = {
  lets_play: {
    status: "lets_play",
    intro:
      "People and bands you both want to play with. Filter by town or scene when you're putting a show together.",
    empty:
      "No one here yet. Mark a connection Let's play when you both want to share a bill.",
  },
  prospects: {
    status: "prospect",
    intro: "Who you'd like to know. Notes are what bandmates have picked up, not checked facts.",
    empty: "No prospects yet. Mark a connection Prospect when you'd like to reach out.",
  },
};

function readView(v: string | string[] | undefined): View {
  const value = Array.isArray(v) ? v[0] : v;
  return VIEWS.some((x) => x.id === value) ? (value as View) : "current";
}

function viewHref(view: View) {
  return view === "current" ? "/" : `/?view=${view}`;
}

// The same directory URL with a different layout.
function withLayout(params: Record<string, string | string[] | undefined>, layout: DirectoryLayout) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "layout" || value === undefined) continue;
    (Array.isArray(value) ? value : [value]).forEach((v) => p.append(key, v));
  }
  p.set("layout", layout);
  return `/?${p.toString()}`;
}

function filterHref(f: DirectoryFilters, view: View) {
  const p = new URLSearchParams();
  if (view !== "current") p.set("view", view);
  if (f.q) p.set("q", f.q);
  if (!LISTS[view as ListView]) f.statuses.forEach((st) => p.append("status", st));
  if (f.type) p.set("type", f.type);
  if (f.scene) p.set("scene", f.scene);
  if (f.town) p.set("town", f.town);
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

// A plain GET form: works without JavaScript, and the URL is shareable.
function FilterForm({
  filters: f,
  view,
  scenes,
  towns,
  open,
  layoutToggle,
}: {
  filters: DirectoryFilters;
  view: View;
  scenes: {
    scene: { id: string; name: string };
    children: { id: string; name: string }[];
  }[];
  towns: (readonly [string, string])[];
  open: boolean;
  layoutToggle: React.ReactNode;
}) {
  const isList = Boolean(LISTS[view as ListView]);
  const active = [!isList && f.statuses.length, f.type, f.scene, f.town].filter(Boolean).length;
  return (
    <AutoFilterForm
      role="search"
      aria-label="Search and filter the directory"
      className="bar-search flex flex-col gap-3"
    >
      {view !== "current" ? <input type="hidden" name="view" value={view} /> : null}
      <FilterDisclosure
        initialOpen={open}
        active={active}
        after={layoutToggle}
        search={
          <>
            <div className="search-field">
              <label htmlFor="f-q" className="sr-only">
                Search by Name
              </label>
              <SearchIcon size={16} aria-hidden="true" />
              <input {...noAutofill}
                id="f-q"
                name="q"
                type="search"
                placeholder="Search by Name"
                defaultValue={f.q}
                className="field"
                enterKeyHint="search"
              />
              <kbd className="search-hint" aria-hidden="true">
                Enter
              </kbd>
            </div>
            {/* Enter searches. The filter boxes are text inputs too, which
                turns off a form's implicit submit unless it has a submit
                button, so keep one, out of sight and out of the tab order. */}
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
              Search
            </button>
          </>
        }
      >
        <div className={`grid grid-cols-2 gap-3 ${isList ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
          {isList ? null : (
            <Combobox
              label="Status"
              labelClassName="sr-only"
              name="status"
              placeholder="Status"
              options={STATUSES.map((st) => ({ value: st, label: STATUS_LABELS[st] }))}
              defaultValue={f.statuses}
              autoSubmit
            />
          )}
          <Combobox
            label="Connection Type"
            labelClassName="sr-only"
            name="type"
            multiple={false}
            placeholder="Connection Type"
            options={TYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              hint: o.group === "People" ? "person" : "group",
            }))}
            defaultValue={f.type ? [f.type] : []}
            autoSubmit
          />
          <Combobox
            label="Scene"
            labelClassName="sr-only"
            name="scene"
            multiple={false}
            placeholder="Scene"
            options={scenes.flatMap(({ scene, children }) => [
              {
                value: scene.id,
                label: scene.name,
                hint: children.length ? "and the scenes inside it" : undefined,
              },
              ...children.map((c) => ({ value: c.id, label: c.name, depth: 1 })),
            ])}
            defaultValue={f.scene ? [f.scene] : []}
            autoSubmit
          />
          <Combobox
            label="Town"
            labelClassName="sr-only"
            name="town"
            multiple={false}
            placeholder="Town"
            options={towns.map(([id, label]) => ({ value: id, label }))}
            defaultValue={f.town ? [f.town] : []}
            autoSubmit
          />
        </div>
      </FilterDisclosure>
    </AutoFilterForm>
  );
}

function ViewLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

// One status group, as list rows or cards. Same groups, same order. Both
// are sent so switching is instant; only the chosen one is mounted.
function ConnectionGroup({
  connections,
  tagsFor,
  sceneNames,
  today,
}: {
  connections: ConnectionListItem[];
  tagsFor: (id: string) => string[];
  sceneNames: Map<string, string>;
  today: string;
}) {
  return (
    <LayoutSlot
      list={<ConnectionList connections={connections} tagsFor={tagsFor} today={today} />}
      cards={<ConnectionCards connections={connections} tagsFor={tagsFor} sceneNames={sceneNames} today={today} />}
    />
  );
}

function ConnectionCards({
  connections,
  tagsFor,
  sceneNames,
  today,
}: {
  connections: ConnectionListItem[];
  tagsFor: (id: string) => string[];
  sceneNames: Map<string, string>;
  today: string;
}) {
  return (
    <ul className="card-grid">
      {connections.map((c) => {
        const tags = [
          c.played_together ? "Played together" : null,
          ...tagsFor(c.id),
          ...c.connection_scenes.map((cs) => sceneNames.get(cs.scene_id)),
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

function ConnectionList({
  connections,
  tagsFor,
  today,
}: {
  connections: ConnectionListItem[];
  tagsFor: (id: string) => string[];
  today: string;
}) {
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
              <span className="flex min-w-0 flex-col gap-2">
                {/* Name first for screen readers; type caption sits above it visually, like the Figma card. */}
                <span className="flex flex-col-reverse gap-1">
                  <span className="font-display text-xl leading-6 font-semibold tracking-[-0.03em] break-words">
                    {c.name}
                  </span>
                  <span className="caption">{formatType(c)}</span>
                </span>
                <DateLines lastOutreach={c.outreach_entries[0]} nextAction={c.next_actions[0]} today={today} />
              </span>
              <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                {place ? <span className="text-sm text-muted">{place}</span> : null}
                {c.played_together ? <span className="tag">Played together</span> : null}
                {tagsFor(c.id).map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
