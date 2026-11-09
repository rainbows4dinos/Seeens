"use server";

import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { readSettings } from "./settings";
import { PHOTO_BUCKET } from "./urls";

// Saving a photo (#37). The browser uploads the files straight to storage
// (storage policies check the folder), then calls savePhoto to point the
// connection at them. Replaced or removed files are deleted here.

type Result = { error?: string };

const SAVE_FAILED = "Couldn't save the photo. Try again.";
const FILE = /^[0-9a-f-]{36}(-original)?\.(webp|jpg)$/;

function inFolder(path: unknown, folder: string, original: boolean): path is string {
  if (typeof path !== "string" || !path.startsWith(folder)) return false;
  const file = path.slice(folder.length);
  return FILE.test(file) && file.includes("-original") === original;
}

async function current(connectionId: string) {
  const membership = await getMembership();
  if (!membership) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("connections")
    .select("id, workspace_id, photo_path, photo_original_path")
    .eq("id", connectionId)
    .eq("workspace_id", membership.workspaceId)
    .maybeSingle();
  return data ? { supabase, row: data, folder: `${data.workspace_id}/${data.id}/` } : null;
}

export async function savePhoto(
  connectionId: string,
  photo: { path: string; originalPath: string; settings: unknown; alt: string },
): Promise<Result> {
  const found = await current(connectionId);
  if (!found) return { error: SAVE_FAILED };
  const { supabase, row, folder } = found;

  const settings = readSettings(photo.settings);
  if (!settings || !inFolder(photo.path, folder, false) || !inFolder(photo.originalPath, folder, true)) {
    return { error: SAVE_FAILED };
  }
  const alt = photo.alt.trim().slice(0, 300) || null;

  const { error } = await supabase
    .from("connections")
    .update({
      photo_path: photo.path,
      photo_original_path: photo.originalPath,
      photo_settings: settings,
      photo_alt: alt,
    })
    .eq("id", row.id)
    .eq("workspace_id", row.workspace_id);
  if (error) return { error: SAVE_FAILED };

  // The files this replaced. Best effort: a leftover file is only clutter.
  const stale = [row.photo_path, row.photo_original_path].filter(
    (p): p is string => Boolean(p) && p !== photo.path && p !== photo.originalPath,
  );
  if (stale.length) await supabase.storage.from(PHOTO_BUCKET).remove(stale);

  revalidatePath(`/connections/${row.id}`);
  revalidatePath("/");
  return {};
}

export async function removePhoto(connectionId: string): Promise<Result> {
  const found = await current(connectionId);
  if (!found) return { error: "Couldn't remove the photo. Try again." };
  const { supabase, row } = found;

  const { error } = await supabase
    .from("connections")
    .update({ photo_path: null, photo_original_path: null, photo_settings: null, photo_alt: null })
    .eq("id", row.id)
    .eq("workspace_id", row.workspace_id);
  if (error) return { error: "Couldn't remove the photo. Try again." };

  const files = [row.photo_path, row.photo_original_path].filter((p): p is string => Boolean(p));
  if (files.length) await supabase.storage.from(PHOTO_BUCKET).remove(files);

  revalidatePath(`/connections/${row.id}`);
  revalidatePath("/");
  return {};
}

/** Clean up files from an upload whose save failed. */
export async function discardUpload(connectionId: string, paths: string[]): Promise<Result> {
  const found = await current(connectionId);
  if (!found) return {};
  const { supabase, row, folder } = found;
  const keep = new Set([row.photo_path, row.photo_original_path]);
  const mine = paths.filter((p) => (inFolder(p, folder, false) || inFolder(p, folder, true)) && !keep.has(p));
  if (mine.length) await supabase.storage.from(PHOTO_BUCKET).remove(mine);
  return {};
}
