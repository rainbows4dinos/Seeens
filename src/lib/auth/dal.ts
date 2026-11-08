import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/outreach/labels";

export type CurrentUser = {
  id: string;
  email: string | null;
};

export type Membership = {
  workspaceId: string;
  workspaceName: string;
  displayName: string;
  role: "owner" | "member";
  timeZone: string;
  /** Your person in the band's directory, once you've linked it (#44). */
  connectionId: string | null;
};

// Verified user for this request, or a redirect to /login.
// Reads cookies, so callers must render inside <Suspense>.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) redirect("/login");

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

// The user's workspace membership, or null when they haven't been added yet.
// RLS only returns memberships for workspaces the user belongs to.
export const getMembership = cache(async (): Promise<Membership | null> => {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, display_name, role, connection_id, workspaces ( name, time_zone )")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Couldn't load your workspace.");
  if (!data) return null;

  return {
    workspaceId: data.workspace_id,
    workspaceName: data.workspaces?.name ?? "Workspace",
    displayName: data.display_name,
    role: data.role,
    timeZone: safeTimeZone(data.workspaces?.time_zone),
    connectionId: data.connection_id,
  };
});

// The current workspace's id. RLS lets a user read every workspace they
// belong to, so queries also filter by this one to keep bands apart for
// anyone in more than one. Pages check getMembership() first, so this
// only throws if that check was skipped.
export async function requireWorkspaceId(): Promise<string> {
  const membership = await getMembership();
  if (!membership) throw new Error("Not in a workspace.");
  return membership.workspaceId;
}

// The connection marked "This is us" in the current workspace, if there is
// one: the header's band item opens it (#123), and its photo is the account
// menu's picture. Archived still counts.
export const getUsConnection = cache(async (): Promise<{ id: string; photoPath: string | null } | null> => {
  const membership = await getMembership();
  if (!membership) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .select("id, photo_path")
    .eq("workspace_id", membership.workspaceId)
    .eq("is_us", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, photoPath: data.photo_path };
});

// A moderator or an admin (#195): can fix any shared record and keep any
// record private.
export const isModerator = cache(async (): Promise<boolean> => {
  const { data } = await (await createClient()).rpc("is_moderator");
  return Boolean(data);
});

// Who in the band's directory has a login (#44): person id -> their account.
export const getLinkedPeople = cache(async (): Promise<Map<string, { userId: string; displayName: string }>> => {
  const membership = await getMembership();
  if (!membership) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, display_name, connection_id")
    .eq("workspace_id", membership.workspaceId)
    .not("connection_id", "is", null);
  return new Map((data ?? []).map((m) => [m.connection_id!, { userId: m.user_id, displayName: m.display_name }]));
});
