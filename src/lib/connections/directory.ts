import "server-only";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listSceneOptions, sceneAndChildren } from "@/lib/scenes/queries";
import { readFilters, type DirectoryFilters } from "./filters";
import type { ConnectionKind, ConnectionStatus, GroupType, PersonRole } from "./labels";

// The directory, one page at a time (#109). The directory_page RPC filters,
// orders, counts, and works out the network tags in the database; this file
// turns URL params into its arguments and fills in each row's details.

export const PAGE_SIZE = 48;

type Params = Record<string, string | string[] | undefined>;

export type View = "current" | "lets_play" | "crushes" | "archived";
const VIEW_IDS: View[] = ["current", "lets_play", "crushes", "archived"];
// Let's play and Crushes are the directory with one status. Crush is
// stored as `prospect` and Heard of as `neutral`; only the labels changed.
export const VIEW_STATUS: Partial<Record<View, ConnectionStatus>> = {
  lets_play: "lets_play",
  crushes: "prospect",
};

export function readView(v: string | string[] | undefined): View {
  const raw = Array.isArray(v) ? v[0] : v;
  // Old links from before the rename still land on the right list.
  const value = raw === "prospects" ? "crushes" : raw;
  return VIEW_IDS.includes(value as View) ? (value as View) : "current";
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

export type GroupCounts = Record<"us" | ConnectionStatus, number>;

export type DirectoryCounts = {
  /** Everyone in this half (current or archived), any status. */
  view: number;
  /** The "of Y": this half, or this list's status. */
  total: number;
  /** After filters. */
  matched: number;
  groups: GroupCounts;
  hiddenAvoid: number;
  towns: { id: string; name: string; region: string | null; region_code: string | null; country: string | null; country_code: string | null }[];
};

export type DirectoryQuery = {
  view: View;
  /** As asked in the URL (statuses empty in list views). */
  asked: DirectoryFilters;
  /** As applied: list views add their status. */
  filters: DirectoryFilters;
};

export function readDirectoryQuery(params: Params): DirectoryQuery {
  const view = readView(params.view);
  const asked = readFilters(params);
  const status = VIEW_STATUS[view];
  return { view, asked, filters: status ? { ...asked, statuses: [status] } : asked };
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
    towns: DirectoryCounts["towns"];
  } | null;
};

export async function loadDirectoryPage(
  { view, filters }: DirectoryQuery,
  { after = null, counts = true }: { after?: Cursor | null; counts?: boolean } = {},
) {
  const [supabase, ws, scenes] = await Promise.all([createClient(), requireWorkspaceId(), listSceneOptions()]);
  const archived = view === "archived";
  const [kind, value] = filters.type ? filters.type.split(":") : [];

  const { data, error } = await supabase.rpc("directory_page", {
    p_workspace_id: ws,
    p_archived: archived,
    p_q: filters.q,
    p_statuses: filters.statuses,
    p_list_status: VIEW_STATUS[view],
    p_kind: kind as ConnectionKind | undefined,
    p_group_type: kind === "group" ? (value as GroupType) : undefined,
    p_person_role: kind === "person" ? (value as PersonRole) : undefined,
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
          "id, name, kind, person_roles, group_type, status, played_together, is_us, catalog_no, localities ( name, region, region_code, country, country_code ), connection_scenes ( scene_id ), outreach_entries ( occurred_on, summary ), next_actions ( description, due_on )",
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
  const sceneNames = new Map(scenes.map((s) => [s.id, s.name]));
  const items: DirectoryItem[] = page.rows.flatMap((r) => {
    const d = byId.get(r.id);
    if (!d) return []; // deleted between the two reads
    const { connection_scenes, ...rest } = d;
    return [
      {
        ...rest,
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
          towns: c.towns,
        } satisfies DirectoryCounts)
      : null,
    scenes,
  };
}
