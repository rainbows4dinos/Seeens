"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { siteOrigin } from "@/lib/origin";

// Invite a band (#68), for app admins: its first owner gets an invite, and
// the band claims its listing in the directory (or gets a new one). The
// database checks it's an admin asking; these turn its answers into words.

export type InviteBandState = { error?: string; done?: string; link?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inviteLink = async (token: string) => `${await siteOrigin()}/invite/${token}`;

export async function inviteBand(_prev: InviteBandState, formData: FormData): Promise<InviteBandState> {
  const listingId = String(formData.get("listing_id") ?? "");
  const newBand = String(formData.get("new_band") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const personId = String(formData.get("person_id") ?? "");
  const asLink = formData.get("mode") === "link";
  if (!UUID.test(listingId) && !newBand) return { error: "Pick the band, or type its name if it isn't listed." };
  if (!asLink && !email)
    return {
      error: "Add the owner's email, like sam@example.com. Or copy a link instead.",
    };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_band", {
    p_listing_id: UUID.test(listingId) ? listingId : null,
    p_band: newBand || null,
    p_email: asLink ? null : email,
    p_name: name || null,
    p_person_id: UUID.test(personId) ? personId : null,
  });
  const row = data?.[0];
  if (error || !row) {
    const msg = error?.message ?? "";
    if (msg.includes("already claimed")) return { error: "That band's already been invited. Refresh the page." };
    if (msg.includes("already listed"))
      return {
        error: `${newBand} is already in the directory. Pick it from the list.`,
      };
    if (msg.includes("not a band listing")) return { error: "That listing can't be invited. Refresh the page." };
    if (msg.includes("someone else"))
      return { error: "That person is already linked to someone's account. Pick another, or leave it blank." };
    if (msg.includes("not a person")) return { error: "That profile can't be picked. Refresh the page." };
    if (msg.includes("not an email")) return { error: "That doesn't look like an email address." };
    if (msg.includes("opted out")) return { error: `${email} asked not to get email from Seeens.` };
    if (msg.includes("1 to 80")) return { error: "Keep the band's name under 80 characters." };
    return { error: "Couldn't invite the band. Try again." };
  }
  revalidatePath("/admin/bands");
  const band = row.band;
  const link = await inviteLink(row.token);
  if (asLink)
    return {
      done: `Invite ready for ${band}. Send this link to its owner. It works once, for 7 days.`,
      link,
    };

  if (!emailConfigured())
    return {
      done: `Invite ready for ${band}. Email isn't set up, so send this link to ${email} yourself.`,
      link,
    };
  const sent = await emailOwner(email, link, band, name).catch(() => false);
  if (!sent)
    return {
      done: `Invite ready for ${band}, but the email didn't go out. Send this link to ${email} yourself.`,
      link,
    };
  await supabase.rpc("mark_invite_sent", { p_invite_id: row.invite_id });
  return { done: `Invited ${band}. We emailed ${email}.`, link };
}

/** A fresh link for a band's waiting owner; the old one stops working. */
export async function renewBandInvite(inviteId: string): Promise<InviteBandState> {
  if (!UUID.test(inviteId)) return { error: "Couldn't make a link. Try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_band_invite", {
    p_invite_id: inviteId,
  });
  if (error || !data) return { error: "That invite was used or closed. Refresh the page." };
  revalidatePath("/admin/bands");
  return {
    done: "New link ready. The old one no longer works.",
    link: await inviteLink(data),
  };
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
      `${admin} invited ${band} to Seeens, with you as its owner.`,
      "",
      "Seeens is where a band keeps track of the people, venues, labels, and scenes it knows, and finds out who else knows them. It's in beta and invite only, so you'd be one of the first bands on it. Your feedback shapes it.",
      "",
      `Make your account and join: ${link}`,
      "",
      `Once you're in, ${band}'s listing in the directory is yours to keep up to date, and you can invite your bandmates from Band Settings. The link works for 7 days and only once.`,
      "",
      `Questions? Reply to this email and it goes to ${admin}.`,
      "",
      `Don't want email from Seeens? Open the link and choose "Don't email me again."`,
    ].join("\n"),
  });
}
