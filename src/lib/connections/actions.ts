"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { STATUSES, type ConnectionStatus } from "./labels";
import {
  readForm,
  validate,
  type ConnectionFormState,
  type ValidConnection,
} from "./form";

const SAVE_FAILED = "Couldn't save. Your changes are still here; try again.";

function saveErrors(error: unknown): ConnectionFormState["errors"] {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === "23505" && e.message?.includes("connections_one_us_per_workspace")) {
    return { isUs: "Another connection is already marked as your band." };
  }
  return { form: SAVE_FAILED };
}

async function requireWorkspace() {
  const membership = await getMembership();
  if (!membership) redirect("/");
  return membership.workspaceId;
}

// Saves the connection, its town, links, and scene tags (adding any new
// scenes) in one database transaction. It all lands, or nothing changes.
async function saveConnection(workspaceId: string, id: string | null, data: ValidConnection) {
  const supabase = await createClient();
  const locality = data.locality;
  const { data: savedId, error } = await supabase.rpc("save_connection", {
    p_workspace_id: workspaceId,
    p_id: id ?? undefined,
    p_name: data.name,
    p_kind: data.kind,
    p_person_roles: data.person_roles,
    p_group_type: data.group_type ?? undefined,
    p_status: data.status,
    p_played_together: data.played_together,
    p_is_us: data.is_us,
    p_can_help_with: data.can_help_with,
    p_email: data.email ?? undefined,
    p_phone: data.phone ?? undefined,
    p_notes: data.notes ?? undefined,
    p_place_id: locality && "placeId" in locality ? locality.placeId : undefined,
    p_keep_locality_id: locality && "keepLocalityId" in locality ? locality.keepLocalityId : undefined,
    p_scene_ids: data.scene_ids,
    p_new_scenes: data.new_scenes,
    p_links: data.links,
  });
  if (error) throw error;
  return savedId;
}

export async function createConnection(
  _prev: ConnectionFormState,
  formData: FormData,
): Promise<ConnectionFormState> {
  const values = readForm(formData);
  const result = validate(values);
  if (!result.ok) return { values, errors: result.errors, attempt: Date.now() };

  // Outside the try: redirect() works by throwing.
  const workspaceId = await requireWorkspace();
  let id: string;
  try {
    id = await saveConnection(workspaceId, null, result.data);
  } catch (error) {
    return { values, errors: saveErrors(error), attempt: Date.now() };
  }

  revalidatePath("/", "layout");
  redirect(`/connections/${id}?saved=1`);
}

export async function updateConnection(
  id: string,
  _prev: ConnectionFormState,
  formData: FormData,
): Promise<ConnectionFormState> {
  const values = readForm(formData);
  const result = validate(values);
  if (!result.ok) return { values, errors: result.errors, attempt: Date.now() };

  const workspaceId = await requireWorkspace();
  try {
    await saveConnection(workspaceId, id, result.data);
  } catch (error) {
    return { values, errors: saveErrors(error), attempt: Date.now() };
  }

  revalidatePath("/", "layout");
  redirect(`/connections/${id}?saved=1`);
}

export type ArchiveState = { error?: string };

async function setArchived(id: string, archived: boolean): Promise<ArchiveState> {
  const workspaceId = await requireWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id");

  if (error || !data.length) {
    return { error: archived ? "Couldn't archive. Try again." : "Couldn't restore. Try again." };
  }
  // Any change can show up on other pages (both ends of a link, the
  // directory), so drop the client's cached pages, not just this one.
  revalidatePath("/", "layout");
  return {};
}

export async function archiveConnection(id: string): Promise<ArchiveState> {
  return setArchived(id, true);
}

export async function restoreConnection(id: string): Promise<ArchiveState> {
  return setArchived(id, false);
}

export type QuickState = { status: ConnectionStatus; playedTogether: boolean };
export type QuickResult = { ok: true; saved: QuickState } | { ok: false; saved: QuickState | null };

// One-tap status and "played together" changes from the detail page.
// Status history is logged by a database trigger.
export async function quickUpdate(
  id: string,
  change: { status: ConnectionStatus } | { playedTogether: boolean },
): Promise<QuickResult> {
  const workspaceId = await requireWorkspace();
  const supabase = await createClient();
  const patch =
    "status" in change
      ? STATUSES.includes(change.status)
        ? { status: change.status }
        : null
      : { played_together: Boolean(change.playedTogether) };

  const current = async () => {
    const { data } = await supabase
      .from("connections")
      .select("status, played_together")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return data ? { status: data.status, playedTogether: data.played_together } : null;
  };
  if (!patch) return { ok: false, saved: await current() };

  const { data, error } = await supabase
    .from("connections")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("status, played_together")
    .maybeSingle();
  if (error || !data) return { ok: false, saved: await current() };

  revalidatePath("/", "layout");
  return { ok: true, saved: { status: data.status, playedTogether: data.played_together } };
}
