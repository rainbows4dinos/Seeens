"use server";

import { revalidatePath } from "next/cache";
import { getMembership, getUsConnection } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { writeBandLayer } from "./band-layer";
import { STATUSES, type ConnectionStatus } from "./labels";

// Bulk status (#243): one change for every selected listing. Status and
// played together are this band's own (#181), on any listing it can see,
// other bands' shared ones included. Your own band's page has no status, so
// it's skipped.

export type BulkChange = { status: ConnectionStatus | null } | { playedTogether: true };
export type Before = { id: string; status: ConnectionStatus | null; playedTogether: boolean };
export type BulkResult = { ok: true; changed: number; before: Before[] } | { ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 500;

async function setup(ids: unknown) {
  const membership = await getMembership();
  if (!membership) return null;
  const us = await getUsConnection();
  const pick = [...new Set(Array.isArray(ids) ? ids : [])]
    .filter((id): id is string => typeof id === "string" && UUID.test(id) && id !== us?.id)
    .slice(0, MAX);
  return { workspaceId: membership.workspaceId, pick, supabase: await createClient() };
}

export async function bulkUpdate(ids: string[], change: BulkChange): Promise<BulkResult> {
  const s = await setup(ids);
  if (!s) return { ok: false };
  const { supabase, workspaceId, pick } = s;
  if (!pick.length) return { ok: true, changed: 0, before: [] };
  const patch =
    "status" in change
      ? change.status === null || STATUSES.includes(change.status)
        ? { status: change.status }
        : null
      : change.playedTogether === true
        ? { played_together: true }
        : null;
  if (!patch) return { ok: false };

  // What was there, for Undo. Listings this band never touched have no row.
  const { data: now, error: readError } = await supabase
    .from("connection_band_details")
    .select("connection_id, status, played_together")
    .eq("workspace_id", workspaceId)
    .in("connection_id", pick);
  if (readError) return { ok: false };
  const was = new Map(now.map((r) => [r.connection_id, r]));
  const before = pick.map((id) => ({
    id,
    status: was.get(id)?.status ?? null,
    playedTogether: was.get(id)?.played_together ?? false,
  }));

  const { rows, error } = await writeBandLayer(supabase, workspaceId, pick, patch);
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true, changed: rows.length, before };
}

// Undo: each listing back to what it was, a write per distinct value.
export async function undoBulkUpdate(before: Before[]): Promise<{ ok: boolean }> {
  const s = await setup(Array.isArray(before) ? before.map((b) => b?.id) : []);
  if (!s) return { ok: false };
  const { supabase, workspaceId, pick } = s;
  const allowed = new Set(pick);
  const groups = new Map<string, string[]>();
  for (const b of before) {
    if (!allowed.has(b.id)) continue;
    if (b.status !== null && !STATUSES.includes(b.status)) continue;
    const key = JSON.stringify([b.status, Boolean(b.playedTogether)]);
    groups.set(key, [...(groups.get(key) ?? []), b.id]);
  }
  for (const [key, ids] of groups) {
    const [status, played] = JSON.parse(key) as [ConnectionStatus | null, boolean];
    const { error } = await writeBandLayer(supabase, workspaceId, ids, { status, played_together: played });
    if (error) return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
