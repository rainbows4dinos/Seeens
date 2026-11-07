import "server-only";
import { liftBand } from "./band-details";
import type { createClient } from "@/lib/supabase/server";

// "Played together" carries over (#124): after a band is marked, offer its
// current members; after a person is marked, offer the bands they're in.
// Nothing is inherited: each connection keeps its own value, and only what
// the person ticks is changed.

export type Relative = { id: string; name: string; playedTogether: boolean };
export type PlayedOffer = { direction: "members" | "bands"; relatives: Relative[] };

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Other = { id: string; name: string; played_together: boolean; archived_at: string | null; is_us: boolean } | null;
// As selected: this band's private layer (#181) still nested under `band`.
type Raw = { id: string; name: string; is_us: boolean; band: { played_together: boolean; archived_at: string | null } | null } | null;

/** The offer for a connection that was just marked, or null when there's nobody left to mark. */
export async function loadPlayedOffer(supabase: Supabase, workspaceId: string, id: string): Promise<PlayedOffer | null> {
  const { data: subject } = await supabase
    .from("connections")
    .select("kind")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!subject) return null;

  // Members link a person (from) to a group (to).
  const members = subject.kind === "group";
  const { data } = members
    ? await supabase
        .from("affiliations")
        .select("other:connections!affiliations_workspace_id_from_connection_id_fkey ( id, name, is_us, band:connection_band_details ( played_together, archived_at ) )")
        .eq("workspace_id", workspaceId)
        .eq("to_connection_id", id)
        .eq("kind", "member")
        .eq("is_current", true)
    : await supabase
        .from("affiliations")
        .select("other:connections!affiliations_workspace_id_to_connection_id_fkey ( id, name, is_us, band:connection_band_details ( played_together, archived_at ) )")
        .eq("workspace_id", workspaceId)
        .eq("from_connection_id", id)
        .eq("kind", "member")
        .eq("is_current", true);

  // Current links only; not archived ones, and never our own band.
  const relatives = ((data ?? []) as unknown as { other: Raw }[])
    .map((a): Other => (a.other ? liftBand(a.other) : null))
    .filter((o): o is NonNullable<Other> => Boolean(o && !o.archived_at && !o.is_us))
    .map((o) => ({ id: o.id, name: o.name, playedTogether: o.played_together }))
    .sort((x, y) => x.name.localeCompare(y.name));
  if (!relatives.some((r) => !r.playedTogether)) return null;
  return { direction: members ? "members" : "bands", relatives };
}
