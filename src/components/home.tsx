import Link from "next/link";
import { getMembership, getUsConnection } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { layerOf } from "@/lib/connections/band-details";
import { initials } from "@/lib/connections/card";
import { loadDirectoryPage, readDirectoryQuery, type DirectoryItem } from "@/lib/connections/directory";
import { formatLocality, formatType, STATUS_WORDS } from "@/lib/connections/labels";
import { formatDay, todayISO } from "@/lib/outreach/labels";
import { photoUrl } from "@/lib/photos/urls";
import { Photo } from "@/components/photo";
import { SuggestedBands } from "@/components/suggested-bands";
import { gettingStartedShows } from "@/components/getting-started";

// Home (#273): your band's own page, pointing into the Directory rather than
// copying it. Each section loads on its own and steps aside when it has
// nothing to show, so a new band sees mostly Getting Started.

type Place = {
  name: string;
  region: string | null;
  region_code: string | null;
  country: string | null;
  country_code: string | null;
} | null;

/** A small print: the photo, or initials on photo paper. */
function Print({ name, path, size }: { name: string; path: string | null; size: "s" | "m" }) {
  const src = photoUrl(path, size === "s" ? 160 : 320);
  return (
    <span className={`home-print home-print-${size}`} aria-hidden="true">
      <span className="card-print-initials">{initials(name)}</span>
      {src ? <Photo src={src} alt="" decoding="async" /> : null}
    </span>
  );
}

// The band profile's header (#273), as the top of Home: photo, name, what
// and where, scenes, and the way to the band's own page.
export async function HomeHeader() {
  const membership = await getMembership();
  if (!membership) return null;
  const [us, supabase] = await Promise.all([getUsConnection(), createClient()]);
  const [{ data: listing }, { count: members }] = await Promise.all([
    us
      ? supabase
          .from("connections")
          .select(
            "name, kind, group_type, person_roles, localities ( name, region, region_code, country, country_code ), connection_scenes ( scenes ( id, name ) )",
          )
          .eq("id", us.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("workspace_members")
      .select("user_id", { count: "exact", head: true })
      .eq("workspace_id", membership.workspaceId),
  ]);
  const scenes = (listing?.connection_scenes ?? []).flatMap((cs) => (cs.scenes ? [cs.scenes] : []));
  const town = formatLocality(listing?.localities as Place);
  const first = membership.displayName?.trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: membership.timeZone,
  }).format(new Date());

  return (
    <header className="flex items-start gap-4">
      <Print name={membership.workspaceName} path={us?.photoPath ?? null} size="m" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h1 className="min-w-0 display-l break-words sm:display-xl">{membership.workspaceName}</h1>
          <p className="text-sm text-muted">
            {first ? `Hi, ${first} · ` : ""}
            {today}
          </p>
        </div>
        <p className="text-muted">
          {[
            listing ? formatType(listing) : "Band",
            town,
            members ? `${members} ${members === 1 ? "member" : "members"}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {scenes.length ? (
          <p className="text-sm">
            <span className="text-muted">Scenes: </span>
            {scenes.map((s, i) => (
              <span key={s.id}>
                {i ? ", " : ""}
                <Link href={`/directory?scene=${s.id}`} className="link">
                  {s.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3 pt-1">
          {/* A full page load, like the account menu's link to it. */}
          <a href={us ? `/connections/${us.id}` : "/add?us=1"} className="button-secondary">
            {us ? "Your Band’s Page" : "Add Your Band’s Page"}
          </a>
          <Link href="/band" className="button-secondary">
            Band Settings
          </Link>
        </div>
      </div>
    </header>
  );
}

// Up Next: the band's open follow-ups (folded in from Follow-ups), soonest
// first. Dates are plans, not deadlines: no overdue warnings.
export async function UpNext() {
  const membership = await getMembership();
  if (!membership) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("next_actions")
    .select(
      "id, description, due_on, connection:connections!next_actions_connection_id_fkey ( id, name, kind, group_type, person_roles, photo_path, localities ( name, region, region_code, country, country_code ), band:connection_band_details ( archived_at ) )",
    )
    .eq("workspace_id", membership.workspaceId)
    .eq("status", "open")
    .eq("connection.band.workspace_id", membership.workspaceId)
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(20);
  const open = (data ?? []).filter((a) => a.connection && !layerOf(a.connection.band)?.archived_at);
  if (!open.length) return null;
  const today = todayISO(new Date(), membership.timeZone);
  const shown = open.slice(0, 5);

  return (
    <section aria-labelledby="home-next" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="home-next" className="display-s">
          Up Next
        </h2>
        <Link href="/follow-ups" className="link text-sm">
          {open.length > shown.length ? `All ${open.length} follow-ups` : "All follow-ups"}
        </Link>
      </div>
      <ul className="window home-list">
        {shown.map((a) => {
          const c = a.connection!;
          return (
            <li key={a.id}>
              <Link href={`/connections/${c.id}`} className="home-row">
                <Print name={c.name} path={c.photo_path} size="s" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg leading-tight font-bold">{c.name}</span>
                  <span className="caption block truncate">
                    {[formatType(c), formatLocality(c.localities as Place)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="home-row-action">
                  {a.description}
                  {a.due_on ? <span className="caption block">planned for {formatDay(a.due_on, today)}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// A row of prints for one status, linking into the Directory filtered to it.
export async function StatusShelf({ status }: { status: "homies" | "lets_play" | "prospect" }) {
  const membership = await getMembership();
  if (!membership) return null;
  const { items, counts } = await loadDirectoryPage(readDirectoryQuery({ type: "all", status }));
  const shown = items.filter((c: DirectoryItem) => c.status === status).slice(0, 12);
  if (!shown.length) return null;
  const total = counts?.matched ?? shown.length;
  const id = `home-${status}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={id} className="display-s flex items-center gap-2">
          <span className={`tag tag-${status}`}>{STATUS_WORDS.band[status]}</span>
          <span className="text-muted">({total})</span>
        </h2>
        <Link href={`/directory?type=all&status=${status}`} className="link text-sm">
          {total > shown.length ? `All ${total} in the Directory` : "See them in the Directory"}
        </Link>
      </div>
      <ul className="home-shelf">
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/connections/${c.id}`} className="home-shelf-item">
              <Print name={c.name} path={c.photo_path} size="m" />
              <span className="block truncate text-sm font-medium">{c.name}</span>
              <span className="caption block truncate">{formatLocality(c.localities) ?? formatType(c)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// What other bands added lately that this band hasn't touched yet, nearest
// first: listings in towns the band already knows, then the rest.
export async function NewOnSeeens() {
  const membership = await getMembership();
  if (!membership) return null;
  const ws = membership.workspaceId;
  const [supabase, us] = await Promise.all([createClient(), getUsConnection()]);
  const [{ data: towns }, { data: home }, { data: recent }] = await Promise.all([
    supabase.from("localities").select("place_id").eq("workspace_id", ws).not("place_id", "is", null),
    // Our own town counts even before we've added anything (a band that just
    // claimed its listing).
    us
      ? supabase.from("connections").select("localities ( place_id )").eq("id", us.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("connections")
      .select(
        "id, name, kind, group_type, person_roles, photo_path, is_us, created_at, added_by:workspaces!connections_workspace_id_fkey ( name ), localities ( name, region, region_code, country, country_code, place_id ), band:connection_band_details ( status, played_together, notes, archived_at )",
      )
      .neq("workspace_id", ws)
      .eq("band.workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  const known = new Set((towns ?? []).map((t) => t.place_id));
  if (home?.localities?.place_id) known.add(home.localities.place_id);
  const untouched = (recent ?? []).filter((c) => {
    // Not our own listing (a claimed one lives with the band that added it).
    if (c.id === us?.id) return false;
    const b = layerOf(c.band);
    return !b || !(b.status || b.played_together || b.notes || b.archived_at);
  });
  const near = untouched.filter((c) => c.localities?.place_id && known.has(c.localities.place_id));
  const shown = [...near, ...untouched.filter((c) => !near.includes(c))].slice(0, 5);
  if (!shown.length) return null;

  return (
    <section aria-labelledby="home-new" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="home-new" className="display-s">
          {near.length ? "New Near You" : "New on Seeens"}
        </h2>
        <Link href="/directory?type=all" className="link text-sm">
          Everyone in the Directory
        </Link>
      </div>
      <ul className="window home-list">
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/connections/${c.id}`} className="home-row">
              <Print name={c.name} path={c.photo_path} size="s" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg leading-tight font-bold">{c.name}</span>
                <span className="caption block truncate">
                  {[formatType(c), formatLocality(c.localities as Place)].filter(Boolean).join(" · ")}
                </span>
              </span>
              {c.is_us ? (
                <span className="home-row-action caption">joined Seeens</span>
              ) : c.added_by?.name ? (
                <span className="home-row-action caption">added by {c.added_by.name}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Bands You Might Know, once Getting Started (which leads with them) is gone.
export async function MightKnow({ preview = false }: { preview?: boolean }) {
  const membership = await getMembership();
  if (!membership || (await gettingStartedShows(preview))) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("suggested_bands", { p_workspace_id: membership.workspaceId });
  if (!data?.length) return null;
  return (
    <section aria-labelledby="home-know" className="flex flex-col gap-3">
      <h2 id="home-know" className="display-s">
        Bands You Might Know
      </h2>
      <div className="window px-4">
        <SuggestedBands bands={data.slice(0, 4)} />
      </div>
    </section>
  );
}
