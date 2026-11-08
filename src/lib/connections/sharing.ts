import { getCurrentUser, getLinkedPeople, getMembership, isModerator, requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";
import { liftBand } from "./band-details";
import { catalogNo } from "./card";
import { formatType } from "./labels";

// What a band shares with every other band (#185): every record it
// added, kept private or not. People start private, everything else shared.

export type SharingRow = {
  id: string;
  name: string;
  type: string;
  catalog: string;
  isUs: boolean;
  archived: boolean;
  keepPrivate: boolean;
  /** Why this member can't change it (#195), or null when they can. */
  locked: string | null;
};

export type SharingSection = { key: "people" | "bands" | "venues" | "others"; title: string; rows: SharingRow[] };

export async function loadSharing(): Promise<SharingSection[]> {
  const [supabase, ws, membership, user, moderator, linked] = await Promise.all([
    createClient(),
    requireWorkspaceId(),
    getMembership(),
    getCurrentUser(),
    isModerator(),
    getLinkedPeople(),
  ]);
  const owner = membership?.role === "owner";
  const rows = await fetchAll((from, to) =>
    supabase
      .from("connections")
      .select(
        "id, name, kind, group_type, person_roles, catalog_no, is_us, keep_private, band:connection_band_details!inner ( archived_at )",
      )
      .eq("workspace_id", ws)
      .eq("band.workspace_id", ws)
      .order("name")
      .order("id")
      .range(from, to),
  );

  const sections: SharingSection[] = [
    { key: "people", title: "People", rows: [] },
    { key: "bands", title: "Bands", rows: [] },
    { key: "venues", title: "Venues", rows: [] },
    { key: "others", title: "Everything Else", rows: [] },
  ];
  for (const raw of rows) {
    const c = liftBand(raw);
    const row: SharingRow = {
      id: c.id,
      name: c.name,
      type: formatType(c),
      catalog: catalogNo(c),
      isUs: c.is_us,
      archived: Boolean(c.archived_at),
      keepPrivate: c.keep_private,
      locked: keepPrivateLock(c, { owner, moderator, me: user.id, linked: linked.get(c.id) ?? null }),
    };
    const key =
      c.kind === "person" ? "people" : c.group_type === "band" ? "bands" : c.group_type === "venue" ? "venues" : "others";
    sections.find((s) => s.key === key)!.rows.push(row);
  }
  return sections;
}

/** Why someone can't keep this record private or share it (#195), or null. */
export function keepPrivateLock(
  c: { kind: "person" | "group"; is_us: boolean },
  who: { owner: boolean; moderator: boolean; me: string; linked: { userId: string; displayName: string } | null },
): string | null {
  if (c.is_us) return "Always shared";
  if (who.moderator) return null;
  if (c.kind === "group") return who.owner ? null : "Band owners decide";
  if (who.linked && who.linked.userId !== who.me) return `${who.linked.displayName} decides`;
  return null;
}
