"use server";

import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isDefault, resolveLayout } from "./layout";

// Save this person's Home layout (#313). The default saves as nothing, so
// later changes to the default reach them.
export async function saveHomeLayout(shown: string[], hidden: string[]): Promise<{ ok: boolean }> {
  const membership = await getMembership();
  if (!membership) return { ok: false };
  const layout = resolveLayout({ shown, hidden }, membership.kind);
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "set_home_layout",
    isDefault(layout, membership.kind)
      ? { p_workspace_id: membership.workspaceId, p_shown: null, p_hidden: null }
      : { p_workspace_id: membership.workspaceId, p_shown: layout.shown, p_hidden: layout.hidden },
  );
  if (error) return { ok: false };
  revalidatePath("/");
  return { ok: true };
}
