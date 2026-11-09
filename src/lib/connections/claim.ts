import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Which band has claimed a listing (#68), once it has members: shown as
// "Uses Seeens", and the band itself can fix the listing's details.
export const getListingClaim = cache(async (id: string): Promise<{ band: string; mine: boolean } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("listing_claim", { p_connection_id: id });
  return data?.[0] ?? null;
});
