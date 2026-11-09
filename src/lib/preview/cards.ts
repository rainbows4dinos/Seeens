import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type PreviewCard = Database["public"]["Functions"]["preview_cards"]["Returns"][number];

// The sign-in page's preview (#255): shared bands and venues with photos,
// shuffled. The same for everyone, so it's cached and reshuffled hourly; a
// listing set to Keep Private leaves within the hour. No cookies: it asks
// as a visitor, and the database function decides what a visitor may see.
export async function getPreviewCards(): Promise<PreviewCard[]> {
  "use cache";
  cacheLife("hours");
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
