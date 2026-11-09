"use server";

import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatPlace } from "@/lib/places";
import type { Json } from "@/lib/supabase/database.types";
import type { DraftRow } from "./rows";

export type TownMatches = { text: string; options: { id: number; label: string }[] };

/** Places for each distinct town in the sheet, best guess first. */
export async function lookupTowns(texts: string[]): Promise<TownMatches[]> {
  const membership = await getMembership();
  if (!membership) return [];
  const supabase = await createClient();
  const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))].slice(0, 60);
  return Promise.all(
    unique.map(async (text) => {
      // "Portland, OR" searches as "Portland"; the region narrows it below.
      const [name, hint] = text.split(/\s*,\s*/);
      const { data } = await supabase.rpc("search_places", {
        q: name.slice(0, 80),
        max_results: 6,
        workspace_id: membership.workspaceId,
      });
      const options = (data ?? []).map((p) => ({
        id: p.id,
        label: formatPlace(p),
        region: p.region_code,
        country: p.country_code,
      }));
      const h = hint?.toUpperCase();
      if (h)
        options.sort((a, b) => Number(b.region === h || b.country === h) - Number(a.region === h || a.country === h));
      return { text, options: options.map(({ id, label }) => ({ id, label })) };
    }),
  );
}

/** What the import page sends: a reviewed row, its place, and the record it fills in, if any. */
export type ImportRow = Omit<DraftRow, "line" | "town"> & { place_id: number | null; match_id: string | null };

export type ImportResult =
  { ok: true; added: number; filled: number; bookersAdded: number } | { ok: false; error: string };

export async function runImport(rows: ImportRow[]): Promise<ImportResult> {
  const membership = await getMembership();
  if (!membership) return { ok: false, error: "You're not in a workspace." };
  if (!rows.length) return { ok: false, error: "Nothing to import." };
  if (rows.length > 1000) return { ok: false, error: "Import up to 1,000 rows at a time." };

  const clean = rows.map((r) => ({
    ...r,
    name: r.name.slice(0, 200),
    notes: r.notes?.slice(0, 5000) ?? null,
    links: r.links.filter((l) => /^https?:\/\/\S+\.\S+/i.test(l.url)).slice(0, 20),
    scenes: r.scenes.map((s) => s.slice(0, 120)).slice(0, 20),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_connections", {
    p_workspace_id: membership.workspaceId,
    p_rows: clean as unknown as Json,
  });
  if (error || !data) return { ok: false, error: "The import didn't go through. Nothing was saved; try again." };
  revalidatePath("/", "layout");
  const d = data as { added: number; filled: number; bookers_added: number };
  return { ok: true, added: d.added, filled: d.filled, bookersAdded: d.bookers_added };
}
