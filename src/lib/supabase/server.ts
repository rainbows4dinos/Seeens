import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Supabase client for Server Components, Server Actions, and Route Handlers.
// Create a new one per request. Reading cookies makes the caller dynamic, so
// with Cache Components it must render inside a <Suspense> boundary.
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();
  // Auth checks token expiry with the clock, so always run at request time.
  await connection();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies. The proxy refreshes the
          // session on each request, so this is safe to ignore here.
        }
      },
    },
  });
}
