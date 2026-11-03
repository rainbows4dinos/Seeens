import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPlace } from "@/lib/places";
import { EMPTY_FORM, type ConnectionFormValues } from "./form";

// All reads go through RLS: a member only ever sees their workspace's rows.

export async function listConnections({ archived }: { archived: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("connections")
    .select(
      "id, name, kind, person_roles, group_type, status, played_together, is_us, archived_at, locality_id, localities ( name, region, region_code, country, country_code, place_id ), connection_scenes ( scene_id )",
    )
    .order("name");
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw new Error("Couldn't load the directory.");
  return data;
}

export type ConnectionListItem = Awaited<ReturnType<typeof listConnections>>[number];

export async function getConnection(id: string) {
  const supabase = await createClient();

  // The network doesn't depend on this connection, so load it in the same
  // round trip as everything else.
  const [connection, outgoing, incoming, nextAction, history, members, outreach, pastPlans, network] = await Promise.all([
    supabase
      .from("connections")
      .select("*, localities ( name, region, region_code, country, country_code, place_id ), connection_links ( id, label, url, position ), connection_scenes ( scenes ( id, name ) )")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("affiliations")
      .select(
        "id, kind, role, is_current, notes, other:connections!affiliations_workspace_id_to_connection_id_fkey ( id, name, kind, group_type, is_us, archived_at )",
      )
      .eq("from_connection_id", id),
    supabase
      .from("affiliations")
      .select(
        "id, kind, role, is_current, notes, other:connections!affiliations_workspace_id_from_connection_id_fkey ( id, name, kind, group_type, is_us, archived_at )",
      )
      .eq("to_connection_id", id),
    supabase
      .from("next_actions")
      .select(
        "id, description, due_on, assignee_id, assignee:workspace_members!next_actions_workspace_id_assignee_id_fkey ( display_name )",
      )
      .eq("connection_id", id)
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("connection_status_changes")
      .select("id, from_status, to_status, changed_by, changed_at")
      .eq("connection_id", id)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(10),
    supabase.from("workspace_members").select("user_id, display_name").order("display_name"),
    supabase
      .from("outreach_entries")
      .select(
        "id, occurred_on, channel, summary, author_id, created_at, author:workspace_members!outreach_entries_workspace_id_author_id_fkey ( display_name )",
      )
      .eq("connection_id", id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("next_actions")
      .select("id, description, due_on, status, closed_at")
      .eq("connection_id", id)
      .in("status", ["done", "dropped"])
      .order("closed_at", { ascending: false })
      .limit(5),
    loadNetwork(),
  ]);

  // An invalid UUID comes back as an error; treat it like a missing record.
  if (connection.error?.code === "22P02") notFound();
  if (connection.error) throw new Error("Couldn't load this connection.");
  if (!connection.data) notFound();
  if (
    outgoing.error ||
    incoming.error ||
    nextAction.error ||
    history.error ||
    members.error ||
    outreach.error ||
    pastPlans.error
  ) {
    throw new Error("Couldn't load this connection's details.");
  }

  const links = [...connection.data.connection_links].sort((a, b) => a.position - b.position);
  const scenes = connection.data.connection_scenes
    .map((cs) => cs.scenes)
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return {
    connection: { ...connection.data, connection_links: links, scenes },
    affiliations: { outgoing: outgoing.data, incoming: incoming.data },
    nextAction: nextAction.data,
    outreach: outreach.data,
    pastPlans: pastPlans.data,
    members: members.data,
    statusHistory: history.data.map((h) => ({
      ...h,
      by: members.data.find((m) => m.user_id === h.changed_by)?.display_name ?? null,
    })),
    candidates: network.connections
      .filter((c) => c.id !== id && !c.archived_at)
      .map(({ id, name, kind, group_type }) => ({ id, name, kind, group_type })),
    labelMates: network.labelMatesOf(id),
    sharedWithUs: network.sharedMembersWithUs(id),
    isLabelMateWithUs: network.isLabelMateWithUs(id),
  };
}

export type ConnectionDetail = Awaited<ReturnType<typeof getConnection>>;

export function toFormValues(c: ConnectionDetail["connection"]): ConnectionFormValues {
  return {
    ...EMPTY_FORM,
    name: c.name,
    kind: c.kind,
    personRoles: c.person_roles,
    groupType: c.group_type ?? "",
    status: c.status,
    playedTogether: c.played_together,
    isUs: c.is_us,
    canHelpWith: c.can_help_with.join(", "),
    placeId: c.localities?.place_id ? String(c.localities.place_id) : "",
    placeText: c.localities ? formatPlace({ ...c.localities, country_name: c.localities.country }) : "",
    keepLocalityId: c.localities && !c.localities.place_id && c.locality_id ? c.locality_id : "",
    sceneIds: c.scenes.map((s) => s.id),
    email: c.email ?? "",
    phone: c.phone ?? "",
    notes: c.notes ?? "",
    links: c.connection_links.length
      ? c.connection_links.map((l) => ({ label: l.label ?? "", url: l.url }))
      : EMPTY_FORM.links,
  };
}

// The whole workspace's link graph is small, so derive network facts in memory:
// label mates (bands sharing a label) and members shared with "us".
export async function loadNetwork() {
  const supabase = await createClient();
  const [links, conns] = await Promise.all([
    supabase.from("affiliations").select("from_connection_id, to_connection_id, kind"),
    supabase.from("connections").select("id, name, kind, group_type, is_us, archived_at").order("name"),
  ]);
  if (links.error || conns.error) throw new Error("Couldn't load your network.");

  const connections = conns.data;
  const byId = new Map(connections.map((c) => [c.id, c]));
  const usId = connections.find((c) => c.is_us)?.id ?? null;
  const edges = links.data;

  const labelsOf = (id: string) =>
    edges.filter((e) => e.kind === "on_label" && e.from_connection_id === id).map((e) => e.to_connection_id);
  const membersOf = (id: string) =>
    new Set(edges.filter((e) => e.kind === "member" && e.to_connection_id === id).map((e) => e.from_connection_id));

  const labelMatesOf = (id: string) => {
    const labels = new Set(labelsOf(id));
    const ids = new Set(
      edges
        .filter((e) => e.kind === "on_label" && labels.has(e.to_connection_id) && e.from_connection_id !== id)
        .map((e) => e.from_connection_id),
    );
    return [...ids]
      .map((mid) => byId.get(mid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c && !c.archived_at))
      .map((c) => ({ id: c.id, name: c.name, is_us: c.is_us }));
  };

  const usLabelMates = new Set(usId ? labelMatesOf(usId).map((c) => c.id) : []);
  const usMembers = usId ? membersOf(usId) : new Set<string>();

  return {
    connections,
    usId,
    labelMatesOf,
    isLabelMateWithUs: (id: string) => usLabelMates.has(id),
    // Names of people in both this band and ours (current or former).
    sharedMembersWithUs: (id: string) =>
      id === usId
        ? []
        : [...membersOf(id)]
            .filter((m) => usMembers.has(m))
            .map((m) => byId.get(m)?.name)
            .filter((n): n is string => Boolean(n)),
  };
}
