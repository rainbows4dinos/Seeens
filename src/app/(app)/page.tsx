import { noAutofill } from "@/lib/no-autofill";
import Link from "next/link";
import { Combobox } from "@/components/combobox";
import { AutoFilterForm, FilterDisclosure } from "@/components/filter-form";
import { Add, Search as SearchIcon } from "@carbon/icons-react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { DirectoryResults } from "@/components/directory-results";
import { LayoutProvider, LayoutToggle } from "@/components/layout-toggle";
import { PinWatch } from "@/components/pin-watch";
import { SearchClear } from "@/components/search-clear";
import { LAYOUT_COOKIE, readLayout, type DirectoryLayout } from "@/lib/connections/card";
import { getMembership } from "@/lib/auth/dal";
import { loadDirectoryPage, readCursor, readDirectoryQuery, readView, type View } from "@/lib/connections/directory";
import { STATUSES, STATUS_LABELS, formatLocality } from "@/lib/connections/labels";
import type { ConnectionStatus } from "@/lib/connections/labels";
import { NoWorkspace } from "@/components/no-workspace";
import { todayISO } from "@/lib/outreach/labels";
import { nestScenes } from "@/lib/scenes/queries";
import { TYPE_OPTIONS, hasFilters, type DirectoryFilters } from "@/lib/connections/filters";

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
    readLayout(params.layout) ?? readLayout(cookieStore.get(LAYOUT_COOKIE)?.value) ?? "cards";
  const layoutHrefs = {
    list: withLayout(params, "list"),
    cards: withLayout(params, "cards"),
  };
  const archived = view === "archived";
  const list = LISTS[view as ListView] ?? null;
  const { asked, filters } = readDirectoryQuery(params);
  const filtering = hasFilters(asked);
  // No-script "Show More" lands here with ?after=…; with script it loads in place.
  const after = readAfter(params.after);
  const { items, next, counts, scenes } = await loadDirectoryPage({ view, asked, filters }, { after });
  const c = counts!;
  const towns = c.towns
    .map((t) => [t.id, formatLocality(t)!] as const)
    .sort((x, y) => x[1].localeCompare(y[1]));
  // The results' state resets whenever the filters change.
  const query = resultsQuery(params);

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
        {/* DOM order is reading and tab order: views, search and filters,
            then Add. Wide screens fit it all on one row; narrower ones put
            views and Add on top and search under them (see .directory-bar). */}
        <div className="directory-bar">
          <nav aria-label="Directory views" className="segmented bar-views">
            {VIEWS.map((v) => (
              <ViewLink key={v.id} href={viewHref(v.id)} current={view === v.id}>
                {v.label}
              </ViewLink>
            ))}
          </nav>

          {/* Phones stack the bar in the page column, so Add goes above the
              pinned search row. Only one of the two Adds is ever displayed. */}
          <AddConnection className="self-start md:hidden" />

          {c.view ? (
            <FilterForm
              filters={filters}
              view={view}
              scenes={nestScenes(scenes)}
              towns={towns}
              open={filtersOpen}
              layoutToggle={<LayoutToggle hrefs={layoutHrefs} />}
            />
          ) : null}

          <AddConnection className="bar-add max-md:hidden" />
        </div>

        {list ? <p className="page-measure text-muted">{list.intro}</p> : null}

        {c.view === 0 ? (
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
                {/* How many match, never how many are loaded (that's under the list). */}
                {filtering
                  ? `${c.matched} of ${c.total} match`
                  : `${c.matched} ${c.matched === 1 ? "connection" : "connections"}`}
              </p>
              {c.hiddenAvoid ? (
                <Link
                  href={filterHref({ ...filters, statuses: ["avoid"] }, view)}
                  className="link"
                >
                  {c.hiddenAvoid} in Avoid, hidden. Show them
                </Link>
              ) : null}
              {clearable ? (
                <Link href={viewHref(view)} className="link">
                  Clear filters
                </Link>
              ) : null}
              {after ? (
                <Link href={query ? `/?${query}` : "/"} className="link">
                  Back to the start
                </Link>
              ) : null}
            </div>

            {c.matched === 0 && list && !filtering ? (
              <p className="text-muted">{list.empty}</p>
            ) : c.matched === 0 ? (
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

            <DirectoryResults
              key={`${query}|${after ? JSON.stringify(after) : ""}`}
              initialItems={items}
              initialNext={next}
              groups={c.groups}
              matched={c.matched}
              query={query}
              today={today}
            />
          </>
        )}

        {c.view ? (
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

type ListView = "lets_play" | "crushes";

const VIEWS: { id: View; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "lets_play", label: "Let's play" },
  { id: "crushes", label: "Crushes" },
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
  crushes: {
    status: "prospect",
    intro: "Who you'd like to know. Notes are what bandmates have picked up, not checked facts.",
    empty: "No crushes yet. Mark a connection Crush when you'd like to reach out.",
  },
};

function viewHref(view: View) {
  return view === "current" ? "/" : `/?view=${view}`;
}

// The query string the results reload for: everything but layout and paging.
function resultsQuery(params: Record<string, string | string[] | undefined>) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "layout" || key === "after" || value === undefined) continue;
    (Array.isArray(value) ? value : [value]).forEach((v) => p.append(key, v));
  }
  return p.toString();
}

function readAfter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return readCursor(JSON.parse(raw));
  } catch {
    return null;
  }
}

// The same directory URL with a different layout.
function withLayout(params: Record<string, string | string[] | undefined>, layout: DirectoryLayout) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "layout" || key === "after" || value === undefined) continue;
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
      className="bar-search"
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
              <SearchClear inputId="f-q" />
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

function AddConnection({ className }: { className: string }) {
  return (
    <Link href="/connections/new" className={`button-primary ${className}`}>
      <Add size={16} aria-hidden="true" />
      Add Connection
    </Link>
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
