import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ListingClaim = { band: string; mine: boolean; joined: boolean };

// Which band has claimed a listing (#68). Once it has members the listing
// shows "Uses Seeens", and the band itself can fix the listing's details.
// Before that, its invite is waiting.
export const getListingClaim = cache(async (id: string): Promise<ListingClaim | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("listing_claim", { p_connection_id: id });
  return data?.[0] ?? null;
});

// An app admin can invite a band from its listing when nobody's claimed it.
export const isAppAdmin = cache(async (): Promise<boolean> => {
  const { data } = await (await createClient()).rpc("is_app_admin");
  return Boolean(data);
});
