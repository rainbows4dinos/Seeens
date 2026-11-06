import "server-only";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";
import { catalogNo } from "./card";
import { duplicateGroups, pairKey } from "./duplicates";
import { formatLocality, formatType, type ConnectionKind, type GroupType, type PersonRole } from "./labels";
import { statusLabel } from "./status-words";
import { formatDay } from "@/lib/outreach/labels";

// Reads for merging duplicates (#169). Merged-away connections are hidden
// by RLS, so nothing here has to filter them out.

type Typed = { kind: ConnectionKind; group_type: GroupType | null; person_roles: PersonRole[]; catalog_no: number };

const LOCALITY = "localities ( name, region, region_code, country, country_code )";

/** Groups of possible duplicates, each listed with enough to tell them apart. */
export async function loadDuplicateGroups() {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  const [rows, notSame] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("connections")
        .select(`id, name, kind, group_type, person_roles, catalog_no, created_at, ${LOCALITY}`)
        .eq("workspace_id", ws)
        .is("archived_at", null)
        .order("name")
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("connection_not_duplicates")
        .select("connection_a, connection_b")
        .eq("workspace_id", ws)
        .order("connection_a")
        .order("connection_b")
        .range(from, to),
    ),
  ]);
  return duplicateGroups(
    rows,
    notSame.map((p) => pairKey(p.connection_a, p.connection_b)),
  ).map((g) =>
    g.map((c) => ({
      id: c.id,
      name: c.name,
      type: formatType(c),
      catalog: catalogNo(c),
      place: formatLocality(c.localities),
      created_at: c.created_at,
    })),
  );
}

/** How many extra copies there may be (a group of three is two), for the directory's link. */
export async function countDuplicates() {
  // A side note on the directory: if it can't load, leave it out rather
  // than break the page.
  const groups = await loadDuplicateGroups().catch(() => []);
  return groups.reduce((n, g) => n + g.length - 1, 0);
}

export type MergeFact = { label: string; value: string | null };
export type MergeCandidate = {
  id: string;
  name: string;
  meta: string;
  catalog: string;
  photo_path: string | null;
  isUs: boolean;
  archived: boolean;
  /** How much it holds; the fullest is picked to keep by default. */
  weight: number;
  facts: MergeFact[];
};

function firstLine(s: string | null, max = 80) {
  const line = (s ?? "").trim().split("\n")[0] ?? "";
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function listOf(names: string[], max = 3) {
  if (!names.length) return null;
  return names.length > max ? `${names.slice(0, max).join(", ")} +${names.length - max}` : names.join(", ");
}

/** Side-by-side summaries for the merge review, in the order asked. */
export async function loadMergeCandidates(ids: string[], today: string): Promise<MergeCandidate[]> {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  const [conns, outgoing, incoming, outreach, plans] = await Promise.all([
    supabase
      .from("connections")
      .select(
        `id, name, kind, group_type, person_roles, catalog_no, status, email, phone, notes, photo_path, is_us, archived_at, can_help_with, ${LOCALITY}, connection_links ( label, url, position ), connection_scenes ( scenes ( name ) )`,
      )
      .eq("workspace_id", ws)
      .in("id", ids),
    supabase
      .from("affiliations")
      .select("from_connection_id, other:connections!affiliations_workspace_id_to_connection_id_fkey ( id, name )")
      .eq("workspace_id", ws)
      .in("from_connection_id", ids),
    supabase
      .from("affiliations")
      .select("to_connection_id, other:connections!affiliations_workspace_id_from_connection_id_fkey ( id, name )")
      .eq("workspace_id", ws)
      .in("to_connection_id", ids),
    supabase
      .from("outreach_entries")
      .select("connection_id, occurred_on")
      .eq("workspace_id", ws)
      .in("connection_id", ids)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("next_actions")
      .select("connection_id, description")
      .eq("workspace_id", ws)
      .in("connection_id", ids)
      .eq("status", "open"),
  ]);
  if (conns.error || outgoing.error || incoming.error || outreach.error || plans.error) {
    throw new Error("Couldn't load these connections.");
  }

  return ids.flatMap((id) => {
    const c = conns.data.find((x) => x.id === id);
    if (!c) return [];
    const linked = [
      ...outgoing.data.filter((a) => a.from_connection_id === id).map((a) => a.other),
      ...incoming.data.filter((a) => a.to_connection_id === id).map((a) => a.other),
    ].filter((o): o is NonNullable<typeof o> => Boolean(o));
    const entries = outreach.data.filter((o) => o.connection_id === id);
    const plan = plans.data.find((p) => p.connection_id === id);
    const links = [...c.connection_links].sort((a, b) => a.position - b.position);
    const scenes = c.connection_scenes.map((s) => s.scenes?.name).filter((n): n is string => Boolean(n));
    const place = formatLocality(c.localities);
    const typed = c as Typed;

    const facts: MergeFact[] = [
      { label: "Status", value: c.is_us ? "Us" : statusLabel(c.status, typed) },
      { label: "Town", value: place },
      { label: "Linked", value: listOf(linked.map((o) => o.name)) },
      { label: "Links", value: listOf(links.map((l) => l.label || hostOf(l.url))) },
      { label: "Scenes", value: listOf(scenes) },
      {
        label: "Outreach",
        value: entries.length
          ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}, last ${formatDay(entries[0].occurred_on, today)}`
          : null,
      },
      { label: "Plan", value: plan ? firstLine(plan.description, 60) : null },
      { label: "Email", value: c.email },
      { label: "Phone", value: c.phone },
      { label: "Notes", value: firstLine(c.notes) },
    ];
    const weight =
      facts.filter((f) => f.value).length +
      linked.length +
      links.length +
      scenes.length +
      entries.length +
      (c.photo_path ? 1 : 0) +
      c.can_help_with.length;

    return [
      {
        id: c.id,
        name: c.name,
        meta: [formatType(typed), place].filter(Boolean).join(" · "),
        catalog: catalogNo(typed),
        photo_path: c.photo_path,
        isUs: c.is_us,
        archived: Boolean(c.archived_at),
        weight,
        facts,
      },
    ];
  });
}

export type MergedSummary = { id: string; name: string; catalog: string };

const UNDO_DAYS = 30;

/** "Dec 6": the last day a merge made at `from` can be undone. */
export function undoDeadline(from: Date, timeZone: string) {
  return new Date(from.getTime() + UNDO_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  });
}

/** The newest merge into this connection that can still be undone. */
export async function loadUndoableMerge(keepId: string, timeZone: string) {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  const since = new Date(Date.now() - UNDO_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("connection_merges")
    .select("id, merged_at, merged_summary")
    .eq("workspace_id", ws)
    .eq("keep_id", keepId)
    .is("undone_at", null)
    .is("purged_at", null)
    .gt("merged_at", since)
    .order("merged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const merged = (Array.isArray(data.merged_summary) ? data.merged_summary : []) as (Typed & {
    id: string;
    name: string;
  })[];
  return {
    id: data.id,
    merged: merged.map((m) => ({ id: m.id, name: m.name, catalog: catalogNo(m) })) as MergedSummary[],
    until: undoDeadline(new Date(data.merged_at), timeZone),
  };
}

/** A merge into this connection that was just undone, for the "Merge undone" notice. */
export async function loadUndoneMerge(keepId: string, mergeId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(mergeId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("connection_merges")
    .select("merged_summary")
    .eq("id", mergeId)
    .eq("keep_id", keepId)
    .not("undone_at", "is", null)
    .maybeSingle();
  if (!data || !Array.isArray(data.merged_summary)) return null;
  return (data.merged_summary as (Typed & { id: string; name: string })[]).map((m) => ({
    id: m.id,
    name: m.name,
    catalog: catalogNo(m),
  })) as MergedSummary[];
}

/** Where a merged-away connection went, if it was merged. */
export async function mergedTarget(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("merged_target", { p_id: id });
  if (error) return null;
  return data;
}
