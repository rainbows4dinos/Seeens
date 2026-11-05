import "server-only";
import { readVenueDetails, venueDetailsToForm } from "./venue-details";
import { notFound } from "next/navigation";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";
import { buildNetwork } from "./network";
import { catalogNo } from "./card";
import { formatPlace } from "@/lib/places";
import { EMPTY_FORM, type ConnectionFormValues } from "./form";

// All reads go through RLS, and each also filters to the current workspace
// so someone in two bands only sees this band's rows.

type Supabase = Awaited<ReturnType<typeof createClient>>;

function fetchEdges(supabase: Supabase, ws: string) {
  return fetchAll((from, to) =>
    supabase
      .from("affiliations")
      .select("from_connection_id, to_connection_id, kind")
      .eq("workspace_id", ws)
      .order("id")
      .range(from, to),
  );
}

export async function getConnection(id: string) {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);

  // The network doesn't depend on this connection, so load it in the same
  // round trip as everything else.
  const [connection, outgoing, incoming, nextAction, history, members, outreach, pastPlans, network] = await Promise.all([
    supabase
      .from("connections")
      .select("*, localities ( name, region, region_code, country, country_code, place_id ), connection_links ( id, label, url, position ), connection_scenes ( scenes ( id, name ) )")
      .eq("id", id)
      .eq("workspace_id", ws)
      .maybeSingle(),
    supabase
      .from("affiliations")
      .select(
        "id, kind, role, is_current, notes, other:connections!affiliations_workspace_id_to_connection_id_fkey ( id, name, kind, group_type, person_roles, catalog_no, is_us, archived_at )",
      )
      .eq("from_connection_id", id)
      .eq("workspace_id", ws),
    supabase
      .from("affiliations")
      .select(
        "id, kind, role, is_current, notes, other:connections!affiliations_workspace_id_from_connection_id_fkey ( id, name, kind, group_type, person_roles, catalog_no, is_us, archived_at )",
      )
      .eq("to_connection_id", id)
      .eq("workspace_id", ws),
    supabase
      .from("next_actions")
      .select(
        "id, description, due_on, assignee_id, assignee:workspace_members!next_actions_workspace_id_assignee_id_fkey ( display_name )",
      )
      .eq("connection_id", id)
      .eq("workspace_id", ws)
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("connection_status_changes")
      .select("id, from_status, to_status, changed_by, changed_at")
      .eq("connection_id", id)
      .eq("workspace_id", ws)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(10),
    supabase.from("workspace_members").select("user_id, display_name").eq("workspace_id", ws).order("display_name"),
    supabase
      .from("outreach_entries")
      .select(
        "id, occurred_on, channel, summary, author_id, created_at, author:workspace_members!outreach_entries_workspace_id_author_id_fkey ( display_name )",
      )
      .eq("connection_id", id)
      .eq("workspace_id", ws)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("next_actions")
      .select("id, description, due_on, status, closed_at")
      .eq("connection_id", id)
      .eq("workspace_id", ws)
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
      .map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        group_type: c.group_type,
        person_roles: c.person_roles,
        catalog: catalogNo(c),
      })),
    labelMates: network.labelMatesOf(id).map((m) => {
      const mate = network.connections.find((n) => n.id === m.id);
      return { ...m, catalog: mate ? catalogNo(mate) : null };
    }),
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
    venue: venueDetailsToForm(readVenueDetails(c.attributes)),
    updatedAt: c.updated_at,
  };
}

// The whole workspace's link graph is small, so derive network facts in memory:
// label mates (bands sharing a label) and members shared with "us".
export async function loadNetwork() {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  const [connections, edges] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("connections")
        .select("id, name, kind, group_type, person_roles, catalog_no, is_us, archived_at")
        .eq("workspace_id", ws)
        .order("name")
        .order("id")
        .range(from, to),
    ),
    fetchEdges(supabase, ws),
  ]).catch(() => {
    throw new Error("Couldn't load your network.");
  });
  return buildNetwork(connections, edges);
}
