"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { latestChangelogDate } from "@/lib/changelog";

// Opening What's New (#216) clears the header's mark: remember the newest
// entry this person has seen. Signed out, there's nothing to remember.
export async function markChangelogSeen() {
  const latest = await latestChangelogDate();
  if (!latest) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return;
  const { error } = await supabase.rpc("mark_changelog_seen", { p_on: latest });
  if (!error) revalidatePath("/", "layout");
}
