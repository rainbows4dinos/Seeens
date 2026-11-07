"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type SharingResult = { error?: string };

// Keep records private, or share them (phase 2). Only this band's records;
// its own band page is always shared.
export async function setKeepPrivate(ids: string[], keepPrivate: boolean): Promise<SharingResult> {
  if (!ids.length) return {};
  if (ids.length > 5000) return { error: "Too many at once." };
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  // A few hundred ids per request keeps the URL a sensible length.
  for (let i = 0; i < ids.length; i += 200) {
    let query = supabase
      .from("connections")
      .update({ keep_private: keepPrivate })
      .eq("workspace_id", ws)
      .in("id", ids.slice(i, i + 200));
    if (keepPrivate) query = query.eq("is_us", false);
    const { error } = await query;
    if (error) return { error: "Couldn't save. Try again." };
  }
  revalidatePath("/", "layout");
  return {};
}
