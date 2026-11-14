import "server-only";
import { catalogNo } from "@/lib/connections/card";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";
import { GROUP_TYPE_LABELS, PERSON_ROLE_LABELS, formatType, statusLabel } from "@/lib/connections/labels";
import type { GroupType, PersonRole } from "@/lib/connections/labels";
import { AGES, BOOK_VIA, CAPACITY, SPACE, readVenueDetails, venueTypeLabels } from "@/lib/connections/venue-details";
import { todayISO } from "@/lib/outreach/labels";
import { LIST_SEPARATOR, type ExportRow } from "./csv";
import { liftBand } from "@/lib/connections/band-details";
import { byTypeThenName } from "./order";

const BY_TYPE = byTypeThenName(
  Object.keys(GROUP_TYPE_LABELS) as GroupType[],
  Object.keys(PERSON_ROLE_LABELS) as PersonRole[],
);

const SELECT =
  "catalog_no, name, kind, person_roles, group_type, attributes, is_us, can_help_with, created_at, updated_at, band:connection_band_details ( status, played_together, notes, email, phone, archived_at ), localities ( name, region, country ), connection_scenes ( scenes ( name ) ), connection_links ( label, url, position ), next_actions ( description, due_on, status, assignee:workspace_members!next_actions_workspace_id_assignee_id_fkey ( display_name ) )";

/** Most listings Export Selected takes at once. */
export const MAX_SELECTED = 2000;
// Ids per request, so the request URL stays short.
const ID_CHUNK = 150;

// Everything in the current workspace, or just the listings picked in the
// Directory (#321): those can be records other bands share, with this band's
// own layer (status, notes, contacts) where it has one. Outreach history is
// not included.
export async function buildExportRows({ includeArchived, ids }: { includeArchived: boolean; ids?: string[] }) {
  const [supabase, membership] = await Promise.all([createClient(), getMembership()]);
  if (!membership) throw new Error("Not in a workspace.");
  const ws = membership.workspaceId;
  // Timestamps become calendar dates (YYYY-MM-DD) in the band's time zone.
  const day = (ts: string | null) => (ts ? todayISO(new Date(ts), membership.timeZone) : "");
  const query = () =>
    supabase
      .from("connections")
      .select(SELECT)
      // This band's private layer only, even for someone in two bands.
      .eq("band.workspace_id", ws)
      // Only the current plan, not every plan the connection ever had.
      // Connections without one are still exported.
      .eq("next_actions.status", "open");

  const data = ids
    ? (
        await Promise.all(
          chunks([...new Set(ids)].slice(0, MAX_SELECTED), ID_CHUNK).map(async (part) => {
            // RLS decides what's visible: this band's records and shared ones.
            const { data, error } = await query().in("id", part);
            if (error) throw error;
            return data ?? [];
          }),
        ).catch(() => {
          throw new Error("export query failed");
        })
      ).flat()
    : // Paged, so a big directory exports every row instead of the first 1,000.
      await fetchAll((from, to) => query().eq("workspace_id", ws).order("name").order("id").range(from, to)).catch(
        () => {
          throw new Error("export query failed");
        },
      );

  // Grouped by type (your band, bands, venues, ..., then people), A to Z in each.
  return (
    data
      .map(liftBand)
      // Archived is this band's own (#181).
      .filter((c) => includeArchived || !c.archived_at)
      .sort(BY_TYPE)
      .map((c): ExportRow => {
        const v = c.group_type === "venue" ? readVenueDetails(c.attributes) : {};
        const yesNo = (b?: boolean) => (b === true ? "yes" : b === false ? "no" : "");
        const next = c.next_actions.find((a) => a.status === "open");
        return {
          catalog_no: catalogNo(c),
          name: c.name,
          kind: c.kind === "group" ? "group" : "person",
          types: formatType(c).split(", ").join(LIST_SEPARATOR),
          status: c.status ?? "",
          played_together: c.played_together ? "yes" : "no",
          our_band: c.is_us ? "yes" : "no",
          town: c.localities?.name ?? "",
          region: c.localities?.region ?? "",
          country: c.localities?.country ?? "",
          scenes: c.connection_scenes
            .map((cs) => cs.scenes?.name)
            .filter((n): n is string => Boolean(n))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .join(LIST_SEPARATOR),
          can_help_with: c.can_help_with.join(LIST_SEPARATOR),
          email: c.email ?? "",
          phone: c.phone ?? "",
          links: [...c.connection_links]
            .sort((a, b) => a.position - b.position)
            .map((l) => (l.label ? `${l.label}: ${l.url}` : l.url))
            .join(LIST_SEPARATOR),
          notes: c.notes ?? "",
          next_action: next?.description ?? "",
          next_action_date: next?.due_on ?? "",
          next_action_owner: next ? (next.assignee?.display_name ?? "anyone") : "",
          archived_on: day(c.archived_at),
          added_on: day(c.created_at),
          updated_on: day(c.updated_at),
          status_label: c.status ? statusLabel(c.status, c) : "",
          ages: v.ages ? AGES[v.ages] : "",
          capacity: v.capacity ? CAPACITY[v.capacity] : "",
          space: v.space ? SPACE[v.space] : "",
          pa: yesNo(v.pa),
          sound_engineer: yesNo(v.sound),
          backline: yesNo(v.backline),
          book_via: v.book_via ? BOOK_VIA[v.book_via] : "",
          address: v.address ?? "",
          accessibility: v.accessibility ?? "",
          special_terms: v.special_terms ?? "",
          details_checked_on: v.checked_on ?? "",
          venue_types: venueTypeLabels(v).join(LIST_SEPARATOR),
        };
      })
  );
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
