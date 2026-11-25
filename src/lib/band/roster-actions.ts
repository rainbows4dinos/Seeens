"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ownerInvite } from "@/lib/email/invites";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { siteOrigin } from "@/lib/origin";
import type { BandState } from "@/lib/band/actions";
import { isUuid } from "@/lib/ids";

// A label invites its roster (#298): a label's owner invites a band on the
// label to claim its listing. The database checks it's the label's owner
// and that the band is on the roster; these turn its answers into words.

export async function inviteRosterBand(_prev: BandState, formData: FormData): Promise<BandState> {
  const membership = await getMembership();
  if (!membership || membership.kind !== "label") return { error: "Only labels can do that." };
  const listingId = String(formData.get("listing_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const asLink = formData.get("mode") === "link";
  if (!isUuid(listingId)) return { error: "Couldn't find that band. Refresh the page." };
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
    ...ownerInvite({
      from: `${membership.displayName} at ${membership.workspaceName}`,
      replyName: membership.displayName,
      band,
      kind: "band",
      name,
      link,
    }),
  }).catch(() => false);
  if (!sent)
    return {
      done: `Invite ready for ${band}, but the email didn't go out. Send this link to ${email} yourself.`,
      link,
    };
  await supabase.rpc("mark_invite_sent", { p_invite_id: row.invite_id });
  return { done: `Invited ${band}. We emailed ${email}.`, link };
}

// A label runs its roster from its own page (#365): find a band anyone
// shared, or add a new one, and take one off.

export type RosterResult = { error?: string; id?: string };

export type BandMatch = { id: string; name: string; town: string | null };

/** Bands you can see whose name has this in it, for Add to Roster. */
export async function searchRosterBands(q: string): Promise<BandMatch[]> {
  const membership = await getMembership();
  const term = q.trim().slice(0, 80);
  if (!membership || membership.kind !== "label" || term.length < 2) return [];
  const supabase = await createClient();
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { data } = await supabase
    .from("connections")
    .select("id, name, localities ( name, region_code )")
    .eq("kind", "group")
    .eq("group_type", "band")
    .is("merged_into", null)
    .ilike("name", pattern)
    .order("name")
    .limit(8);
  return (data ?? []).map((b) => {
    const loc = Array.isArray(b.localities) ? b.localities[0] : b.localities;
    return { id: b.id, name: b.name, town: loc ? [loc.name, loc.region_code].filter(Boolean).join(", ") : null };
  });
}

function rosterError(message: string) {
  if (message.includes("only a label")) return "Only the label's members can change its roster.";
  if (message.includes("only bands")) return "Only bands go on a roster.";
  if (message.includes("a name is required")) return "Type the band's name.";
  return "Couldn't save. Try again.";
}

export async function addToRoster(connectionId: string): Promise<RosterResult> {
  const membership = await getMembership();
  if (!membership || membership.kind !== "label") return { error: "Only labels have a roster." };
  if (!isUuid(connectionId)) return { error: "Couldn't find that band. Refresh the page." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("roster_add", {
    p_workspace_id: membership.workspaceId,
    p_connection_id: connectionId,
  });
  if (error) return { error: rosterError(error.message) };
  revalidatePath("/", "layout");
  return { id: connectionId };
}

export async function addNewToRoster(name: string): Promise<RosterResult> {
  const membership = await getMembership();
  if (!membership || membership.kind !== "label") return { error: "Only labels have a roster." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("roster_add_new", {
    p_workspace_id: membership.workspaceId,
    p_name: name.trim(),
  });
  if (error || !data) return { error: rosterError(error?.message ?? "") };
  revalidatePath("/", "layout");
  return { id: data };
}

export async function removeFromRoster(connectionId: string): Promise<RosterResult> {
  const membership = await getMembership();
  if (!membership || membership.kind !== "label") return { error: "Only labels have a roster." };
  if (!isUuid(connectionId)) return { error: "Couldn't find that band. Refresh the page." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("roster_remove", {
    p_workspace_id: membership.workspaceId,
    p_connection_id: connectionId,
  });
  if (error) return { error: rosterError(error.message) };
  revalidatePath("/", "layout");
  return {};
}
