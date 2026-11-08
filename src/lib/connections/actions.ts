"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMembership, isModerator } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { STATUSES, type ConnectionStatus } from "./labels";
import { loadPlayedOffer, type PlayedOffer } from "./played-together";
import {
  AUTOSAVE_GROUPS,
  mergeForAutosave,
  readForm,
  validate,
  type AutosaveGroup,
  type ConnectionFormErrors,
  type ConnectionFormState,
  type ValidConnection,
} from "./form";
import { getConnectionValues } from "./queries";
import { VENUE_KEYS } from "./venue-details";
import { writeBandLayer } from "./band-layer";
import type { Json } from "@/lib/supabase/database.types";

// Venue details replace the keys the form owns; anything else stored (an
// import's leftovers, another type's details) is kept (#48).
function mergeAttributes(stored: unknown, data: ValidConnection): Json | undefined {
  if (!data.venue) return undefined;
  const kept = Object.fromEntries(
    Object.entries(stored && typeof stored === "object" ? (stored as Record<string, Json>) : {}).filter(
      ([k]) => !(VENUE_KEYS as readonly string[]).includes(k),
    ),
  );
  return { ...kept, ...data.venue } as Json;
}

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
  storedAttributes: unknown = {},
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
    p_attributes: mergeAttributes(storedAttributes, data),
  });
  if (error) throw error;
  return savedId;
}

// A moderator fixing another band's shared record (#195): its own details
// only, logged by the database. Scenes and Our band stay each band's.
async function moderateConnection(id: string, data: ValidConnection, expectedUpdatedAt: string, storedAttributes: unknown) {
  const supabase = await createClient();
  const locality = data.locality;
  const { error } = await supabase.rpc("moderate_connection", {
    p_id: id,
    p_name: data.name,
    p_kind: data.kind,
    p_person_roles: data.person_roles,
    p_group_type: data.group_type ?? null,
    p_can_help_with: data.can_help_with,
    p_links: data.links,
    p_place_id: locality && "placeId" in locality ? locality.placeId : undefined,
    p_keep_locality_id: locality && "keepLocalityId" in locality ? locality.keepLocalityId : undefined,
    p_attributes: mergeAttributes(storedAttributes, data),
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) throw error;
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
  // A photo or links are waiting in the form: it adds them, then opens the page.
  if (formData.get("return_id") === "1") return { values, errors: {}, createdId: id };
  redirect(`/connections/${id}?saved=1`);
}

export type ArchiveState = { error?: string };

async function setArchived(id: string, archived: boolean): Promise<ArchiveState> {
  const workspaceId = await requireWorkspace();
  const supabase = await createClient();
  // Archiving is this band's own (#181): it hides the record from this
  // band's directory, another band's record included (#185).
  const { rows, error } = await writeBandLayer(supabase, workspaceId, [id], {
    archived_at: archived ? new Date().toISOString() : null,
  });

  if (error || !rows.length) {
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

export type QuickState = { status: ConnectionStatus | null; playedTogether: boolean };
export type QuickResult =
  | { ok: true; saved: QuickState; offer?: PlayedOffer | null }
  | { ok: false; saved: QuickState | null };

// One-tap status and "played together" changes from the detail page.
// Status history is logged by a database trigger.
export async function quickUpdate(
  id: string,
  change: { status: ConnectionStatus | null } | { playedTogether: boolean },
): Promise<QuickResult> {
  const workspaceId = await requireWorkspace();
  const supabase = await createClient();
  const patch =
    "status" in change
      ? // null clears it back to no status (#192).
        change.status === null || STATUSES.includes(change.status)
        ? { status: change.status }
        : null
      : { played_together: Boolean(change.playedTogether) };

  const current = async () => {
    const { data } = await supabase
      .from("connection_band_details")
      .select("status, played_together")
      .eq("connection_id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    // A record this band never touched has no status (#192).
    return data ? { status: data.status, playedTogether: data.played_together } : { status: null, playedTogether: false };
  };
  if (!patch) return { ok: false, saved: await current() };

  // Status and played together are this band's own (#181), on any record it can see (#185).
  const { rows, error } = await writeBandLayer(supabase, workspaceId, [id], patch);
  const data = rows[0];
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
    .from("connection_band_details")
    .update({ played_together: true })
    .eq("workspace_id", workspaceId)
    .in("connection_id", pick)
    .select("connection_id");
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true, marked: data.length };
}

export type AutosaveResult = { ok: true } | { ok: false; errors: ConnectionFormErrors };

// The fields a band keeps on any record: its own notes and contacts (#185).
const BAND_GROUPS = { email: "email", phone: "phone", notes: "notes" } as const;

async function saveBandFields(
  workspaceId: string,
  id: string,
  groups: AutosaveGroup[],
  data: ValidConnection,
): Promise<AutosaveResult> {
  const patch: { email?: string | null; phone?: string | null; notes?: string | null } = {};
  for (const g of groups as (keyof typeof BAND_GROUPS)[]) patch[BAND_GROUPS[g]] = data[g] || null;
  const supabase = await createClient();
  const { error } = await writeBandLayer(supabase, workspaceId, [id], patch);
  if (error) return { ok: false, errors: { form: SAVE_FAILED } };
  revalidatePath("/", "layout");
  return { ok: true };
}

// The zoned profile page (#126) saves as you go: just the groups of fields
// that changed, laid over what's stored now. A bandmate's edit to another
// field, or a status change from the same page, is kept. If someone saves
// between the read and the write, it reads again and retries once.
export async function autosaveConnection(id: string, groups: string[], formData: FormData): Promise<AutosaveResult> {
  const valid = groups.filter((g): g is AutosaveGroup => g in AUTOSAVE_GROUPS);
  if (!valid.length) return { ok: true };
  const workspaceId = await requireWorkspace();
  const incoming = readForm(formData);

  for (let attempt = 0; attempt < 2; attempt++) {
    const stored = await getConnectionValues(id);
    if (!stored) return { ok: false, errors: { form: "This connection isn't here anymore." } };
    const result = mergeForAutosave(stored.values, incoming, valid);
    if (!result.ok) return { ok: false, errors: result.errors };
    // Another band's record (#185): this band's own notes and contacts, and,
    // for a moderator (#195), the record's shared details.
    if (!stored.mine) {
      const own = valid.filter((g) => g in BAND_GROUPS);
      const shared = valid.filter((g) => !(g in BAND_GROUPS));
      if (shared.length) {
        if (shared.some((g) => g === "scenes" || g === "isUs") || !(await isModerator())) {
          return { ok: false, errors: { form: "Only the band that shared this can change it." } };
        }
        try {
          await moderateConnection(id, result.data, stored.recordUpdatedAt, stored.attributes);
        } catch (error) {
          if ((error as { code?: string } | null)?.code === "PT409" && attempt === 0) continue;
          return { ok: false, errors: saveErrors(error) };
        }
      }
      if (own.length) return saveBandFields(workspaceId, id, own, result.data);
      revalidatePath("/", "layout");
      return { ok: true };
    }
    try {
      await saveConnection(workspaceId, id, result.data, stored.updatedAt, stored.attributes);
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "PT409" && attempt === 0) continue;
      return { ok: false, errors: saveErrors(error) };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  }
  return { ok: false, errors: { form: SAVE_FAILED } };
}
