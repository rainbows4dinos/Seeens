import "server-only";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listSceneOptions, sceneAndChildren } from "@/lib/scenes/queries";
import { signPhotos } from "@/lib/photos/urls";
import { readFilters, type DirectoryFilters } from "./filters";
import type { ConnectionKind, ConnectionStatus, GroupType, PersonRole } from "./labels";

// The directory, one page at a time (#109). The directory_page RPC filters,
// orders, counts, and works out the network tags in the database; this file
// turns URL params into its arguments and fills in each row's details.

export const PAGE_SIZE = 48;

type Params = Record<string, string | string[] | undefined>;

// The directory by type (#122): one tab per kind of connection, Bands first.
// "Labels & more" is every group that isn't a band or a venue.
export type Tab = "bands" | "people" | "venues" | "more" | "all";
export const TABS: { id: Tab; label: string; one: string; many: string; add: string; addType: string | null }[] = [
  { id: "bands", label: "Bands", one: "band", many: "bands", add: "Add Band", addType: "band" },
  { id: "people", label: "People", one: "person", many: "people", add: "Add Person", addType: "person" },
  { id: "venues", label: "Venues", one: "venue", many: "venues", add: "Add Venue", addType: "venue" },
  { id: "more", label: "Labels & more", one: "connection", many: "connections", add: "Add Label", addType: "label" },
  { id: "all", label: "All", one: "connection", many: "connections", add: "Add Connection", addType: null },
];
export const DEFAULT_TAB: Tab = "bands";

/** The tab a connection is listed under. */
export function tabFor(kind: ConnectionKind, groupType: GroupType | null): Tab {
  if (kind === "person") return "people";
  if (groupType === "band") return "bands";
  if (groupType === "venue") return "venues";
  return "more";
}

/** Back to the directory, on a connection's own tab (and the archived half if it's archived). */
export function directoryHrefFor(kind: ConnectionKind, groupType: GroupType | null, archived: boolean) {
  const p = new URLSearchParams();
  const tab = tabFor(kind, groupType);
  if (tab !== DEFAULT_TAB) p.set("type", tab);
  if (archived) p.set("archived", "1");
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

export function readTab(v: string | string[] | undefined): Tab {
  const raw = (Array.isArray(v) ? v[0] : v) ?? "";
  if (TABS.some((t) => t.id === raw)) return raw as Tab;
  // The old Type filter (?type=group:band, person:dj) lands on its tab.
  if (raw.startsWith("person:")) return "people";
  if (raw === "group:band") return "bands";
  if (raw === "group:venue") return "venues";
  if (raw.startsWith("group:")) return "more";
  return DEFAULT_TAB;
}

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
  /** Each tab's count under the other filters. */
  types: TabCounts;
  towns: { id: string; name: string; region: string | null; region_code: string | null; country: string | null; country_code: string | null }[];
};

export type DirectoryQuery = { tab: Tab; filters: DirectoryFilters };

export function readDirectoryQuery(params: Params): DirectoryQuery {
  return { tab: readTab(params.type), filters: readFilters(params) };
}

type RpcRow = { id: string; label_mate: boolean; shares_member: boolean };
type RpcResult = {
  rows: RpcRow[];
  next: Cursor | null;
  counts: {
    view: number;
    total: number;
    matched: number;
    groups: GroupCounts;
    hidden_avoid: number;
    types: TabCounts;
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
          "id, name, kind, person_roles, group_type, status, played_together, is_us, catalog_no, photo_path, photo_alt, localities ( name, region, region_code, country, country_code ), connection_scenes ( scene_id ), outreach_entries ( occurred_on, summary ), next_actions ( description, due_on )",
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
    const { connection_scenes, photo_path, ...rest } = d;
    return [
      {
        ...rest,
        photo_url: photo_path ? (photos.get(photo_path) ?? null) : null,
        tags: [r.label_mate ? "Label mate" : null, r.shares_member ? "Shares a member" : null].filter(
          (t): t is string => Boolean(t),
        ),
        scenes: connection_scenes.map((cs) => sceneNames.get(cs.scene_id)).filter((n): n is string => Boolean(n)),
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
          types: c.types,
          towns: c.towns,
        } satisfies DirectoryCounts)
      : null,
    scenes,
  };
}
