import { createClient } from "@/lib/supabase/server";

// Sign out with a full page load, not a client-side redirect. The router keeps
// previously visited pages in the DOM (hidden); a document navigation drops
// them so no private data lingers after sign-out on a shared device.

// An invite page can ask to come back to itself (signed in as the wrong
// person); nothing else can pick where you land.
const BACK_TO = /^\/invite\/[0-9a-f]{64}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const next = String((await request.formData().catch(() => null))?.get("next") ?? "");

  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(BACK_TO.test(next) ? next : "/login", request.url).toString(),
      "Cache-Control": "no-store",
      // Also ask the browser to drop any cached pages for this site.
      "Clear-Site-Data": '"cache"',
    },
  });
}
