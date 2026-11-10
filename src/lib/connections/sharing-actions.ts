"use server";

import { revalidatePath, updateTag } from "next/cache";
import { PREVIEW_TAG } from "@/lib/preview/tag";
import { createClient } from "@/lib/supabase/server";

export type SharingResult = { error?: string; refused?: number };

// Keep records private, or share them (phase 2). The database decides who
// may (#195): a group, an owner of its band or a moderator; a person, their
// own account once linked, else their band. Records refused are counted.
export async function setKeepPrivate(ids: string[], keepPrivate: boolean): Promise<SharingResult> {
  if (!ids.length) return {};
  if (ids.length > 5000) return { error: "Too many at once." };
  const supabase = await createClient();
  let refused = 0;
  // A few hundred ids per call keeps each request a sensible size.
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.rpc("set_keep_private", {
      p_ids: ids.slice(i, i + 200),
      p_keep: keepPrivate,
    });
    if (error) return { error: "Couldn't save. Try again." };
    refused += Number((data as { refused?: number } | null)?.refused ?? 0);
  }
  revalidatePath("/", "layout");
  updateTag(PREVIEW_TAG);
  return refused ? { refused } : {};
}
