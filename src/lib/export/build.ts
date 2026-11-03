import "server-only";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, formatType } from "@/lib/connections/labels";
import { todayISO } from "@/lib/outreach/labels";
import { LIST_SEPARATOR, type ExportRow } from "./csv";

// Timestamps become the band's local (Pacific) calendar date, YYYY-MM-DD.
const day = (ts: string | null) => (ts ? todayISO(new Date(ts)) : "");

// Everything in the current workspace. Outreach history is
// not included.
export async function buildExportRows({ includeArchived }: { includeArchived: boolean }) {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  let query = supabase
    .from("connections")
    .select(
      "name, kind, person_roles, group_type, status, played_together, is_us, can_help_with, email, phone, notes, archived_at, created_at, updated_at, localities ( name, region, country ), connection_scenes ( scenes ( name ) ), connection_links ( label, url, position ), next_actions ( description, due_on, status, assignee:workspace_members!next_actions_workspace_id_assignee_id_fkey ( display_name ) )",
    )
    .eq("workspace_id", ws)
    .order("name");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error("export query failed");

  return data.map((c): ExportRow => {
    const next = c.next_actions.find((a) => a.status === "open");
    return {
      name: c.name,
      kind: c.kind === "group" ? "group" : "person",
      types: formatType(c).split(", ").join(LIST_SEPARATOR),
      status: STATUS_LABELS[c.status],
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
    };
  });
}
