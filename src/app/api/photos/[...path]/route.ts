import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET, PHOTO_WIDTHS, isPhotoPath } from "@/lib/photos/urls";

// A connection photo at a stable address (#37). Photos used to load through
// signed storage links that changed on every page load, so nothing could
// cache them and every visit downloaded every photo again at full size.
//
// Every save writes files under new names, so a path's bytes never change:
// the browser keeps each one for a year. Signed-in members only: storage
// policies check the workspace on the download. ?w= serves a smaller copy for cards
// and thumbnails.
const NOT_FOUND = new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NOT_FOUND.clone();
  // Storage policies only let members of the path's workspace download it,
  // so there's no separate membership lookup per photo.
  if (!isPhotoPath(path)) return NOT_FOUND.clone();

  const { data: file, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
  if (error || !file) return NOT_FOUND.clone();

  const w = Number(new URL(request.url).searchParams.get("w"));
  let body: ArrayBuffer | Buffer = await file.arrayBuffer();
  let type = file.type || "image/webp";
  if ((PHOTO_WIDTHS as readonly number[]).includes(w)) {
    body = await sharp(Buffer.from(body)).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    type = "image/webp";
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
