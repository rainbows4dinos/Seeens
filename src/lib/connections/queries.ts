import "server-only";
import { readVenueDetails, venueDetailsToForm } from "./venue-details";
import { notFound, redirect } from "next/navigation";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";
import { buildNetwork } from "./network";
import { catalogNo } from "./card";
import { formatPlace } from "@/lib/places";
import { EMPTY_FORM, type ConnectionFormValues } from "./form";
import { liftBand, liftOther } from "./band-details";

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

// The record, with this band's private layer (#181).
const CONNECTION_SELECT =
  "*, added_by:workspaces!connections_workspace_id_fkey ( name ), band:connection_band_details ( status, played_together, notes, email, phone, archived_at, updated_at ), localities ( name, region, region_code, country, country_code, place_id ), connection_links ( id, label, url, position ), connection_scenes ( scenes ( id, name ) )";

// A timestamp to the microsecond, as the database compares them (Date drops
// the last three digits).
function micros(ts: string) {
  const fraction = (ts.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0").slice(0, 6);
  return BigInt(Date.parse(ts.replace(/\.\d+/, ""))) * BigInt(1000) + BigInt(fraction);
}

// Links in order and scenes by name, the way the pages show them.
function shapeConnection<T extends {
  band: Parameters<typeof liftBand>[0]["band"];
  connection_links: { position: number }[];
  connection_scenes: { scenes: { id: string; name: string } | null }[];
}>(withBand: T & { updated_at: string }) {
  const row = liftBand(withBand);
  // The version an edit form saves against: the record or this band's
  // private layer, whichever changed last (#181).
  const layer = Array.isArray(withBand.band) ? withBand.band[0] : withBand.band;
  const layerAt = (layer as { updated_at?: string } | null)?.updated_at;
  const version = layerAt && micros(layerAt) > micros(withBand.updated_at) ? layerAt : withBand.updated_at;
  const links = [...row.connection_links].sort((a, b) => a.position - b.position);
  const scenes = row.connection_scenes
    .map((cs) => cs.scenes)
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { ...row, connection_links: links, scenes, version };
}

/** Just the connection's own fields, for an autosave to merge into (#126). */
export async function getConnectionValues(id: string) {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  // Any record this band can see (#185), with this band's layer on it.
  const { data, error } = await supabase
    .from("connections")
    .select(CONNECTION_SELECT)
    .eq("id", id)
    .eq("band.workspace_id", ws)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const c = shapeConnection(data);
  return {
    values: toFormValues(c),
    updatedAt: c.version,
    /** The record's own version, without this band's layer: a moderator's check (#195). */
    recordUpdatedAt: c.updated_at,
    attributes: c.attributes,
    mine: c.workspace_id === ws,
  };
}

export async function getConnection(id: string) {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);

  // The network doesn't depend on this connection, so load it in the same
  // round trip as everything else.
  const [connection, outgoing, incoming, nextAction, history, members, outreach, pastPlans, network, lastEdit] = await Promise.all([
    supabase
      .from("connections")
      .select(CONNECTION_SELECT)
      .eq("id", id)
      // This band's records and the ones other bands share (#185); only this band's layer.
      .eq("band.workspace_id", ws)
      .maybeSingle(),
    supabase
      .from("affiliations")
      .select(
        "id, kind, role, is_current, notes, other:connections!affiliations_workspace_id_to_connection_id_fkey ( id, name, kind, group_type, person_roles, catalog_no, is_us, band:connection_band_details ( archived_at ) )",
      )
      .eq("from_connection_id", id)
      .eq("workspace_id", ws),
    supabase
      .from("affiliations")
      .select(
        "id, kind, role, is_current, notes, other:connections!affiliations_workspace_id_from_connection_id_fkey ( id, name, kind, group_type, person_roles, catalog_no, is_us, band:connection_band_details ( archived_at ) )",
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
    // A moderator's last fix (#195), when this band or a moderator can see it.
    supabase
      .from("connection_edits")
      .select("edited_at, by_band")
      .eq("connection_id", id)
      .order("edited_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // An invalid UUID comes back as an error; treat it like a missing record.
  if (connection.error?.code === "22P02") notFound();
  if (connection.error) throw new Error("Couldn't load this connection.");
  if (!connection.data) {
    // Merged into another one (#169): go there instead.
    const { data: target } = await supabase.rpc("merged_target", { p_id: id });
    if (target) redirect(`/connections/${target}`);
    notFound();
  }
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

  const shaped = shapeConnection(connection.data);
  return {
    connection: shaped,
    /** Added by this band, so it can change the record itself (#185). */
    mine: shaped.workspace_id === ws,
    /** When a moderator last changed it (#195), or null. */
    moderatedAt: lastEdit.data?.edited_at ?? null,
    /** Who last fixed it from outside: the band that claimed it (#68), or null for a moderator. */
    moderatedBy: lastEdit.data?.by_band ?? null,
    /** The band that shared it, when it's another band's. */
    sharedBy: shaped.workspace_id === ws ? null : (shaped.added_by?.name ?? "another band"),
    affiliations: {
      outgoing: outgoing.data.map((a) => ({ ...a, other: liftOther(a.other) })),
      incoming: incoming.data.map((a) => ({ ...a, other: liftOther(a.other) })),
    },
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
    status: c.status ?? "",
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
    updatedAt: c.version,
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
        .select("id, name, kind, group_type, person_roles, catalog_no, is_us, band:connection_band_details ( archived_at )")
        .eq("workspace_id", ws)
        .order("name")
        .order("id")
        .range(from, to),
    ),
    fetchEdges(supabase, ws),
  ]).catch(() => {
    throw new Error("Couldn't load your network.");
  });
  return buildNetwork(connections.map(liftBand), edges);
}
