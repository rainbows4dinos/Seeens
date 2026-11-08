"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ModeratorFormState = { error?: string; done?: string; email?: string };

// Admins make and remove moderators (#195). The database checks it's an
// admin asking; these only turn its answers into words.
export async function grantModerator(_prev: ModeratorFormState, formData: FormData): Promise<ModeratorFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter their email.", email };
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_moderator", { p_email: email });
  if (error?.code === "P0002") return { error: "No Seeens account uses that email.", email };
  if (error) return { error: "Couldn't save. Try again.", email };
  revalidatePath("/admin/moderators");
  return { done: `${email} is a moderator.` };
}

export async function revokeModerator(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("revoke_moderator", { p_user_id: userId });
  revalidatePath("/admin/moderators");
}
