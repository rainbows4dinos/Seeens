"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ids";

// Your page in the band's directory (#44): link your account to your person,
// or make one. The database only lets you link yourself.

export type LinkState = { error?: string };

export async function linkMe(connectionId: string): Promise<LinkState> {
  const m = await requireMembership();
  if (!isUuid(connectionId)) return { error: "Pick yourself from the list." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_me_to_person", {
    p_workspace_id: m.workspaceId,
    p_connection_id: connectionId,
  });
  if (error) {
    if (error.message?.includes("someone else"))
      return {
        error: "That person is already linked to a bandmate's account.",
      };
    if (error.message?.includes("not a person")) return { error: "Pick a person, not a band or venue." };
    return { error: "Couldn't link it. Try again." };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function unlinkMe(): Promise<LinkState> {
  const m = await requireMembership();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_me", {
    p_workspace_id: m.workspaceId,
  });
  if (error) return { error: "Couldn't unlink it. Try again." };
  revalidatePath("/", "layout");
  return {};
}

/** A new person, named as you are in the band, in your band, linked to you. Opens it. */
export async function makeMyPage(): Promise<LinkState> {
  const m = await requireMembership();
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_my_person", {
    p_workspace_id: m.workspaceId,
  });
  if (error || !id) {
    if (error?.message?.includes("already linked")) return { error: "You already have a page. Unlink it first." };
    return { error: "Couldn't make your page. Try again." };
  }
  revalidatePath("/", "layout");
  redirect(`/connections/${id}?mine=1`);
}
