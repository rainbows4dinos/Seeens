import { createClient } from "@/lib/supabase/server";

// A feedback screenshot (#71). Storage policies let only the sender and app
// admins download it; anyone else gets a 404.
const PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)$/;
const NOT_FOUND = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (!PATH.test(path)) return NOT_FOUND();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NOT_FOUND();
  const { data: file, error } = await supabase.storage.from("feedback-screenshots").download(path);
  if (error || !file) return NOT_FOUND();
  return new Response(new Uint8Array(await file.arrayBuffer()), {
    headers: {
      "Content-Type": file.type || (path.endsWith(".jpg") ? "image/jpeg" : "image/webp"),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
