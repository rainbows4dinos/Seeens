import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET, PHOTO_WIDTHS } from "@/lib/photos/urls";

// A preview card's photo on the sign-in page (#255), for visitors. Only a
// listing still on the preview (a shared band or venue, not kept private)
// gets one, and only its copy, never the original upload. Photos are
// private in storage, so the server fetches it once it's checked.
const NOT_FOUND = new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NOT_FOUND.clone();
  const supabase = await createClient();
  const { data: path } = await supabase.rpc("preview_photo_path", { p_id: id });
  const admin = createAdminClient();
  if (!path || !admin) return NOT_FOUND.clone();

  const { data: file, error } = await admin.storage.from(PHOTO_BUCKET).download(path);
  if (error || !file) return NOT_FOUND.clone();

  const asked = Number(new URL(request.url).searchParams.get("w"));
  const w = (PHOTO_WIDTHS as readonly number[]).includes(asked) ? asked : 320;
  const body = await sharp(Buffer.from(await file.arrayBuffer()))
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/webp",
      // An hour, so Keep Private takes it off soon after.
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
