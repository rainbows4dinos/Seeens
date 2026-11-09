"use server";

import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/** Put the Getting Started checklist away, for you in this band (#68). */
export async function dismissGettingStarted() {
  const membership = await getMembership();
  if (!membership) return;
  const supabase = await createClient();
  await supabase.rpc("dismiss_getting_started", {
    p_workspace_id: membership.workspaceId,
  });
  revalidatePath("/");
}
