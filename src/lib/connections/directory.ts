import "server-only";
import { readVenueDetails, venueLine } from "./venue-details";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listSceneOptions, sceneAndChildren } from "@/lib/scenes/queries";
import { signPhotos } from "@/lib/photos/urls";
import { readFilters, type DirectoryFilters } from "./filters";
import type { ConnectionKind, ConnectionStatus, GroupType, PersonRole } from "./labels";
import { readTab, type Tab } from "./tabs";
import { INSTRUMENTS, playsLine, type Instrument } from "@/lib/affiliations/instruments";

export { DEFAULT_TAB, TABS, detailFor, directoryHrefFor, readTab, tabFor, type Tab } from "./tabs";

// The directory, one page at a time (#109). The directory_page RPC filters,
// orders, counts, and works out the network tags in the database; this file
// turns URL params into its arguments and fills in each row's details.

export const PAGE_SIZE = 48;

type Params = Record<string, string | string[] | undefined>;

// Where the next page starts: the last row's sort key.
export type Cursor = { rank: number; name: string; id: string };

export function readCursor(value: unknown): Cursor | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  return typeof c.rank === "number" && typeof c.name === "string" && typeof c.id === "string" &&
    /^[0-9a-f-]{36}$/i.test(c.id)
    ? { rank: c.rank, name: c.name, id: c.id }
    : null;
}

export type DirectoryItem = {
  id: string;
  name: string;
  kind: ConnectionKind;
  person_roles: PersonRole[];
  group_type: GroupType | null;
  status: ConnectionStatus;
  is_us: boolean;
  played_together: boolean;
  catalog_no: number;
  /** A signed link to the copied photo (#37), if there is one. */
  photo_url: string | null;
  photo_alt: string | null;
  localities: {
    name: string;
    region: string | null;
    region_code: string | null;
    country: string | null;
    country_code: string | null;
  } | null;
  outreach_entries: { occurred_on: string; summary: string }[];
  next_actions: { description: string; due_on: string | null }[];
  /** "Label mate", "Shares a member" */
  tags: string[];
  scenes: string[];
  /** A band's current members, by name (#122). */
  members: string[];
  /** What a person plays, from their band roles (#140): "Drums in The Tin Hollows · also plays bass". */
  plays: string | null;
  /** A venue's ages, capacity, and space (#48): "All ages · 50–150 cap · DIY". */
  venue: string | null;
  /** The band a Heard-of person takes their status from ("close to us", #140). */
  via: string | null;
  /** The first line of the notes, for Labels & more (#122). */
  note: string | null;
};


export type GroupCounts = Record<ConnectionStatus, number>;
export type TabCounts = Record<Tab, number>;

export type DirectoryCounts = {
  /** Everyone in this half (current or archived), any status, any tab. */
  view: number;
  /** The "of Y": this tab in this half. */
  total: number;
  /** After filters. */
  matched: number;
  groups: GroupCounts;
  hiddenAvoid: number;
  /** How many in this tab are archived (0 inside the archived view). */
  archived: number;
  /** Each tab's count under the other filters. */
  types: TabCounts;
  /** Instruments people in this half play, for the Plays filter (#140). */
  instruments: Instrument[];
  towns: { id: string; name: string; region: string | null; region_code: string | null; country: string | null; country_code: string | null }[];
};

export type DirectoryQuery = { tab: Tab; filters: DirectoryFilters };

export function readDirectoryQuery(params: Params): DirectoryQuery {
  const tab = readTab(params.type);
  const filters = readFilters(params);
  // Venue details filter only the Venues tab (#48).
  return { tab, filters: tab === "venues" ? filters : { ...filters, ages: "", capacity: "" } };
}

type RpcRow = {
  id: string;
  /** For people who are Known (neutral), the closest status of their current bands (#140). */
  status: ConnectionStatus;
  via: string | null;
  label_mate: boolean;
  shares_member: boolean;
};
type RpcResult = {
  rows: RpcRow[];
  next: Cursor | null;
  counts: {
    view: number;
    total: number;
    matched: number;
    groups: GroupCounts;
    hidden_avoid: number;
    archived: number;
    types: TabCounts;
    instruments: string[];
    towns: DirectoryCounts["towns"];
  } | null;
};

export async function loadDirectoryPage(
  { tab, filters }: DirectoryQuery,
  { after = null, counts = true }: { after?: Cursor | null; counts?: boolean } = {},
) {
  const [supabase, ws, scenes] = await Promise.all([createClient(), requireWorkspaceId(), listSceneOptions()]);
  const archived = filters.archived;

  const { data, error } = await supabase.rpc("directory_page", {
    p_workspace_id: ws,
    p_archived: archived,
    p_q: filters.q,
    p_statuses: filters.statuses,
    p_type: tab,
    p_instrument: filters.instrument || undefined,
    p_ages: filters.ages || undefined,
    p_capacity: filters.capacity || undefined,
    p_scene_ids: filters.scene ? [...sceneAndChildren(scenes, filters.scene)] : undefined,
    p_town: filters.town || undefined,
    p_hide_avoid: !archived,
    p_after: after ?? undefined,
    p_limit: PAGE_SIZE,
    p_counts: counts,
  });
  if (error || !data) throw new Error("Couldn't load the directory.");
  const page = data as unknown as RpcResult;
  const ids = page.rows.map((r) => r.id);

  // The page's details in one more round trip.
  const { data: details, error: detailError } = ids.length
    ? await supabase
        .from("connections")
        .select(
          "id, name, kind, person_roles, group_type, status, played_together, is_us, catalog_no, photo_path, photo_alt, notes, attributes, localities ( name, region, region_code, country, country_code ), connection_scenes ( scene_id ), outreach_entries ( occurred_on, summary ), next_actions ( description, due_on ), incoming:affiliations!affiliations_workspace_id_to_connection_id_fkey ( kind, is_current, other:connections!affiliations_workspace_id_from_connection_id_fkey ( name, archived_at ) ), outgoing:affiliations!affiliations_workspace_id_from_connection_id_fkey ( kind, is_current, role, other:connections!affiliations_workspace_id_to_connection_id_fkey ( name, archived_at ) )",
        )
        .eq("workspace_id", ws)
        .in("id", ids)
        // Date lines: only the latest outreach and the open plan.
        .eq("next_actions.status", "open")
        .order("occurred_on", { referencedTable: "outreach_entries", ascending: false })
        .order("created_at", { referencedTable: "outreach_entries", ascending: false })
        .limit(1, { referencedTable: "outreach_entries" })
    : { data: [], error: null };
  if (detailError) throw new Error("Couldn't load the directory.");

  const byId = new Map((details ?? []).map((d) => [d.id, d]));
  const photos = await signPhotos((details ?? []).map((d) => d.photo_path));
  const sceneNames = new Map(scenes.map((s) => [s.id, s.name]));
  const items: DirectoryItem[] = page.rows.flatMap((r) => {
    const d = byId.get(r.id);
    if (!d) return []; // deleted between the two reads
    const { connection_scenes, photo_path, notes, incoming, outgoing, attributes, ...rest } = d;
    // Current, unarchived members only, in name order.
    const names = (links: { kind: string; is_current: boolean; other: { name: string; archived_at: string | null } | null }[]) =>
      links
        .filter((a) => a.kind === "member" && a.is_current && a.other && !a.other.archived_at)
        .map((a) => a.other!.name)
        .sort((x, y) => x.localeCompare(y));
    return [
      {
        ...rest,
        photo_url: photo_path ? (photos.get(photo_path) ?? null) : null,
        tags: [r.label_mate ? "Label mate" : null, r.shares_member ? "Shares a member" : null].filter(
          (t): t is string => Boolean(t),
        ),
        scenes: connection_scenes.map((cs) => sceneNames.get(cs.scene_id)).filter((n): n is string => Boolean(n)),
        // The status that groups the row: their own, or via a band (#140).
        status: r.status ?? rest.status,
        via: r.via ?? null,
        members: names(incoming),
        plays:
          rest.kind === "person"
            ? playsLine(
                outgoing
                  .filter((a) => a.kind === "member" && a.other && !a.other.archived_at)
                  .map((a) => ({ band: a.other!.name, role: a.role, current: a.is_current })),
              )
            : null,
        venue: rest.group_type === "venue" ? venueLine(readVenueDetails(attributes)) : null,
        note: notes?.split("\n").find((line) => line.trim())?.trim() ?? null,
      },
    ];
  });

  const c = page.counts;
  return {
    items,
    next: page.next,
    counts: c
      ? ({
          view: c.view,
          total: c.total,
          matched: c.matched,
          groups: c.groups,
          hiddenAvoid: c.hidden_avoid,
          archived: c.archived,
          types: c.types,
          instruments: c.instruments.filter((i): i is Instrument => i in INSTRUMENTS),
          towns: c.towns,
        } satisfies DirectoryCounts)
      : null,
    scenes,
  };
}
