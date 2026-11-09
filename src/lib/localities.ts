import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type LocalityChoice = { placeId: number } | { keepLocalityId: string } | null;

// Read the place field's hidden inputs (see components/place-field.tsx).
export function readPlace(fd: FormData) {
  const placeId = String(fd.get("place_id") ?? "").trim();
  return {
    placeId,
    placeText: String(fd.get("place_text") ?? "").trim(),
    keepLocalityId: String(fd.get("keep_locality_id") ?? "").trim(),
  };
}

export function toLocalityChoice(v: { placeId: string; keepLocalityId: string }): LocalityChoice {
  if (/^\d+$/.test(v.placeId)) return { placeId: Number(v.placeId) };
  if (v.keepLocalityId) return { keepLocalityId: v.keepLocalityId };
  return null;
}

// Each workspace has one locality per GeoNames place; reuse it or add it.
export async function resolveLocality(supabase: Supabase, workspaceId: string, locality: LocalityChoice) {
  if (!locality) return null;
  if ("keepLocalityId" in locality) return locality.keepLocalityId;

  const existing = await supabase
    .from("localities")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("place_id", locality.placeId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("*")
    .eq("id", locality.placeId)
    .single();
  if (placeError) throw placeError;

  const { data, error } = await supabase
    .from("localities")
    .insert({
      workspace_id: workspaceId,
      place_id: place.id,
      name: place.name,
      region: place.region_name,
      region_code: place.region_code,
      country: place.country_name,
      country_code: place.country_code,
      latitude: place.latitude,
      longitude: place.longitude,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    // A bandmate added the same town at the same moment.
    const again = await supabase
      .from("localities")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("place_id", place.id)
      .single();
    if (again.error) throw again.error;
    return again.data.id;
  }
  if (error) throw error;
  return data.id;
}
