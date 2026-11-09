"use server";

import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Town nicknames (#234): where a scene name like "LA Punk" or "PDX Garage"
// finds its town. Suggestions on the Scenes page; the list itself is kept
// by moderators.

export type NicknameState = { error?: string; done?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Take one suggestion, or every one the band has ("all"). */
export async function applySceneSuggestion(formData: FormData) {
  const id = String(formData.get("scene_id") ?? "");
  const supabase = await createClient();
  if (id === "all") {
    const membership = await getMembership();
    if (!membership) return;
    const { data } = await supabase.rpc("scene_suggestions", { p_workspace_id: membership.workspaceId });
    for (const s of data ?? []) await supabase.rpc("apply_scene_suggestion", { p_scene_id: s.scene_id });
  } else if (UUID.test(id)) {
    await supabase.rpc("apply_scene_suggestion", { p_scene_id: id });
  }
  revalidatePath("/scenes");
}

export async function dismissSceneSuggestion(formData: FormData) {
  const id = String(formData.get("scene_id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.rpc("dismiss_scene_suggestion", { p_scene_id: id });
  revalidatePath("/scenes");
}

export async function addNickname(_prev: NicknameState, formData: FormData): Promise<NicknameState> {
  const alias = String(formData.get("alias") ?? "").trim();
  const placeId = String(formData.get("place_id") ?? "").trim();
  if (!alias) return { error: "Add the nickname, like PDX." };
  if (!/^\d+$/.test(placeId)) return { error: "Pick the town from the suggestions." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_place_alias", { p_alias: alias, p_place_id: Number(placeId) });
  if (error) {
    if (error.message.includes("already a nickname")) return { error: `${alias} is already a nickname.` };
    if (error.message.includes("not a nickname")) return { error: "Use letters and numbers, 2 to 40 characters." };
    if (error.message.includes("only moderators")) return { error: "Only moderators can add nicknames." };
    return { error: "Couldn't add it. Try again." };
  }
  revalidatePath("/scenes/nicknames");
  return { done: `Added ${alias}. New scenes with it in their name now find that town.` };
}

export async function removeNickname(formData: FormData) {
  const alias = String(formData.get("alias") ?? "").trim();
  if (!alias) return;
  const supabase = await createClient();
  await supabase.rpc("remove_place_alias", { p_alias: alias });
  revalidatePath("/scenes/nicknames");
}
