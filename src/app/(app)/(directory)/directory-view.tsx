import { noAutofill } from "@/lib/no-autofill";
import Link from "next/link";
import { Combobox } from "@/components/combobox";
import { AutoFilterForm, FilterDisclosure } from "@/components/filter-form";
import {
  Add,
  Bar,
  Events,
  Building,
  Incomplete,
  EventsAlt,
  LocationStar,
  Music,
  Network_1,
  Person,
  Recording,
  Search as SearchIcon,
  Store,
  Tag,
  type CarbonIconType,
} from "@carbon/icons-react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { DirectoryResults } from "@/components/directory-results";
import { LayoutProvider, LayoutToggle } from "@/components/layout-toggle";
import { PinWatch } from "@/components/pin-watch";
import { SearchClear } from "@/components/search-clear";
import { TypeMenu } from "@/components/type-menu";
import { LAYOUT_COOKIE, readLayout, type DirectoryLayout } from "@/lib/connections/card";
import { wordSetForTab } from "@/lib/connections/tabs";
import { AGES, CAPACITY, VENUE_TYPES, type VenueType } from "@/lib/connections/venue-details";
import { getMembership, isModerator } from "@/lib/auth/dal";
import {
  DEFAULT_TAB,
  TABS,
  loadDirectoryPage,
  readCursor,
  readDirectoryQuery,
  type Tab,
  type TabCounts,
} from "@/lib/connections/directory";
import { NO_STATUS, STATUSES, STATUS_WORDS, formatLocality } from "@/lib/connections/labels";
import { NoWorkspace } from "@/components/no-workspace";
import { todayISO } from "@/lib/outreach/labels";
import { nestScenes } from "@/lib/scenes/queries";
import { MISSING, hasFilters, missingFor, type DirectoryFilters } from "@/lib/connections/filters";
import { INSTRUMENTS, type Instrument } from "@/lib/affiliations/instruments";
import { countDuplicates } from "@/lib/connections/merge";
import { PageLoader } from "@/components/metronome";

type Params = Record<string, string | string[] | undefined>;

// The Directory (#273): every record the band can see, its own and what
// every other band shares, Avoid last. The archived view is this band's
// own. Home (/) is the band's own page.
export function DirectoryView({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    // The quick view checks for this: no directory under it, no panel.
    <div data-directory className="contents">
      <Suspense fallback={<PageLoader label="loading directory" />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Directory({ searchParams }: { searchParams: Promise<Params> }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const today = todayISO(new Date(), membership.timeZone);

  const [params, cookieStore, headerList] = await Promise.all([searchParams, cookies(), headers()]);
  // Cards or list: the URL wins (shared links), then this device's last
  // choice, then list on phones (cards are cramped there) and cards elsewhere.
  const layout: DirectoryLayout =
    readLayout(params.layout) ??
    readLayout(cookieStore.get(LAYOUT_COOKIE)?.value) ??
    (isPhone(headerList) ? "list" : "cards");
  const base = "/directory";
  const layoutHrefs = {
    list: withLayout(base, params, "list"),
    cards: withLayout(base, params, "cards"),
  };
  const read = readDirectoryQuery(params);
  const tab = read.tab;
  // Missing (#321): moderators and admins only.
  const moderator = await isModerator();
  // Archived is this band's own.
  const filters: DirectoryFilters = {
    ...read.filters,
    scope: read.filters.archived ? "network" : "all",
    missing: moderator ? read.filters.missing : "",
  };
  // An old ?scope=all link: Everyone is the default now.
  if (params.scope !== undefined) redirect(directoryHref(tab, filters));
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
  const towns = c.towns.map((t) => [t.id, formatLocality(t)!] as const).sort((x, y) => x[1].localeCompare(y[1]));
  // The results' state resets whenever the filters change.
  const query = resultsQuery(params);
  const filtersOpen = Boolean(
    filters.statuses.length ||
    filters.scene ||
    filters.town ||
    filters.instrument ||
    filters.ages ||
    filters.capacity ||
    filters.space ||
    filters.missing,
  );

  return (
    // key: a server render with a different layout (a shared link) resets it.
    <LayoutProvider key={layout} initial={layout}>
      <div className="flex flex-col gap-6">
        <h1 className="sr-only">Directory</h1>

        {/* Every directory control in one bar, pinned while the list scrolls.
            Phones pin only the search row. */}
        <PinWatch selector=".directory-bar, .bar-search" />
        {/* DOM order is reading and tab order: type tabs, search and filters,
            then Add. Smaller screens put a short Add in the search row. */}
        <div className="directory-bar">
          <TypeTabs tab={tab} counts={c.types} filters={filters} />

          {c.view || archived ? (
            <FilterForm
              tab={tab}
              filters={filters}
              scenes={nestScenes(scenes)}
              towns={towns}
              instruments={c.instruments}
              showMissing={moderator}
              open={filtersOpen}
              layoutToggle={<LayoutToggle hrefs={layoutHrefs} />}
              clearHref={filtering ? directoryHref(tab, { ...EMPTY, archived }) : null}
              showLabel={
                c.matched === 0 ? "Show Results" : `Show ${c.matched} ${c.matched === 1 ? current.one : current.many}`
              }
              sheetExtra={
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted">Show as</span>
                    <LayoutToggle hrefs={layoutHrefs} segmented />
                  </div>
                  {!archived && c.archived ? (
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {!archived && c.archived ? (
                        <Link href={directoryHref(tab, { ...EMPTY, archived: true })} className="link">
                          {c.archived} archived
                        </Link>
                      ) : null}
                    </p>
                  ) : null}
                </>
              }
              add={<AddConnection tab={tab} className="md:hidden" short />}
            />
          ) : null}

          <AddConnection tab={tab} className="bar-add max-md:hidden" />
        </div>

        {c.view === 0 ? (
          archived ? (
            <p className="text-sm text-muted">
              Nothing archived.{" "}
              <Link href={directoryHref(tab, EMPTY)} className="link">
                Back to the Directory
              </Link>
            </p>
          ) : (
            <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
              <p className="font-medium">No listings yet.</p>
              <p className="text-muted">
                Start with a band you&rsquo;ve shared a bill with, a venue you&rsquo;ve played, or someone you&rsquo;d
                like to meet.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/add" className="button-secondary">
                  Add Your First Listing
                </Link>
                <Link href="/import" className="button-secondary">
                  Import a Spreadsheet
                </Link>
              </div>
              {c.archived ? (
                <Link href={directoryHref(tab, { ...EMPTY, archived: true })} className="link text-sm">
                  {c.archived} archived
                </Link>
              ) : null}
            </div>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted" aria-live="polite">
              {/* The archived view says so first, with the way back (Archived
                  lives here, not in the filter bar: it's a different half). */}
              {archived ? <p className="font-medium text-primary">Archived</p> : null}
              {/* From an import's done screen (#321); Clear Filters goes back to everyone. */}
              {filters.import ? <p className="font-medium text-primary">From Your Import</p> : null}
              <p>
                {/* How many match, never how many are loaded (that's under the list). */}
                {filtering
                  ? `${c.matched} of ${c.total} match`
                  : `${c.matched} ${c.matched === 1 ? current.one : current.many}`}
              </p>
              {filtering ? (
                <Link href={directoryHref(tab, { ...EMPTY, archived })} className="link">
                  Clear Filters
                </Link>
              ) : null}
              {after ? (
                <Link href={directoryHref(tab, filters)} className="link">
                  Back to the Start
                </Link>
              ) : null}
              {archived ? (
                <Link href={directoryHref(tab, EMPTY)} className="link">
                  Back to the Directory
                </Link>
              ) : c.archived ? (
                <Link href={directoryHref(tab, { ...EMPTY, archived: true })} className="link max-sm:hidden">
                  {c.archived} archived
                </Link>
              ) : null}
              {archived ? null : (
                <Suspense fallback={null}>
                  <DuplicatesLink />
                </Suspense>
              )}
            </div>

            {c.matched === 0 && filtering ? (
              <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
                <p className="font-medium">Nothing matches.</p>
                <p className="text-muted">Try fewer filters or a shorter search.</p>
                <Link href={directoryHref(tab, { ...EMPTY, archived })} className="button-secondary">
                  Clear Filters
                </Link>
              </div>
            ) : c.matched === 0 ? (
              <p className="text-muted">{archived ? `No archived ${current.many}.` : `No ${current.many} yet.`}</p>
            ) : null}

            <DirectoryResults
              key={`${query}|${after ? JSON.stringify(after) : ""}`}
              initialItems={items}
              initialNext={next}
              groups={c.groups}
              matched={c.matched}
              query={query}
              basePath={base}
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
            {" · "}
            <Link href="/import" className="action-link text-sm">
              Import a spreadsheet
            </Link>
          </p>
        ) : null}
      </div>
    </LayoutProvider>
  );
}

const EMPTY: DirectoryFilters = {
  q: "",
  statuses: [],
  scene: "",
  town: "",
  instrument: "",
  ages: "",
  capacity: "",
  space: "",
  archived: false,
  noStatus: false,
  scope: "all",
  missing: "",
  import: "",
};

// One tab per kind of connection (#122), each with its count under the
// other filters. Phones show Bands, People, and a third tab (Venues, or the
// current one when it's Labels & more or All); the rest go behind ⋮.
function TypeTabs({ tab, counts, filters }: { tab: Tab; counts: TabCounts; filters: DirectoryFilters }) {
  const third: Tab = tab === "more" || tab === "all" ? tab : "venues";
  const overflow = TABS.filter((t) => !["bands", "people", third].includes(t.id));
  return (
    <nav aria-label="Listing types" className="segmented bar-views type-tabs">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={directoryHref(t.id, filters)}
          aria-current={t.id === tab ? "page" : undefined}
          className={overflow.includes(t) ? "type-tab-overflow" : undefined}
        >
          {TAB_ICONS[t.id]}
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
        items={overflow.map((t) => ({
          href: directoryHref(t.id, filters),
          label: t.label,
          count: counts[t.id],
          icon: TAB_ICONS[t.id],
        }))}
      />
    </nav>
  );
}

// An icon per type, so the tabs don't run together as one line of mono
// text. All is everything, so it has none. Decorative: the words are read.
const icon = (Icon: CarbonIconType) => <Icon size={16} aria-hidden="true" className="type-tab-icon" />;
const TAB_ICONS: Record<Tab, React.ReactNode> = {
  bands: icon(Events),
  people: icon(Person),
  venues: icon(Store),
  more: icon(Recording),
  all: null,
};

// The directory URL for a tab and filters. Bands is the default tab.
function directoryHref(tab: Tab, f: DirectoryFilters) {
  const p = new URLSearchParams();
  if (tab !== DEFAULT_TAB) p.set("type", tab);
  if (f.q) p.set("q", f.q);
  f.statuses.forEach((st) => p.append("status", st));
  if (f.noStatus) p.set("status", "none");
  if (f.scene) p.set("scene", f.scene);
  if (f.town) p.set("town", f.town);
  // Plays only means something where there are people.
  if (f.instrument && (tab === "people" || tab === "all")) p.set("plays", f.instrument);
  // Ages and capacity are venue details (#48).
  if (tab === "venues" && f.ages) p.set("ages", f.ages);
  if (tab === "venues" && f.capacity) p.set("cap", f.capacity);
  if (tab === "venues" && f.space) p.set("space", f.space);
  // Only what fits the tab: no Bandcamp on People.
  if (f.missing && missingFor(tab).includes(f.missing)) p.set("missing", f.missing);
  if (f.import) p.set("import", f.import);
  if (f.archived) p.set("archived", "1");
  const qs = p.toString();
  return qs ? `/directory?${qs}` : "/directory";
}

// The query string the results reload for: everything but layout and paging.
function resultsQuery(params: Params) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "layout" || key === "after" || key === "scope" || value === undefined) continue;
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
// The browser says so (Chromium), or its user agent does (Safari, Firefox).
// Tablets get cards: there's room.
function isPhone(h: Headers) {
  if (h.get("sec-ch-ua-mobile") === "?1") return true;
  return /\b(iPhone|iPod)\b|Android.+Mobile|Mobile.+Firefox|\bMobi\b/.test(h.get("user-agent") ?? "");
}

function withLayout(base: string, params: Params, layout: DirectoryLayout) {
  const p = new URLSearchParams(resultsQuery(params));
  p.set("layout", layout);
  return `${base}?${p.toString()}`;
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
  showMissing,
  open,
  layoutToggle,
  add,
  clearHref,
  showLabel,
  sheetExtra,
}: {
  tab: Tab;
  filters: DirectoryFilters;
  scenes: {
    scene: { id: string; name: string };
    children: { id: string; name: string }[];
  }[];
  towns: (readonly [string, string])[];
  instruments: Instrument[];
  /** Missing (#321): moderators and admins. */
  showMissing: boolean;
  open: boolean;
  layoutToggle: React.ReactNode;
  add: React.ReactNode;
  clearHref: string | null;
  showLabel: string;
  sheetExtra: React.ReactNode;
}) {
  // Plays (#140) is for people: on People and All, and only if anyone plays something.
  const showPlays = (tab === "people" || tab === "all") && (instruments.length > 0 || Boolean(f.instrument));
  const active = [
    f.statuses.length,
    f.scene,
    f.town,
    showPlays && f.instrument,
    f.ages,
    f.capacity,
    f.space,
    showMissing && f.missing,
  ].filter(Boolean).length;
  return (
    <AutoFilterForm
      action="/directory"
      role="search"
      aria-label="Search and filter the directory"
      className="bar-search"
    >
      {tab !== DEFAULT_TAB ? <input type="hidden" name="type" value={tab} /> : null}
      {/* The archived view keeps its half while you search and filter. */}
      {f.archived ? <input type="hidden" name="archived" value="1" /> : null}
      {/* An import's listings (#321) stay put while you search and filter them. */}
      {f.import ? <input type="hidden" name="import" value={f.import} /> : null}
      <FilterDisclosure
        initialOpen={open}
        active={active}
        clearHref={clearHref}
        showLabel={showLabel}
        sheetExtra={sheetExtra}
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
              <input
                {...noAutofill}
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
        <div className={tab === "venues" ? "filter-fields filter-fields-venues" : "filter-fields"}>
          {/* Status replaces the old views: everyone, or one status. */}
          <label htmlFor="f-status" className="sr-only">
            Status
          </label>
          {/* Each filter keeps an icon, so it still says what it filters
              once a value replaces its placeholder. */}
          <span className="field-icon filter-status">
            <Tag size={16} aria-hidden="true" />
            <select
              id="f-status"
              name="status"
              className="field"
              defaultValue={f.noStatus ? "none" : f.statuses.length === 1 ? f.statuses[0] : ""}
            >
              {/* Everyone, Avoid last (#273). */}
              <option value="">Everyone</option>
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {STATUS_WORDS[wordSetForTab(tab)][st]}
                </option>
              ))}
              {/* Not sorted yet (#192). */}
              <option value="none">{NO_STATUS}</option>
            </select>
          </span>
          <Combobox
            label="Scene"
            icon={<Network_1 size={16} />}
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
              ...children.map((c) => ({
                value: c.id,
                label: c.name,
                depth: 1,
              })),
            ])}
            defaultValue={f.scene ? [f.scene] : []}
            autoSubmit
          />
          <Combobox
            label="Town"
            icon={<LocationStar size={16} />}
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
              icon={<Music size={16} />}
              labelClassName="sr-only"
              name="plays"
              multiple={false}
              placeholder="Plays"
              options={instruments.map((i) => ({
                value: i,
                label: INSTRUMENTS[i],
              }))}
              defaultValue={f.instrument ? [f.instrument] : []}
              autoSubmit
            />
          ) : null}
          {/* Venue details (#48). */}
          {tab === "venues" ? (
            <>
              <Combobox
                label="Ages"
                icon={<Bar size={16} />}
                labelClassName="sr-only"
                name="ages"
                multiple={false}
                placeholder="Ages"
                options={Object.entries(AGES).map(([value, label]) => ({
                  value,
                  label,
                }))}
                defaultValue={f.ages ? [f.ages] : []}
                autoSubmit
              />
              <Combobox
                label="Capacity"
                icon={<EventsAlt size={16} />}
                labelClassName="sr-only"
                name="cap"
                multiple={false}
                placeholder="Size"
                options={Object.entries(CAPACITY).map(([value, label]) => ({
                  value,
                  label,
                }))}
                defaultValue={f.capacity ? [f.capacity] : []}
                autoSubmit
              />
              {/* Space (#262): DIY, licensed, or one kind of room. */}
              <Combobox
                label="Space"
                icon={<Building size={16} />}
                labelClassName="sr-only"
                name="space"
                multiple={false}
                placeholder="Space"
                options={[
                  { value: "diy", label: "Any DIY" },
                  { value: "licensed", label: "Any licensed" },
                  ...(Object.keys(VENUE_TYPES) as VenueType[]).map((t) => ({ value: t, label: VENUE_TYPES[t].label })),
                ]}
                defaultValue={f.space ? [f.space] : []}
                autoSubmit
              />
            </>
          ) : null}
          {/* Missing (#321): find gaps to fill in, for moderators and admins. */}
          {showMissing ? (
            <Combobox
              label="Missing"
              icon={<Incomplete size={16} />}
              labelClassName="sr-only"
              name="missing"
              multiple={false}
              placeholder="Missing"
              options={missingFor(tab).map((value) => ({
                value,
                label: MISSING[value],
              }))}
              defaultValue={f.missing ? [f.missing] : []}
              autoSubmit
            />
          ) : null}
        </div>
      </FilterDisclosure>
    </AutoFilterForm>
  );
}

// Add, named for the tab and opening the form with its type set.
// Short in the search row on smaller screens: "+ Add", still named in full
// for screen readers and as a tooltip.
function AddConnection({ tab, className, short = false }: { tab: Tab; className: string; short?: boolean }) {
  const t = TABS.find((x) => x.id === tab)!;
  const href = t.addType ? `/add?type=${t.addType}` : "/add";
  return (
    <Link
      href={href}
      className={`button-primary ${className}`}
      aria-label={short ? t.add : undefined}
      title={short ? t.add : undefined}
    >
      <Add size={16} aria-hidden="true" />
      {short ? "Add" : t.add}
    </Link>
  );
}

// "2 possible duplicates" (#169), across the whole directory. Loads on its
// own so the list doesn't wait for it.
async function DuplicatesLink() {
  const n = await countDuplicates();
  if (!n) return null;
  return (
    <Link href="/duplicates" className="link">
      {n} possible {n === 1 ? "duplicate" : "duplicates"}
    </Link>
  );
}
