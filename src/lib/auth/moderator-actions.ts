"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { sendEmail } from "@/lib/email/send";
import { siteOrigin } from "@/lib/origin";

export type ModeratorFormState = { error?: string; done?: string };

// Admins make and remove moderators (#195), picked by name. The database checks it's an
// admin asking; these only turn its answers into words.
export async function grantModerator(_prev: ModeratorFormState, formData: FormData): Promise<ModeratorFormState> {
  const userId = String(formData.get("user_id") ?? "");
  const name = String(formData.get("user_name") ?? "").trim();
  if (!userId) return { error: "Pick someone first." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grant_moderator_user", { p_user_id: userId });
  if (error?.code === "P0002") return { error: "That account isn't here anymore." };
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/admin/moderators");
  const who = name || "They";
  const row = data?.[0];
  // Only the first time: picking someone again isn't news.
  if (!row?.added) return { done: `${who} can moderate now.` };
  const sent = await emailNewModerator(row.email).catch(() => false);
  return { done: sent ? `${who} can moderate now. We emailed them.` : `${who} can moderate now. They'll see a note next time they open Seeens.` };
}

async function emailNewModerator(to: string) {
  const [me, membership] = await Promise.all([getCurrentUser(), getMembership()]);
  const admin = membership?.displayName || "An admin";
  return sendEmail({
    to,
    subject: "You're a moderator on Seeens",
    replyTo: me.email ?? undefined,
    text: [
      `${admin} made you a moderator on Seeens.`,
      "",
      "Moderators help keep the shared directory right. You can now fix the details on any listing another band shares: name, type, town, links, what they can help with, and venue details. You can also keep a listing private when it shouldn't be shared.",
      "",
      "Every edit you make is logged. Each band's statuses and notes stay their own: you can't see or change them.",
      "",
      `Have a look: ${await siteOrigin()}/directory`,
      "",
      `Questions? Reply to this email and it goes to ${admin === "An admin" ? "them" : admin}.`,
    ].join("\n"),
  });
}

/** The new moderator's note, dismissed. */
export async function dismissModeratorWelcome() {
  const supabase = await createClient();
  await supabase.rpc("dismiss_moderator_welcome");
}

export async function revokeModerator(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const supabase = await createClient();
  await supabase.rpc("revoke_moderator", { p_user_id: userId });
  revalidatePath("/admin/moderators");
}
