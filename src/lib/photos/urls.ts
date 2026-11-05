export const PHOTO_BUCKET = "connection-photos";

/** Widths the photo route serves besides the full copy: list rows, the page header, cards. */
export const PHOTO_WIDTHS = [160, 320, 640] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

const PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}(-original)?\.(webp|jpg)$/;
export const isPhotoPath = (p: string) => PATH.test(p);

/**
 * A stored photo's address on this site (/api/photos/…), stable for as long as
 * the photo is, so the browser caches it. Optionally a smaller copy.
 */
export function photoUrl(path: string | null | undefined, width?: PhotoWidth): string | null {
  if (!path || !isPhotoPath(path)) return null;
  return `/api/photos/${path}${width ? `?w=${width}` : ""}`;
}

/** srcset for a photo shown at several sizes (cards). */
export function photoSrcSet(path: string | null | undefined): string | undefined {
  const base = photoUrl(path);
  return base ? `${base}?w=320 320w, ${base}?w=640 640w, ${base} 800w` : undefined;
}
