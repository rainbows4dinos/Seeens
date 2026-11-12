"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { siteOrigin } from "@/lib/origin";
import type { BandState } from "@/lib/band/actions";

// A label invites its roster (#298): a label's owner invites a band on the
// label to claim its listing. The database checks it's the label's owner
// and that the band is on the roster; these turn its answers into words.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function inviteRosterBand(_prev: BandState, formData: FormData): Promise<BandState> {
  const membership = await getMembership();
  if (!membership || membership.kind !== "label") return { error: "Only labels can do that." };
  const listingId = String(formData.get("listing_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const asLink = formData.get("mode") === "link";
  if (!UUID.test(listingId)) return { error: "Couldn't find that band. Refresh the page." };
  if (!asLink && !email) return { error: "Add the band's email, like sam@example.com. Or copy a link instead." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_roster_band", {
    p_workspace_id: membership.workspaceId,
    p_listing_id: listingId,
    p_email: asLink ? null : email,
    p_name: name || null,
  });
  const row = data?.[0];
  if (error || !row) {
    const msg = error?.message ?? "";
    if (msg.includes("only label owners")) return { error: "Only the label's owners can invite bands." };
    if (msg.includes("already claimed")) return { error: "That band's already on Seeens. Refresh the page." };
    if (msg.includes("not on the roster"))
      return { error: "That band isn't on your roster anymore. Refresh the page." };
    if (msg.includes("not a band listing")) return { error: "That band can't be invited. Refresh the page." };
    if (msg.includes("not an email")) return { error: "That doesn't look like an email address." };
    if (msg.includes("opted out")) return { error: `${email} asked not to get email from Seeens.` };
    if (msg.includes("too many today")) return { error: "That's 20 invites today. Try again tomorrow." };
    return { error: "Couldn't send the invite. Try again." };
  }
  revalidatePath("/band");
  revalidatePath("/");
  const link = `${await siteOrigin()}/invite/${row.token}`;
  const band = row.band;
  if (asLink) return { done: `Invite ready for ${band}. Send this link to whoever runs it.`, link };
  if (!emailConfigured())
    return { done: `Invite ready for ${band}. Email isn't set up, so send this link to ${email} yourself.`, link };

  const me = await getCurrentUser();
  const sent = await sendEmail({
    to: email,
    replyTo: me.email ?? undefined,
    subject: `${membership.workspaceName} invited ${band} to Seeens`,
    text: [
      name ? `Hi ${name},` : "Hi,",
      "",
      `${membership.displayName} at ${membership.workspaceName} invited ${band} to Seeens, with you as its owner.`,
      "",
      "Seeens is where a band keeps track of the people, venues, labels, and scenes it knows, and finds out who else knows them. It's in beta and invite only. Your feedback shapes it.",
      "",
      `Make your account and join: ${link}`,
      "",
      `Once you're in, ${band}'s listing in the directory is yours to keep up to date, and you can invite your bandmates from Band Settings. The link works for 7 days and only once.`,
      "",
      `Questions? Reply to this email and it goes to ${membership.displayName}.`,
      "",
      `Don't want email from Seeens? Open the link and choose "Don't email me again."`,
    ].join("\n"),
  }).catch(() => false);
  if (!sent)
    return {
      done: `Invite ready for ${band}, but the email didn't go out. Send this link to ${email} yourself.`,
      link,
    };
  await supabase.rpc("mark_invite_sent", { p_invite_id: row.invite_id });
  return { done: `Invited ${band}. We emailed ${email}.`, link };
}
