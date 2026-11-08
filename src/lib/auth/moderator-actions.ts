"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ModeratorFormState = { error?: string; done?: string };

// Admins make and remove moderators (#195), picked by name. The database checks it's an
// admin asking; these only turn its answers into words.
export async function grantModerator(_prev: ModeratorFormState, formData: FormData): Promise<ModeratorFormState> {
  const userId = String(formData.get("user_id") ?? "");
  const name = String(formData.get("user_name") ?? "").trim();
  if (!userId) return { error: "Pick someone first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_moderator_user", { p_user_id: userId });
  if (error?.code === "P0002") return { error: "That account isn't here anymore." };
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/admin/moderators");
  return { done: `${name || "They"} can moderate now.` };
}

export async function revokeModerator(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("revoke_moderator", { p_user_id: userId });
  revalidatePath("/admin/moderators");
}
