import "server-only";
import { createClient } from "@/lib/supabase/server";

export const PHOTO_BUCKET = "connection-photos";
/** Signed photo links last an hour; pages re-sign them on every load. */
const EXPIRES_IN = 60 * 60;

/** Short-lived links for stored photo paths, keyed by path. Missing ones are left out. */
export async function signPhotos(paths: (string | null | undefined)[]) {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (!wanted.length) return urls;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(wanted, EXPIRES_IN);
  for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) urls.set(d.path, d.signedUrl);
  return urls;
}
