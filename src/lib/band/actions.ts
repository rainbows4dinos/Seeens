"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { siteOrigin } from "@/lib/origin";

// Band Settings and invites (#69). The database checks who may do what;
// these turn its answers into plain messages.

export type BandState = { error?: string; done?: string; link?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function band() {
  const membership = await getMembership();
  if (!membership) redirect("/");
  return membership;
}

function ownersOnly(error: { message?: string }) {
  if (error.message?.includes("owners only")) return "Only owners can do that.";
  if (error.message?.includes("a band needs an owner")) return "A band needs an owner. Make someone else an owner first.";
  return null;
}

export async function renameBand(name: string): Promise<BandState> {
  const m = await band();
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_band", { p_workspace_id: m.workspaceId, p_name: name });
  if (error) return { error: ownersOnly(error) ?? (name.trim() ? "Couldn't save. Try again." : "Add a name.") };
  revalidatePath("/", "layout");
  return { done: "Saved" };
}

export async function setMemberRole(userId: string, role: "owner" | "member"): Promise<BandState> {
  const m = await band();
  if (!UUID.test(userId)) return { error: "Couldn't save. Try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_workspace_id: m.workspaceId, p_user_id: userId, p_role: role });
  if (error) return { error: ownersOnly(error) ?? "Couldn't save. Try again." };
  revalidatePath("/band");
  return { done: "Saved" };
}

export async function removeMember(userId: string): Promise<BandState> {
  const m = await band();
  if (!UUID.test(userId)) return { error: "Couldn't remove them. Try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_workspace_id: m.workspaceId, p_user_id: userId });
  if (error) return { error: ownersOnly(error) ?? "Couldn't remove them. Try again." };
  revalidatePath("/band");
  return { done: "Removed" };
}

const inviteLink = async (token: string) => `${await siteOrigin()}/invite/${token}`;

async function emailInvite(to: string, link: string, inviter: string, bandName: string) {
  return sendEmail({
    to,
    subject: `${inviter} invited you to ${bandName} on Seeens`,
    text: [
      `${inviter} invited you to join ${bandName} on Seeens.`,
      "",
      "Seeens is where the band keeps track of the people, venues, labels, and scenes it knows. It's in beta, so you'd be one of the first to use it, and your feedback shapes it.",
      "",
      `Join ${bandName}: ${link}`,
      "",
      "The link works for 7 days and only once.",
      "",
      `Don't want email from Seeens? Open the link and choose "Don't email me again."`,
    ].join("\n"),
  });
}

/** Invite by email (sent if email is set up) or as a link to copy. */
export async function createInvite(_prev: BandState, formData: FormData): Promise<BandState> {
  const m = await band();
  const asLink = formData.get("mode") === "link";
  const email = asLink ? "" : String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = formData.get("role") === "owner" ? "owner" : "member";
  if (!asLink && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter an email address, like sam@example.com. Or copy an invite link instead." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_workspace_id: m.workspaceId,
    p_email: asLink ? null : email,
    p_name: name || null,
    p_role: role,
  });
  const row = data?.[0];
  if (error || !row) {
    const msg = error?.message ?? "";
    if (msg.includes("already a member")) return { error: `${email} is already in ${m.workspaceName}.` };
    if (msg.includes("opted out")) return { error: `${email} asked not to get email from Seeens. Copy a link and send it yourself instead.` };
    if (msg.includes("only owners")) return { error: "Only owners can invite an owner." };
    if (msg.includes("too many")) return { error: "That's a lot of open invites. Wait for some to be used or revoke a few, then try again." };
    return { error: "Couldn't make the invite. Try again." };
  }

  const link = await inviteLink(row.token);
  revalidatePath("/band");
  if (asLink) return { done: "Invite link ready. It works once, for 7 days.", link };

  const already = row.existing ? `${row.first_sent_by ?? "Someone"} already invited ${email}. ` : "";
  if (!emailConfigured()) {
    return { done: `${already}Email isn't set up yet, so send ${email} this link yourself.`, link };
  }
  const sent = await emailInvite(email, link, m.displayName, m.workspaceName);
  if (!sent) return { done: `${already}Couldn't send the email. Send ${email} this link yourself.`, link };
  await supabase.rpc("mark_invite_sent", { p_invite_id: row.invite_id });
  return { done: row.existing ? `${already}We sent it again.` : `Invite sent to ${email}.` };
}

/** A fresh link for a pending invite; the old one stops working. */
export async function renewInviteLink(inviteId: string): Promise<BandState> {
  await band();
  if (!UUID.test(inviteId)) return { error: "Couldn't make a link. Try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_invite_link", { p_invite_id: inviteId });
  if (error || !data) {
    if (error?.message?.includes("sender or an owner")) return { error: "Only whoever sent it, or an owner, can do that." };
    return { error: "Couldn't make a link. Try again." };
  }
  revalidatePath("/band");
  return { done: "New link ready. The old one no longer works.", link: await inviteLink(data) };
}

export async function resendInvite(inviteId: string): Promise<BandState> {
  const m = await band();
  const renewed = await renewInviteLink(inviteId);
  if (!renewed.link) return renewed;
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invites").select("email").eq("id", inviteId).maybeSingle();
  if (!inv?.email || !emailConfigured()) return { done: "Email isn't set up yet, so send this link yourself.", link: renewed.link };
  const sent = await emailInvite(inv.email, renewed.link, m.displayName, m.workspaceName);
  if (!sent) return { done: "Couldn't send the email. Send this link yourself.", link: renewed.link };
  await supabase.rpc("mark_invite_sent", { p_invite_id: inviteId });
  return { done: `Sent to ${inv.email} again.` };
}

export async function revokeInvite(inviteId: string): Promise<BandState> {
  await band();
  if (!UUID.test(inviteId)) return { error: "Couldn't revoke it. Try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", { p_invite_id: inviteId });
  if (error) {
    if (error.message?.includes("sender or an owner")) return { error: "Only whoever sent it, or an owner, can revoke it." };
    return { error: "Couldn't revoke it. Try again." };
  }
  revalidatePath("/band");
  return { done: "Revoked" };
}

// ----- The invite page (/invite/[token]) -----

export type JoinState = { error?: string; email?: string; mode?: "new" | "existing" };

function tokenOk(token: string) {
  return /^[0-9a-f]{64}$/.test(token);
}

async function join(token: string, displayName: string | null): Promise<JoinState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token, p_display_name: displayName });
  if (error) {
    if (error.message?.includes("wrong email")) return { error: "This invite is for a different email address." };
    if (error.message?.includes("closed")) return { error: "This invite has been used, revoked, or has run out." };
    return { error: "Couldn't join. Try again." };
  }
  revalidatePath("/", "layout");
  redirect("/?joined=1");
}

/** Signed in already: join with this account. */
export async function acceptInvite(_prev: JoinState, formData: FormData): Promise<JoinState> {
  await getCurrentUser();
  const token = String(formData.get("token") ?? "");
  if (!tokenOk(token)) return { error: "This invite link isn't complete. Copy it again." };
  return join(token, String(formData.get("display_name") ?? "").trim() || null);
}

/** New to Seeens: make an account, then join. Open sign-up stays off; the invite is what lets you in. */
export async function signUpAndJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!tokenOk(token)) return { error: "This invite link isn't complete. Copy it again." };
  if (!name) return { error: "Add your name, the way bandmates know you.", email, mode: "new" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter your email address.", email, mode: "new" };
  if (password.length < 8) return { error: "Use at least 8 characters for your password.", email, mode: "new" };

  const supabase = await createClient();
  const { data: preview } = await supabase.rpc("invite_preview", { p_token: token });
  const inv = preview?.[0];
  if (!inv || inv.status !== "open") return { error: "This invite has been used, revoked, or has run out." };
  if (inv.email && inv.email !== email) return { error: `This invite is for ${inv.email}.`, email, mode: "new" };

  const admin = createAdminClient();
  if (!admin) return { error: "New accounts can't be made right now. Ask whoever invited you to check Seeens's setup.", email, mode: "new" };
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (created.error) {
    if (created.error.code === "email_exists" || created.error.status === 422) {
      return { error: "There's already an account for that email. Sign in below to join.", email, mode: "existing" };
    }
    if (created.error.code === "weak_password") return { error: "Pick a stronger password.", email, mode: "new" };
    return { error: "Couldn't make your account. Try again.", email, mode: "new" };
  }
  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error) return { error: "Your account is ready. Sign in below to join.", email, mode: "existing" };
  return join(token, name);
}

/** Already have an account: sign in, then join. */
export async function signInAndJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!tokenOk(token)) return { error: "This invite link isn't complete. Copy it again." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: error.status === 429 ? "Too many attempts. Wait a minute and try again." : "That email and password don't match.",
      email,
      mode: "existing",
    };
  }
  return join(token, null);
}

export async function optOut(token: string): Promise<JoinState> {
  if (!tokenOk(token)) return { error: "This invite link isn't complete." };
  const supabase = await createClient();
  await supabase.rpc("opt_out_of_invites", { p_token: token });
  redirect(`/invite/${token}?stopped=1`);
}
