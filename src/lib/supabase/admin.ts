import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Supabase's admin API, server only. Used for one thing: creating the
// account of someone accepting an invite, since open sign-up stays off
// (#68). Needs SUPABASE_SECRET_KEY (a secret key, never NEXT_PUBLIC_), set
// in Vercel; without it, invitees can join only with an existing account.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  const { url } = getSupabaseEnv();
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
