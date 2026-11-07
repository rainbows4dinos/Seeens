import type { Database } from "@/lib/supabase/database.types";

// A band's private layer on a record (#181): status, played together, notes,
// contacts, and whether it archived it. Queries embed it as `band:` and lift
// it onto the record, so pages keep reading `c.status`, `c.archived_at`, and
// so on. Phase 2 opens records every band shares; a band that never touched
// one has no row yet, and sees these defaults.

type Status = Database["public"]["Enums"]["connection_status"];

export type BandDetails = {
  status: Status;
  played_together: boolean;
  notes: string | null;
  email: string | null;
  phone: string | null;
  archived_at: string | null;
};

export const NO_BAND_DETAILS: BandDetails = {
  status: "neutral",
  played_together: false,
  notes: null,
  email: null,
  phone: null,
  archived_at: null,
};

// Select strings spell the embed out in full, so Supabase can type the rows:
//   band:connection_band_details ( status, played_together, notes, email, phone, archived_at )
//   band:connection_band_details ( archived_at )                (linked records)
//   band:connection_band_details!inner ( archived_at )          (to filter on it)

/** The band's layer from an embed: a list now that other bands can keep
 * one on the same record (step 3a); RLS only returns your band's. */
export function layerOf<L>(band: L | L[] | null | undefined): L | null {
  return (Array.isArray(band) ? band[0] : band) ?? null;
}

/** The record with its private layer laid over it, and `band` gone. */
export function liftBand<T extends { band: Partial<BandDetails> | Partial<BandDetails>[] | null }>(
  row: T,
): Omit<T, "band" | keyof BandDetails> & BandDetails {
  const { band, ...rest } = row;
  const layer = layerOf(band);
  const lifted = { ...NO_BAND_DETAILS };
  for (const key of Object.keys(NO_BAND_DETAILS) as (keyof BandDetails)[]) {
    if (layer && key in layer) (lifted as Record<string, unknown>)[key] = layer[key];
    else if (key in rest) (lifted as Record<string, unknown>)[key] = (rest as Record<string, unknown>)[key];
  }
  return { ...(rest as Omit<T, "band" | keyof BandDetails>), ...lifted };
}

/** liftBand for a linked record that may be missing. */
export function liftOther<T extends { band: Partial<BandDetails> | Partial<BandDetails>[] | null }>(other: T | null) {
  return other ? liftBand(other) : null;
}
