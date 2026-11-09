import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
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

// Which band you're looking at, when you're in more than one (#68): a
// workspace id, set by the account menu's band switcher.
export const BAND_COOKIE = "seeens-band";

// Remember the band to show (from a server action: switching, or joining).
export async function rememberBand(id: string) {
  (await cookies()).set(BAND_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

// Every band you're in, oldest membership first. RLS only returns your own.
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, display_name, role, connection_id, workspaces ( name, time_zone )")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw new Error("Couldn't load your workspace.");
  return (data ?? []).map((m) => ({
    workspaceId: m.workspace_id,
    workspaceName: m.workspaces?.name ?? "Workspace",
    displayName: m.display_name,
    role: m.role,
    timeZone: safeTimeZone(m.workspaces?.time_zone),
    connectionId: m.connection_id,
  }));
});

// The band you're looking at: the one you switched to, or your first. Null
// when you haven't been added to one yet.
export const getMembership = cache(async (): Promise<Membership | null> => {
  const [all, jar] = await Promise.all([getMemberships(), cookies()]);
  const picked = jar.get(BAND_COOKIE)?.value;
  return all.find((m) => m.workspaceId === picked) ?? all[0] ?? null;
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

// The band's own page: the connection marked "This is us" in the current
// workspace, or the listing it claimed (#68), if there is one. The header's
// band item opens it (#123), and its photo is the account menu's picture.
// Archived still counts.
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
  if (!error && data) return { id: data.id, photoPath: data.photo_path };
  // A band that claimed a listing another band added (#68): that's its page.
  const { data: band } = await supabase
    .from("workspaces")
    .select("listing_id")
    .eq("id", membership.workspaceId)
    .maybeSingle();
  if (!band?.listing_id) return null;
  const { data: listing } = await supabase
    .from("connections")
    .select("id, photo_path")
    .eq("id", band.listing_id)
    .maybeSingle();
  return listing ? { id: listing.id, photoPath: listing.photo_path } : null;
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
