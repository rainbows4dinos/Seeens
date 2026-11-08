"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { siteOrigin } from "@/lib/origin";

// Start a band (#68), for app admins: name the band, invite its first
// owner. The database checks it's an admin asking; these turn its answers
// into words.

export type StartBandState = { error?: string; done?: string; link?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inviteLink = async (token: string) => `${await siteOrigin()}/invite/${token}`;

export async function startBand(_prev: StartBandState, formData: FormData): Promise<StartBandState> {
  const band = String(formData.get("band") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const asLink = formData.get("mode") === "link";
  if (!band) return { error: "Add the band's name." };
  if (!asLink && !email) return { error: "Add the owner's email, like sam@example.com. Or make a link instead." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_band", {
    p_band: band,
    p_email: asLink ? null : email,
    p_name: name || null,
  });
  const row = data?.[0];
  if (error || !row) {
    const msg = error?.message ?? "";
    if (msg.includes("a band with that name")) return { error: `There's already a band called ${band}.` };
    if (msg.includes("already in a band")) return { error: `${email} is already in a band. Seeens shows one band per person for now.` };
    if (msg.includes("not an email")) return { error: "That doesn't look like an email address." };
    if (msg.includes("opted out")) return { error: `${email} asked not to get email from Seeens.` };
    if (msg.includes("1 to 80")) return { error: "Keep the band's name under 80 characters." };
    return { error: "Couldn't start the band. Try again." };
  }
  revalidatePath("/admin/bands");
  const link = await inviteLink(row.token);
  if (asLink) return { done: `${band} is ready. Send this link to its owner. It works once, for 7 days.`, link };

  if (!emailConfigured()) return { done: `${band} is ready. Email isn't set up, so send this link to ${email} yourself.`, link };
  const sent = await emailOwner(email, link, band, name).catch(() => false);
  if (!sent) return { done: `${band} is ready, but the email didn't go out. Send this link to ${email} yourself.`, link };
  await supabase.rpc("mark_invite_sent", { p_invite_id: row.invite_id });
  return { done: `${band} is ready. We emailed ${email} their invite.`, link };
}

/** A fresh link for a band's waiting owner; the old one stops working. */
export async function renewBandInvite(inviteId: string): Promise<StartBandState> {
  if (!UUID.test(inviteId)) return { error: "Couldn't make a link. Try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_band_invite", { p_invite_id: inviteId });
  if (error || !data) return { error: "That invite was used or closed. Refresh the page." };
  revalidatePath("/admin/bands");
  return { done: "New link ready. The old one no longer works.", link: await inviteLink(data) };
}

async function emailOwner(to: string, link: string, band: string, name: string) {
  const [me, membership] = await Promise.all([getCurrentUser(), getMembership()]);
  const admin = membership?.displayName || "Seeens";
  return sendEmail({
    to,
    replyTo: me.email ?? undefined,
    subject: `${admin} invited ${band} to Seeens`,
    text: [
      name ? `Hi ${name},` : "Hi,",
      "",
      `${admin} set up a place for ${band} on Seeens, and you're its owner.`,
      "",
      "Seeens is where a band keeps track of the people, venues, labels, and scenes it knows, and finds out who else knows them. It's in beta, invite only, so you'd be one of the first bands on it. Your feedback shapes it.",
      "",
      `Make your account and join: ${link}`,
      "",
      "Then invite your bandmates from Band Settings. The link works for 7 days and only once.",
      "",
      `Questions? Reply to this email and it goes to ${admin}.`,
      "",
      `Don't want email from Seeens? Open the link and choose "Don't email me again."`,
    ].join("\n"),
  });
}
