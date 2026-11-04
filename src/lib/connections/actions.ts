"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { STATUSES, type ConnectionStatus } from "./labels";
import { loadPlayedOffer, type PlayedOffer } from "./played-together";
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
async function saveConnection(
  workspaceId: string,
  id: string | null,
  data: ValidConnection,
  expectedUpdatedAt?: string,
) {
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
    p_expected_updated_at: expectedUpdatedAt || undefined,
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
  // Was "played together" off before this save? Turning it on offers the
  // members (or bands) next (#124).
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("connections")
    .select("played_together")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  try {
    await saveConnection(workspaceId, id, result.data, values.updatedAt);
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "PT409") {
      return conflictState(workspaceId, id, values);
    }
    return { values, errors: saveErrors(error), attempt: Date.now() };
  }

  revalidatePath("/", "layout");
  const offer = before && !before.played_together && result.data.played_together ? "&offer=played" : "";
  redirect(`/connections/${id}?saved=1${offer}`);
}

// A bandmate saved this connection after the form was opened. Nothing was
// saved. Keep what was typed, and take on their version's timestamp so that
// saving again (after a look at their changes) goes through.
async function conflictState(
  workspaceId: string,
  id: string,
  values: ConnectionFormState["values"],
): Promise<ConnectionFormState> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("connections")
    .select("updated_at")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return {
    values: { ...values, updatedAt: data?.updated_at ?? values.updatedAt },
    errors: {},
    conflict: true,
    attempt: Date.now(),
  };
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
export type QuickResult =
  | { ok: true; saved: QuickState; offer?: PlayedOffer | null }
  | { ok: false; saved: QuickState | null };

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
  // Just marked played together: offer the members, or the bands (#124).
  const offer =
    "playedTogether" in change && change.playedTogether ? await loadPlayedOffer(supabase, workspaceId, id) : null;
  return { ok: true, saved: { status: data.status, playedTogether: data.played_together }, offer };
}

export type MarkResult = { ok: true; marked: number } | { ok: false };

// Marks the picked members (or bands) of a connection as played together,
// in one update. Only current relatives of that connection are touched, and
// only "played together" changes; status and its history stay as they are.
export async function markPlayedTogether(sourceId: string, ids: string[]): Promise<MarkResult> {
  const workspaceId = await requireWorkspace();
  const supabase = await createClient();
  const offer = await loadPlayedOffer(supabase, workspaceId, sourceId);
  const allowed = new Set(offer?.relatives.filter((r) => !r.playedTogether).map((r) => r.id) ?? []);
  const pick = [...new Set(Array.isArray(ids) ? ids : [])].filter((id) => allowed.has(id));
  if (!pick.length) return { ok: true, marked: 0 };

  const { data, error } = await supabase
    .from("connections")
    .update({ played_together: true })
    .eq("workspace_id", workspaceId)
    .in("id", pick)
    .select("id");
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true, marked: data.length };
}
