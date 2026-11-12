import "server-only";
import { cache } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// A label's roster (#298): the bands on it, current ones first, then by
// name. Empty for a band.
export const loadRoster = cache(async () => {
  const membership = await getMembership();
  if (!membership || membership.kind !== "label") return [];
  const supabase = await createClient();
  const { data: roster } = await supabase.rpc("label_roster", { p_workspace_id: membership.workspaceId });
  const ids = (roster ?? []).map((r) => r.connection_id);
  if (!ids.length) return [];
  const { data: bands } = await supabase
    .from("connections")
    .select(
      "id, name, kind, group_type, person_roles, photo_path, localities ( name, region, region_code, country, country_code )",
    )
    .in("id", ids);
  const byId = new Map((roster ?? []).map((r) => [r.connection_id, r]));
  return (bands ?? [])
    .flatMap((b) => {
      const r = byId.get(b.id);
      return r ? [{ ...b, ...r }] : [];
    })
    .sort((a, b) => Number(b.is_current) - Number(a.is_current) || a.name.localeCompare(b.name));
});
