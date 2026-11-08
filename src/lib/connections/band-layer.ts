import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Patch = Omit<
  Database["public"]["Tables"]["connection_band_details"]["Update"],
  "workspace_id" | "connection_id" | "updated_at"
>;
type Row = { connection_id: string; status: Database["public"]["Enums"]["connection_status"] | null; played_together: boolean };

// Writes this band's private layer on records (#185). A band has a row on
// every record it added, but none on another band's until it first sets
// something there, so this updates the rows it has and adds the rest. Two
// bandmates adding the same row at once: the second one updates instead.
export async function writeBandLayer(
  supabase: Supabase,
  workspaceId: string,
  ids: string[],
  patch: Patch,
): Promise<{ rows: Row[]; error: boolean }> {
  const update = (which: string[]) =>
    supabase
      .from("connection_band_details")
      .update(patch)
      .eq("workspace_id", workspaceId)
      .in("connection_id", which)
      .select("connection_id, status, played_together");

  const first = await update(ids);
  if (first.error) return { rows: [], error: true };
  const done = new Set(first.data.map((r) => r.connection_id));
  const missing = ids.filter((id) => !done.has(id));
  if (!missing.length) return { rows: first.data, error: false };

  const added = await supabase
    .from("connection_band_details")
    .insert(missing.map((connection_id) => ({ workspace_id: workspaceId, connection_id, ...patch })))
    .select("connection_id, status, played_together");
  if (!added.error) return { rows: [...first.data, ...added.data], error: false };
  if (added.error.code !== "23505") return { rows: first.data, error: true };

  const again = await update(missing);
  if (again.error) return { rows: first.data, error: true };
  return { rows: [...first.data, ...again.data], error: false };
}
