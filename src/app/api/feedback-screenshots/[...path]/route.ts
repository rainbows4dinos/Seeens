import { createClient } from "@/lib/supabase/server";
import { UUID_SOURCE } from "@/lib/ids";
import { notFound } from "@/lib/http";

// A feedback screenshot (#71). Storage policies let only the sender and app
// admins download it; anyone else gets a 404.
const PATH = new RegExp(`^${UUID_SOURCE}/${UUID_SOURCE}\\.(webp|jpg)$`);

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (!PATH.test(path)) return notFound();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return notFound();
  const { data: file, error } = await supabase.storage.from("feedback-screenshots").download(path);
  if (error || !file) return notFound();
  return new Response(new Uint8Array(await file.arrayBuffer()), {
    headers: {
      "Content-Type": file.type || (path.endsWith(".jpg") ? "image/jpeg" : "image/webp"),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
