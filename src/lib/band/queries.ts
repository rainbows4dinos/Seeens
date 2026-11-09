import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Open invites for Band Settings: not used, revoked, or expired. Newest first. */
export async function loadPendingInvites(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invites")
    .select("id, email, name, role, invited_by, invited_by_name, created_at, expires_at, sent_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return data ?? [];
}
