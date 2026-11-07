"use server";

import { revalidatePath } from "next/cache";
import { getMembership, requireWorkspaceId } from "@/lib/auth/dal";
import { GROUP_TYPES, type GroupType, type PersonRole } from "@/lib/connections/labels";
import { createClient } from "@/lib/supabase/server";
import { addOptionsFor, fitsTarget, newGroupTypes } from "./options";
import { MAX_NAME_LENGTH, MAX_ROLE_LENGTH, MAX_ROWS } from "./lineup";

export type LinkState = { ok?: boolean; error?: string; attempt?: number };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type CarryInput = { town: boolean; sceneIds: string[]; played: boolean };

// What a new member takes from the band (#124): only what was ticked, and
// only the band's own values, whatever the browser sent.
async function carryFromBand(supabase: Supabase, workspaceId: string, bandId: string, pick: CarryInput | null) {
  if (!pick) return {};
  const { data: band } = await supabase
    .from("connections")
    .select("locality_id, band:connection_band_details ( played_together ), connection_scenes ( scene_id )")
    .eq("id", bandId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!band) return {};
  const scenes = new Set(band.connection_scenes.map((s) => s.scene_id));
  const sceneIds = (Array.isArray(pick.sceneIds) ? pick.sceneIds : []).filter((id) => scenes.has(id));
  return {
    p_locality_id: pick.town && band.locality_id ? band.locality_id : undefined,
    p_scene_ids: sceneIds.length ? sceneIds : undefined,
    p_played_together: Boolean(pick.played && band.band?.played_together),
  };
}
const fail = (error: string): LinkState => ({ error, attempt: Date.now() });

export async function addLink(
  connectionId: string,
  optionId: string,
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const membership = await getMembership();
  if (!membership) return fail("You're not in a workspace.");
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("connections")
    .select("id, kind, group_type")
    .eq("id", connectionId)
    .eq("workspace_id", membership.workspaceId)
    .maybeSingle();
  if (!subject) return fail("Couldn't find this connection.");

  const option = addOptionsFor(subject).find((o) => o.id === optionId);
  if (!option) return fail("That kind of link doesn't fit here.");

  const role = str(formData, "role").slice(0, 80) || null;
  const isCurrent = formData.get("former") !== "on";
  const picked = str(formData, "other_id");
  const newName = str(formData, "new_name");
  let error: { code?: string } | null;

  if (picked && picked !== "__new__") {
    const { data: other } = await supabase
      .from("connections")
      .select("id, kind, group_type")
      .eq("id", picked)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle();
    if (!other || other.id === subject.id || !fitsTarget(option.target, other)) {
      return fail("Pick someone from the list.");
    }
    const [from, to] = option.direction === "out" ? [subject.id, other.id] : [other.id, subject.id];
    ({ error } = await supabase.from("affiliations").insert({
      workspace_id: membership.workspaceId,
      from_connection_id: from,
      to_connection_id: to,
      kind: option.kind,
      role,
      is_current: isCurrent,
    }));
  } else if (picked === "__new__" && newName) {
    let shape: { kind: "person"; person_roles: PersonRole[]; group_type?: undefined } | {
      kind: "group";
      person_roles: [];
      group_type: GroupType;
    };
    if (option.target.kind === "person") {
      shape = { kind: "person", person_roles: option.newPersonRoles ?? ["other"] };
    } else {
      const allowed = newGroupTypes(option.target);
      const chosen = str(formData, "new_group_type") as GroupType;
      const type = allowed.length === 1 ? allowed[0] : chosen;
      if (!GROUP_TYPES.includes(type) || !allowed.includes(type)) {
        return fail("Choose what kind of place or org it is.");
      }
      shape = { kind: "group", person_roles: [], group_type: type };
    }
    // A new member of a band can take the band's town, scenes, and played
    // together (#124), as ticked in the form.
    const carry =
      option.kind === "member" && option.target.kind === "person" && formData.get("carry") === "1"
        ? await carryFromBand(supabase, membership.workspaceId, subject.id, {
            town: formData.get("carry_town") === "on",
            sceneIds: formData.getAll("carry_scene").map(String),
            played: formData.get("carry_played") === "on",
          })
        : {};
    // Adds the new connection and the link together, so a failed link never
    // leaves a stray connection behind.
    ({ error } = await supabase.rpc("create_linked_connection", {
      ...carry,
      p_workspace_id: membership.workspaceId,
      p_other_id: subject.id,
      // "out" links go from the subject, so the new connection is on the "to" end.
      p_new_is_from: option.direction !== "out",
      p_name: newName.slice(0, 200),
      p_kind: shape.kind,
      p_person_roles: shape.person_roles,
      p_group_type: shape.group_type,
      p_affiliation_kind: option.kind,
      p_role: role ?? undefined,
      p_is_current: isCurrent,
    }));
    if (error) return fail("Couldn't add them. Try again.");
  } else {
    return fail("Pick someone, or type a name to add someone new.");
  }

  if (error?.code === "23505") return fail("They're already linked this way.");
  if (error) return fail("Couldn't save the link. Try again.");

  // Any change can show up on other pages (both ends of a link, the
  // directory), so drop the client's cached pages, not just this one.
  revalidatePath("/", "layout");
  return { ok: true, attempt: Date.now() };
}

export async function updateLink(
  linkId: string,
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const [supabase, workspaceId] = await Promise.all([createClient(), requireWorkspaceId()]);
  const { data, error } = await supabase
    .from("affiliations")
    .update({
      role: str(formData, "role").slice(0, 80) || null,
      is_current: formData.get("former") !== "on",
    })
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error || !data.length) return fail("Couldn't save. Try again.");
  // Any change can show up on other pages (both ends of a link, the
  // directory), so drop the client's cached pages, not just this one.
  revalidatePath("/", "layout");
  return { ok: true, attempt: Date.now() };
}

export async function removeLink(linkId: string): Promise<LinkState> {
  const [supabase, workspaceId] = await Promise.all([createClient(), requireWorkspaceId()]);
  const { data, error } = await supabase
    .from("affiliations")
    .delete()
    .eq("id", linkId)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error || !data.length) return fail("Couldn't remove it. Try again.");
  // Any change can show up on other pages (both ends of a link, the
  // directory), so drop the client's cached pages, not just this one.
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Paste a lineup: add several members to a band at once (#75).

export type MemberRowInput = {
  name: string;
  roles: string;
  former: boolean;
  personId: string | null; // link this existing person, or null to add someone new
};
export type AddMembersResult = { ok: true; added: number; skipped: number } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addBandMembers(
  bandId: string,
  rows: MemberRowInput[],
  carry: CarryInput | null = null,
): Promise<AddMembersResult> {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Pick at least one person to add." };
  if (rows.length > MAX_ROWS) return { ok: false, error: `Add up to ${MAX_ROWS} people at a time.` };

  const clean = [];
  for (const r of rows) {
    const name = String(r?.name ?? "").replace(/\s+/g, " ").trim();
    const roles = String(r?.roles ?? "").trim();
    const personId = r?.personId && UUID_RE.test(r.personId) ? r.personId : null;
    if (!personId && !name) return { ok: false, error: "Every new person needs a name." };
    if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Keep names under ${MAX_NAME_LENGTH} characters.` };
    if (roles.length > MAX_ROLE_LENGTH) return { ok: false, error: `Keep roles under ${MAX_ROLE_LENGTH} characters: ${name}.` };
    clean.push({ name, roles, former: Boolean(r?.former), person_id: personId });
  }

  const membership = await getMembership();
  if (!membership) return { ok: false, error: "You're not in a workspace." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_band_members", {
    // New people can take the band's town, scenes, and played together (#124).
    ...(await carryFromBand(supabase, membership.workspaceId, bandId, carry)),
    p_workspace_id: membership.workspaceId,
    p_band_id: bandId,
    p_rows: clean,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "P0002"
          ? "Couldn't find this band or one of the people. Refresh and try again."
          : "Couldn't add them. Nothing was saved; try again.",
    };
  }

  const results = (data ?? []) as { added: boolean }[];
  const added = results.filter((r) => r.added).length;
  revalidatePath("/", "layout");
  return { ok: true, added, skipped: results.length - added };
}
