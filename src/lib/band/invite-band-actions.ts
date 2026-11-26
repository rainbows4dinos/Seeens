"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { ownerInvite } from "@/lib/email/invites";
import { siteOrigin } from "@/lib/origin";
import { toKind, type WorkspaceKind } from "@/lib/band/kind";
import { isUuid } from "@/lib/ids";

// Invite a band (#68) or a label (#298), for app admins: its first owner gets an invite, and
// the band claims its listing in the directory (or gets a new one). The
// database checks it's an admin asking; these turn its answers into words.

export type InviteBandState = { error?: string; done?: string; link?: string };

const inviteLink = async (token: string) => `${await siteOrigin()}/invite/${token}`;

export async function inviteBand(_prev: InviteBandState, formData: FormData): Promise<InviteBandState> {
  const listingId = String(formData.get("listing_id") ?? "");
  const newBand = String(formData.get("new_band") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const personId = String(formData.get("person_id") ?? "");
  const newKind = toKind(formData.get("new_kind"));
  const asLink = formData.get("mode") === "link";
  if (!isUuid(listingId) && !newBand)
    return { error: "Pick the band, label, or promoter, or type its name if it isn't listed." };
  if (!asLink && !email)
    return {
      error: "Add the owner's email, like sam@example.com. Or copy a link instead.",
    };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_band", {
    p_listing_id: isUuid(listingId) ? listingId : null,
    p_band: newBand || null,
    p_email: asLink ? null : email,
    p_name: name || null,
    p_person_id: isUuid(personId) ? personId : null,
    p_kind: newKind,
  });
  const row = data?.[0];
  if (error || !row) {
    const msg = error?.message ?? "";
    if (msg.includes("already claimed")) return { error: "That one's already been invited. Refresh the page." };
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
    if (msg.includes("1 to 80")) return { error: "Keep the name under 80 characters." };
    return { error: "Couldn't send the invite. Try again." };
  }
  revalidatePath("/admin/bands");
  const band = row.band;
  const link = await inviteLink(row.token);
  if (asLink)
    return {
      done: `Invite ready for ${band}. Send this link to its owner. It works once, for 30 days.`,
      link,
    };

  if (!emailConfigured())
    return {
      done: `Invite ready for ${band}. Email isn't set up, so send this link to ${email} yourself.`,
      link,
    };
  const sent = await emailOwner(email, link, band, name, toKind(row.kind)).catch(() => false);
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
  if (!isUuid(inviteId)) return { error: "Couldn't make a link. Try again." };
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

/** Email a waiting owner again (#367): a fresh link, and a note if there is one. */
export async function resendBandInvite(inviteId: string, note?: string): Promise<InviteBandState> {
  if (!isUuid(inviteId)) return { error: "Couldn't resend it. Try again." };
  const supabase = await createClient();
  const { data: bands } = await supabase.rpc("list_bands");
  const row = (bands ?? []).find((b) => b.invite_id === inviteId);
  if (!row?.invite_email) return { error: "That invite has no email. Refresh Link and send it yourself." };
  const renewed = await renewBandInvite(inviteId);
  if (!renewed.link) return renewed;
  if (!emailConfigured())
    return { done: `Email isn't set up, so send this link to ${row.invite_email} yourself.`, link: renewed.link };
  const sent = await emailOwner(
    row.invite_email,
    renewed.link,
    row.name,
    "",
    toKind(row.kind),
    note?.trim().slice(0, 1000) || null,
  ).catch(() => false);
  if (!sent)
    return { done: `The email didn't go out. Send this link to ${row.invite_email} yourself.`, link: renewed.link };
  await supabase.rpc("mark_invite_sent", { p_invite_id: inviteId });
  revalidatePath("/admin/bands");
  return { done: `Sent to ${row.invite_email} again, with a new link good for 30 days.` };
}

/** Cancel a waiting band's invite: the band goes, its link stops working. */
export async function cancelBandInvite(inviteId: string): Promise<InviteBandState> {
  if (!isUuid(inviteId)) return { error: "Couldn't cancel it. Try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_band_invite", { p_invite_id: inviteId });
  if (error || !data) {
    if (error?.message.includes("has members")) return { error: "Someone already joined. Refresh the page." };
    return { error: "That invite was used or closed. Refresh the page." };
  }
  revalidatePath("/admin/bands");
  return { done: `Canceled ${data}'s invite.` };
}

async function emailOwner(
  to: string,
  link: string,
  band: string,
  name: string,
  kind: WorkspaceKind,
  note?: string | null,
) {
  const [me, membership] = await Promise.all([getCurrentUser(), getMembership()]);
  const admin = membership?.displayName || "Seeens";
  return sendEmail({
    to,
    replyTo: me.email ?? undefined,
    ...ownerInvite({ from: admin, replyName: admin, band, kind, name, link, note }),
  });
}
