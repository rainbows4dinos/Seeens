import "server-only";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLayout } from "./layout";

// This person's Home layout in their current band (#313).
export async function loadHomeLayout() {
  const membership = await getMembership();
  if (!membership) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("home_layout", { p_workspace_id: membership.workspaceId });
  return { kind: membership.kind, layout: resolveLayout(data?.[0] ?? null, membership.kind) };
}
