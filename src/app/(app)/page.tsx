import { noAutofill } from "@/lib/no-autofill";
import Link from "next/link";
import { Combobox } from "@/components/combobox";
import { AutoFilterForm, FilterDisclosure } from "@/components/filter-form";
import { Add, Search as SearchIcon } from "@carbon/icons-react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DirectoryResults } from "@/components/directory-results";
import { LayoutProvider, LayoutToggle } from "@/components/layout-toggle";
import { PinWatch } from "@/components/pin-watch";
import { SearchClear } from "@/components/search-clear";
import { TypeMenu } from "@/components/type-menu";
import { LAYOUT_COOKIE, readLayout, type DirectoryLayout } from "@/lib/connections/card";
import { wordSetForTab } from "@/lib/connections/tabs";
import { getMembership } from "@/lib/auth/dal";
import {
  DEFAULT_TAB,
  TABS,
  loadDirectoryPage,
  readCursor,
  readDirectoryQuery,
  type Tab,
  type TabCounts,
} from "@/lib/connections/directory";
import { STATUSES, STATUS_WORDS, formatLocality } from "@/lib/connections/labels";
import { NoWorkspace } from "@/components/no-workspace";
import { todayISO } from "@/lib/outreach/labels";
import { nestScenes } from "@/lib/scenes/queries";
import { hasFilters, type DirectoryFilters } from "@/lib/connections/filters";
import { INSTRUMENTS, type Instrument } from "@/lib/affiliations/instruments";

export default function DirectoryPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the directory…</p>}>
      <Directory searchParams={searchParams} />
    </Suspense>
  );
}

type Params = Record<string, string | string[] | undefined>;

async function Directory({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const today = todayISO(new Date(), membership.timeZone);

  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  // Cards or list: the URL wins (shared links), then this device's last choice.
  const layout: DirectoryLayout =
    readLayout(params.layout) ?? readLayout(cookieStore.get(LAYOUT_COOKIE)?.value) ?? "cards";
  const layoutHrefs = {
    list: withLayout(params, "list"),
    cards: withLayout(params, "cards"),
  };
  const { tab, filters } = readDirectoryQuery(params);
  // Old links (?view=lets_play, ?type=group:venue) go to their tab and status.
  if (params.view !== undefined || (typeof params.type === "string" && params.type.includes(":"))) {
    redirect(directoryHref(tab, filters));
  }
  const current = TABS.find((t) => t.id === tab)!;
  const archived = filters.archived;
  const filtering = hasFilters(filters);
  // No-script "Show More" lands here with ?after=…; with script it loads in place.
  const after = readAfter(params.after);
  const { items, next, counts, scenes } = await loadDirectoryPage({ tab, filters }, { after });
  const c = counts!;
  const towns = c.towns
    .map((t) => [t.id, formatLocality(t)!] as const)
    .sort((x, y) => x[1].localeCompare(y[1]));
  // The results' state resets whenever the filters change.
  const query = resultsQuery(params);
  const filtersOpen = Boolean(filters.statuses.length || filters.scene || filters.town || filters.instrument);

  return (
    // key: a server render with a different layout (a shared link) resets it.
    <LayoutProvider key={layout} initial={layout}>
      <div className="flex flex-col gap-6">
        <h1 className="sr-only">Directory</h1>

        {/* Every directory control in one bar, pinned while the list scrolls.
            Phones pin only the search row. */}
        <PinWatch selector=".directory-bar, .bar-search" />
        {/* DOM order is reading and tab order: type tabs, search and filters,
            then Add. Phones put Add in the search row as an icon. */}
        <div className="directory-bar">
          <TypeTabs tab={tab} counts={c.types} filters={filters} />

          {c.view || archived ? (
            <FilterForm
              tab={tab}
              filters={filters}
              scenes={nestScenes(scenes)}
              towns={towns}
              instruments={c.instruments}
              open={filtersOpen}
              layoutToggle={<LayoutToggle hrefs={layoutHrefs} />}
              add={<AddConnection tab={tab} className="button-icon md:hidden" iconOnly />}
            />
          ) : null}

          <AddConnection tab={tab} className="bar-add max-md:hidden" />
        </div>

        {c.view === 0 ? (
          archived ? (
            <p className="text-sm text-muted">
              Nothing archived.{" "}
              <Link href={directoryHref(tab, EMPTY)} className="link">
                Back to the directory
              </Link>
            </p>
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
              {c.archived ? (
                <Link href={directoryHref(tab, { ...EMPTY, archived: true })} className="link text-sm">
                  {c.archived} archived
                </Link>
              ) : null}
            </div>
          )
        ) : (
          <>
            <div
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted"
              aria-live="polite"
            >
              {/* The archived view says so first, with the way back (Archived
                  lives here, not in the filter bar: it's a different half). */}
              {archived ? <p className="font-medium text-primary">Archived</p> : null}
              <p>
                {/* How many match, never how many are loaded (that's under the list). */}
                {filtering
                  ? `${c.matched} of ${c.total} match`
                  : `${c.matched} ${c.matched === 1 ? current.one : current.many}`}
              </p>
              {c.hiddenAvoid ? (
                <Link href={directoryHref(tab, { ...filters, statuses: ["avoid"] })} className="link">
                  {c.hiddenAvoid} in Avoid, hidden. Show them
                </Link>
              ) : null}
              {filtering ? (
                <Link href={directoryHref(tab, { ...EMPTY, archived })} className="link">
                  Clear filters
                </Link>
              ) : null}
              {after ? (
                <Link href={query ? `/?${query}` : "/"} className="link">
                  Back to the start
                </Link>
              ) : null}
              {archived ? (
                <Link href={directoryHref(tab, EMPTY)} className="link">
                  Back to the directory
                </Link>
              ) : c.archived ? (
                <Link href={directoryHref(tab, { ...EMPTY, archived: true })} className="link">
                  {c.archived} archived
                </Link>
              ) : null}
            </div>

            {c.matched === 0 && filtering ? (
              <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
                <p className="font-medium">Nothing matches.</p>
                <p className="text-muted">
                  Try fewer filters or a shorter search.
                </p>
                <Link href={directoryHref(tab, { ...EMPTY, archived })} className="button-secondary">
                  Clear Filters
                </Link>
              </div>
            ) : c.matched === 0 ? (
              <p className="text-muted">
                {archived ? `No archived ${current.many}.` : `No ${current.many} yet.`}
              </p>
            ) : null}

            <DirectoryResults
              key={`${query}|${after ? JSON.stringify(after) : ""}`}
              initialItems={items}
              initialNext={next}
              groups={c.groups}
              matched={c.matched}
              query={query}
              today={today}
              tab={tab}
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

const EMPTY: DirectoryFilters = { q: "", statuses: [], scene: "", town: "", instrument: "", archived: false };

// One tab per kind of connection (#122), each with its count under the
// other filters. Phones show Bands, People, and a third tab (Venues, or the
// current one when it's Labels & more or All); the rest go behind ⋮.
function TypeTabs({ tab, counts, filters }: { tab: Tab; counts: TabCounts; filters: DirectoryFilters }) {
  const third: Tab = tab === "more" || tab === "all" ? tab : "venues";
  const overflow = TABS.filter((t) => !["bands", "people", third].includes(t.id));
  return (
    <nav aria-label="Connection types" className="segmented bar-views type-tabs">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={directoryHref(t.id, filters)}
          aria-current={t.id === tab ? "page" : undefined}
          className={overflow.includes(t) ? "type-tab-overflow" : undefined}
        >
          <span>
            {t.id === "more" ? (
              <>
                Labels<span className="tab-long"> &amp; more</span>
              </>
            ) : (
              t.label
            )}
          </span>
          <span className="tabular-nums">{counts[t.id]}</span>
        </Link>
      ))}
      <TypeMenu
        key={tab}
        items={overflow.map((t) => ({ href: directoryHref(t.id, filters), label: t.label, count: counts[t.id] }))}
      />
    </nav>
  );
}

// The directory URL for a tab and filters. Bands is the default tab.
function directoryHref(tab: Tab, f: DirectoryFilters) {
  const p = new URLSearchParams();
  if (tab !== DEFAULT_TAB) p.set("type", tab);
  if (f.q) p.set("q", f.q);
  f.statuses.forEach((st) => p.append("status", st));
  if (f.scene) p.set("scene", f.scene);
  if (f.town) p.set("town", f.town);
  // Plays only means something where there are people.
  if (f.instrument && (tab === "people" || tab === "all")) p.set("plays", f.instrument);
  if (f.archived) p.set("archived", "1");
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

// The query string the results reload for: everything but layout and paging.
function resultsQuery(params: Params) {
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
function withLayout(params: Params, layout: DirectoryLayout) {
  const p = new URLSearchParams(resultsQuery(params));
  p.set("layout", layout);
  return `/?${p.toString()}`;
}

// A plain GET form: works without JavaScript, and the URL is shareable.
// From 1280px the filter fields sit in the bar beside search (Figma
// Directory Bar); narrower, Filters opens them under it.
function FilterForm({
  tab,
  filters: f,
  scenes,
  towns,
  instruments,
  open,
  layoutToggle,
  add,
}: {
  tab: Tab;
  filters: DirectoryFilters;
  scenes: {
    scene: { id: string; name: string };
    children: { id: string; name: string }[];
  }[];
  towns: (readonly [string, string])[];
  instruments: Instrument[];
  open: boolean;
  layoutToggle: React.ReactNode;
  add: React.ReactNode;
}) {
  // Plays (#140) is for people: on People and All, and only if anyone plays something.
  const showPlays = (tab === "people" || tab === "all") && (instruments.length > 0 || Boolean(f.instrument));
  const active = [f.statuses.length, f.scene, f.town, showPlays && f.instrument].filter(Boolean).length;
  return (
    <AutoFilterForm
      role="search"
      aria-label="Search and filter the directory"
      className="bar-search"
    >
      {tab !== DEFAULT_TAB ? <input type="hidden" name="type" value={tab} /> : null}
      {/* The archived view keeps its half while you search and filter. */}
      {f.archived ? <input type="hidden" name="archived" value="1" /> : null}
      <FilterDisclosure
        initialOpen={open}
        active={active}
        after={
          <>
            {layoutToggle}
            {add}
          </>
        }
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
        <div className="filter-fields">
          {/* Status replaces the old views: everyone but Avoid, or one status. */}
          <label htmlFor="f-status" className="sr-only">
            Status
          </label>
          <select
            id="f-status"
            name="status"
            className="field filter-status"
            defaultValue={f.statuses.length === 1 ? f.statuses[0] : ""}
          >
            {/* Archived ones keep Avoid in view (nothing's hidden there). */}
            <option value="">{f.archived ? "Everyone" : "Everyone but Avoid"}</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_WORDS[wordSetForTab(tab)][st]}
              </option>
            ))}
          </select>
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
          {showPlays ? (
            <Combobox
              label="Plays"
              labelClassName="sr-only"
              name="plays"
              multiple={false}
              placeholder="Plays"
              options={instruments.map((i) => ({ value: i, label: INSTRUMENTS[i] }))}
              defaultValue={f.instrument ? [f.instrument] : []}
              autoSubmit
            />
          ) : null}
        </div>
      </FilterDisclosure>
    </AutoFilterForm>
  );
}

// Add, named for the tab and opening the form with its type set.
function AddConnection({ tab, className, iconOnly = false }: { tab: Tab; className: string; iconOnly?: boolean }) {
  const t = TABS.find((x) => x.id === tab)!;
  const href = t.addType ? `/connections/new?type=${t.addType}` : "/connections/new";
  return (
    <Link
      href={href}
      className={`button-primary ${className}`}
      aria-label={iconOnly ? t.add : undefined}
      title={iconOnly ? t.add : undefined}
    >
      <Add size={16} aria-hidden="true" />
      {iconOnly ? null : t.add}
    </Link>
  );
}
