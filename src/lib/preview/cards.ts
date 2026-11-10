import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { PREVIEW_TAG } from "./tag";

export type PreviewCard = Database["public"]["Functions"]["preview_cards"]["Returns"][number];

// The sign-in page's preview (#255): shared bands and venues with photos,
// shuffled. The same for everyone, so it's cached and reshuffled hourly.
// Saving or removing a photo, and Keep Private, refresh it right away
// (PREVIEW_TAG); other changes show within the hour. No cookies: it asks
// as a visitor, and the database function decides what a visitor may see.
export async function getPreviewCards(): Promise<PreviewCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(PREVIEW_TAG);
  try {
    const { url, publishableKey } = getSupabaseEnv();
    const supabase = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("preview_cards", { p_limit: 24 });
    return error ? [] : (data ?? []);
  } catch {
    // No preview beats a broken sign-in page.
    return [];
  }
}
