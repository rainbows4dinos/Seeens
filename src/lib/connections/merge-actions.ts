"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { pairsOf } from "./duplicates";
import { PHOTO_BUCKET } from "@/lib/photos/urls";

type Client = Awaited<ReturnType<typeof createClient>>;

// Merging duplicates (#169). The database does the work in one transaction
// (merge_connections, undo_merge); these just call it and refresh pages.

async function requireWorkspace() {
  const membership = await getMembership();
  if (!membership) redirect("/");
  return membership.workspaceId;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mergeError(error: { code?: string; message?: string }) {
  if (error.message?.includes("our band can only be merged into a group")) {
    return "Your band can only be merged into a band. Keep your band instead.";
  }
  if (error.code === "P0002") return "One of these was changed or merged in the meantime. Reload and try again.";
  return "Couldn't merge. Nothing changed; try again.";
}

export type MergeState = { error?: string };

export async function mergeConnections(_prev: MergeState, formData: FormData): Promise<MergeState> {
  await requireWorkspace();
  const keep = String(formData.get("keep") ?? "");
  const ids = formData.getAll("ids").map(String);
  const merge = [...new Set(ids)].filter((id) => id !== keep);
  if (!UUID.test(keep) || !merge.length || !merge.every((id) => UUID.test(id))) {
    return { error: "Pick the one to keep." };
  }

  const supabase = await createClient();
  await purgeOldMerges(supabase);
  const photo = await copyPhoto(supabase, keep, merge);
  const { error } = await supabase.rpc("merge_connections", {
    p_keep: keep,
    p_merge: merge,
    ...(photo ? { p_photo: photo } : {}),
  });
  if (error) {
    if (photo) await supabase.storage.from(PHOTO_BUCKET).remove([photo.path, photo.original_path]);
    return { error: mergeError(error) };
  }
  if (photo) {
    // Someone added a photo to the kept one in the meantime: it stays, the copy goes.
    const { data: kept } = await supabase.from("connections").select("photo_path").eq("id", keep).maybeSingle();
    if (kept && kept.photo_path !== photo.path) {
      await supabase.storage.from(PHOTO_BUCKET).remove([photo.path, photo.original_path]);
    }
  }

  revalidatePath("/", "layout");
  redirect(`/connections/${keep}?merged=1`);
}

// Deletes merged-away connections past their 30 days: their photo files
// first (the rows are what let us reach them), then the rows. Best effort;
// anything missed goes next time.
async function purgeOldMerges(supabase: Client) {
  const { data: due } = await supabase.rpc("merged_photos_due");
  if (due?.length) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(due);
    if (error) return;
  }
  await supabase.rpc("purge_merged_connections");
}

// If the kept one has no photo, copies the first merged one's photo into the
// kept one's folder (a connection's photo has to live in its own folder).
// Returns the copy for merge_connections, or null.
async function copyPhoto(supabase: Client, keep: string, merge: string[]) {
  const { data } = await supabase
    .from("connections")
    .select("id, workspace_id, photo_path, photo_original_path, photo_settings, photo_alt")
    .in("id", [keep, ...merge]);
  const kept = data?.find((c) => c.id === keep);
  const from = merge.map((id) => data?.find((c) => c.id === id)).find((c) => c?.photo_path && c.photo_original_path);
  if (!kept || kept.photo_path || !from?.photo_path || !from.photo_original_path) return null;

  const folder = `${kept.workspace_id}/${kept.id}/`;
  const name = crypto.randomUUID();
  const ext = (p: string) => p.slice(p.lastIndexOf("."));
  const path = `${folder}${name}${ext(from.photo_path)}`;
  const original = `${folder}${name}-original${ext(from.photo_original_path)}`;
  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const a = await bucket.copy(from.photo_path, path);
  const b = a.error ? a : await bucket.copy(from.photo_original_path, original);
  if (a.error || b.error) {
    // No photo is better than a half-copied one; the merge goes ahead.
    await bucket.remove([path, original]);
    return null;
  }
  return { path, original_path: original, settings: from.photo_settings, alt: from.photo_alt };
}

export type UndoState = { error?: string };

export async function undoMerge(mergeId: string): Promise<UndoState> {
  await requireWorkspace();
  if (!UUID.test(mergeId)) return { error: "Couldn't undo. Try again." };
  const supabase = await createClient();
  // A photo the merge copied in, to delete if undo takes it off.
  const { data: merge } = await supabase.from("connection_merges").select("keep_id, log").eq("id", mergeId).maybeSingle();
  const copied = Array.isArray(merge?.log)
    ? (merge.log as { op?: string; path?: string; original_path?: string }[]).find((s) => s?.op === "photo")
    : undefined;
  const { error } = await supabase.rpc("undo_merge", { p_merge: mergeId });
  if (error) {
    if (error.message?.includes("later merge")) return { error: "This one was merged again since. Undo that merge first." };
    if (error.message?.includes("30 days")) return { error: "It's been more than 30 days, so this can't be undone." };
    if (error.message?.includes("already undone") && merge) redirect(`/connections/${merge.keep_id}?unmerged=${mergeId}`);
    return { error: "Couldn't undo. Nothing changed; try again." };
  }
  if (copied?.path && copied.original_path && merge) {
    const { data: kept } = await supabase.from("connections").select("photo_path").eq("id", merge.keep_id).maybeSingle();
    if (kept && kept.photo_path !== copied.path) {
      await supabase.storage.from(PHOTO_BUCKET).remove([copied.path, copied.original_path]);
    }
  }
  revalidatePath("/", "layout");
  // A fresh load of the kept one says what came back (see the profile page).
  redirect(`/connections/${merge?.keep_id ?? ""}?unmerged=${mergeId}`);
}

/** Marks every pair among these as "not the same", so they stop showing up together. */
export async function markNotDuplicates(ids: string[]): Promise<{ error?: string }> {
  const workspaceId = await requireWorkspace();
  if (ids.length < 2 || !ids.every((id) => UUID.test(id))) return { error: "Couldn't save. Try again." };
  const supabase = await createClient();
  const { error } = await supabase.from("connection_not_duplicates").upsert(
    pairsOf(ids).map(([a, b]) => ({ workspace_id: workspaceId, connection_a: a, connection_b: b })),
    { onConflict: "connection_a,connection_b", ignoreDuplicates: true },
  );
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/", "layout");
  return {};
}

/** Takes one connection out of a group: not the same as any of the others. */
export async function markNotDuplicateOf(id: string, others: string[]): Promise<{ error?: string }> {
  const workspaceId = await requireWorkspace();
  if (!UUID.test(id) || !others.length || !others.every((o) => UUID.test(o))) return { error: "Couldn't save. Try again." };
  const supabase = await createClient();
  const { error } = await supabase.from("connection_not_duplicates").upsert(
    others
      .filter((o) => o !== id)
      .map((o) => {
        const [a, b] = id < o ? [id, o] : [o, id];
        return { workspace_id: workspaceId, connection_a: a, connection_b: b };
      }),
    { onConflict: "connection_a,connection_b", ignoreDuplicates: true },
  );
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/", "layout");
  return {};
}
