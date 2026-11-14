import { isPublic } from "@/lib/photos/public-url";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Import photos (#321): browsers won't let a page read an image from another
// site, so this fetches one for the import page, which then runs it through
// the copier like any upload. Band members only; public web images only
// (never a private network address), at most 4 MB, nothing cached or logged.

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
// Under Vercel's 4.5 MB response limit.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const IMAGE = /^image\/(jpeg|png|webp|gif|avif)$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return fail(401, "Sign in first.");
  if (!(await getMembership().catch(() => null))) return fail(403, "Only band members can add photos.");

  let url: URL;
  try {
    url = new URL(new URL(request.url).searchParams.get("url") ?? "");
  } catch {
    return fail(400, "That isn't a link.");
  }

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublic(url))) return fail(400, "That link isn't a public web address.");
      const res = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": "Seeens (+https://www.seeens.com)", accept: "image/*" },
        signal: AbortSignal.timeout(10_000),
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (next) {
        url = new URL(next, url);
        continue;
      }
      if (!res.ok || !res.body) return fail(502, "Couldn't get that photo.");
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!IMAGE.test(type)) return fail(415, "That link isn't a photo.");
      if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return fail(413, "That photo is too big.");
      const bytes = await readCapped(res.body);
      if (!bytes) return fail(413, "That photo is too big.");
      return new Response(bytes, { headers: { ...PRIVATE, "Content-Type": type } });
    }
    return fail(502, "That link redirects too many times.");
  } catch {
    return fail(502, "Couldn't get that photo.");
  }
}

function fail(status: number, message: string) {
  return new Response(message, { status, headers: PRIVATE });
}

async function readCapped(body: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(size));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
