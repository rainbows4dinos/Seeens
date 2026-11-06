"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { pairsOf } from "./duplicates";

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
  const { error } = await supabase.rpc("merge_connections", { p_keep: keep, p_merge: merge });
  if (error) return { error: mergeError(error) };

  revalidatePath("/", "layout");
  redirect(`/connections/${keep}?merged=1`);
}

export type UndoState = { error?: string; done?: boolean };

export async function undoMerge(mergeId: string): Promise<UndoState> {
  await requireWorkspace();
  if (!UUID.test(mergeId)) return { error: "Couldn't undo. Try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_merge", { p_merge: mergeId });
  if (error) {
    if (error.message?.includes("later merge")) return { error: "This one was merged again since. Undo that merge first." };
    if (error.message?.includes("30 days")) return { error: "It's been more than 30 days, so this can't be undone." };
    if (error.message?.includes("already undone")) return { done: true };
    return { error: "Couldn't undo. Nothing changed; try again." };
  }
  revalidatePath("/", "layout");
  return { done: true };
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
